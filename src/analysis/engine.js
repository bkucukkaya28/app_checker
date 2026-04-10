'use strict';

const { ANALYSIS_THRESHOLDS } = require('../config/constants');

function safeParseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(value) {
  return Number(value.toFixed(2));
}

function calculateImprovementPercent(oldValue, newValue) {
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue) || oldValue <= 0) {
    return 0;
  }
  const raw = ((oldValue - newValue) / oldValue) * 100;
  return round2(clamp(raw, 0, 70));
}

function normalizeEvents(events) {
  return events.map((event) => ({
    id: event.id,
    sessionId: event.session_id,
    eventType: event.event_type,
    pageUrl: event.page_url,
    elementSelector: event.element_selector,
    timestamp: Number(event.event_timestamp),
    metadata: safeParseJson(event.metadata_json),
  }));
}

function groupEventsBySession(events) {
  const sessions = new Map();
  for (const event of events) {
    if (!sessions.has(event.sessionId)) sessions.set(event.sessionId, []);
    sessions.get(event.sessionId).push(event);
  }
  for (const sessionEvents of sessions.values()) {
    sessionEvents.sort((a, b) => a.timestamp - b.timestamp);
  }
  return sessions;
}

function buildTargetKey(event) {
  const metadata = event.metadata || {};
  const type = metadata.elementType || 'unknown';
  const id = metadata.elementId || event.elementSelector || 'no-id';
  const cls = metadata.elementClass || 'no-class';
  return `${type}#${id}.${cls}`;
}

function extractBehaviorSignals(sessionEvents) {
  const signals = {
    totalNavigations: 0,
    repeatedClickBursts: [],
    longIdleMoments: [],
    clicksBeforeNavigationSamples: [],
    actionCompletionDurationsMs: [],
    simulatedResponseTimesMs: [],
  };

  const clickBufferByTarget = new Map();
  let runningClicksBeforeNav = 0;
  let actionStartTimestamp = sessionEvents[0]?.timestamp || Date.now();

  for (let i = 0; i < sessionEvents.length; i += 1) {
    const current = sessionEvents[i];

    if (current.eventType === 'click') {
      runningClicksBeforeNav += 1;
      const target = buildTargetKey(current);
      const timestamps = clickBufferByTarget.get(target) || [];
      timestamps.push(current.timestamp);
      const filtered = timestamps.filter((ts) => current.timestamp - ts <= ANALYSIS_THRESHOLDS.rageClicks.windowMs);
      clickBufferByTarget.set(target, filtered);

      if (filtered.length >= ANALYSIS_THRESHOLDS.rageClicks.minClicks) {
        signals.repeatedClickBursts.push({ target, burstCount: filtered.length, endTimestamp: current.timestamp });
      }

      const nextEvent = sessionEvents[i + 1];
      if (nextEvent) {
        signals.simulatedResponseTimesMs.push(clamp(nextEvent.timestamp - current.timestamp, 50, 5000));
      }
    }

    if (current.eventType === 'navigation') {
      signals.totalNavigations += 1;
      signals.clicksBeforeNavigationSamples.push(runningClicksBeforeNav);
      signals.actionCompletionDurationsMs.push(current.timestamp - actionStartTimestamp);
      runningClicksBeforeNav = 0;
      actionStartTimestamp = current.timestamp;
    }

    if (i > 0) {
      const delta = current.timestamp - sessionEvents[i - 1].timestamp;
      if (delta >= ANALYSIS_THRESHOLDS.longIdleBetweenActionsMs) {
        signals.longIdleMoments.push({ deltaMs: delta, pageUrl: current.pageUrl || null });
      }
    }
  }

  return signals;
}

function calculateUsabilityImprovement(signals) {
  const avgClicks = average(signals.clicksBeforeNavigationSamples);
  const avgCompletionMs = average(signals.actionCompletionDurationsMs);
  if (!avgClicks || !avgCompletionMs) return 0;

  const optimizedClicks = Math.max(2, avgClicks * 0.75);
  const optimizedCompletionMs = Math.max(1500, avgCompletionMs * 0.75);
  const clickImprovement = calculateImprovementPercent(avgClicks, optimizedClicks);
  const timeImprovement = calculateImprovementPercent(avgCompletionMs, optimizedCompletionMs);
  return round2((clickImprovement + timeImprovement) / 2);
}

function calculatePerformanceImprovement(signals) {
  const avgResponseMs = average(signals.simulatedResponseTimesMs);
  if (!avgResponseMs) return 0;
  const optimizedResponseMs = Math.max(120, avgResponseMs * 0.72);
  return calculateImprovementPercent(avgResponseMs, optimizedResponseMs);
}

function createCandidateFindings(sessionId, signals) {
  const candidates = [];
  const usabilityImprovement = calculateUsabilityImprovement(signals);
  const performanceImprovement = calculatePerformanceImprovement(signals);
  const evidenceStrength = clamp(
    (signals.clicksBeforeNavigationSamples.length + signals.simulatedResponseTimesMs.length) / 20,
    0,
    1
  );

  if (signals.repeatedClickBursts.length > 0) {
    const burst = signals.repeatedClickBursts.at(-1);
    const severity = Math.min(1, burst.burstCount / 8);
    candidates.push({
      issue: `Repeated click attempts on ${burst.target}`,
      rootCause: 'Weak or delayed feedback causes rapid retries.',
      recommendation: `Add immediate success/error feedback for ${burst.target} and debounce duplicate submissions.`,
      usabilityImprovementPercent: round2(clamp(usabilityImprovement + severity * 8, 0, 70)),
      performanceImprovementPercent: round2(clamp(performanceImprovement + severity * 4, 0, 70)),
      impact: round2(clamp((usabilityImprovement + performanceImprovement) / 2 + severity * 6, 0, 70)),
      confidence: round2(Math.min(0.95, 0.62 + severity * 0.2 + evidenceStrength * 0.15)),
      evidence: { sessionId, pattern: 'repeated_click_burst', burst },
    });
  }

  const avgClicksBeforeNav = average(signals.clicksBeforeNavigationSamples);
  if (signals.totalNavigations >= 2 && avgClicksBeforeNav >= ANALYSIS_THRESHOLDS.excessiveClicksPerNav) {
    const overheadRatio = Math.min(2, avgClicksBeforeNav / ANALYSIS_THRESHOLDS.excessiveClicksPerNav);
    candidates.push({
      issue: 'Navigation paths require too many clicks before completion',
      rootCause: 'Primary actions are likely hidden or ambiguous.',
      recommendation: 'Surface primary actions earlier and simplify decision points in the flow.',
      usabilityImprovementPercent: round2(clamp(usabilityImprovement + overheadRatio * 7, 0, 70)),
      performanceImprovementPercent: round2(clamp(performanceImprovement + overheadRatio * 3, 0, 70)),
      impact: round2(clamp((usabilityImprovement + performanceImprovement) / 2 + overheadRatio * 5, 0, 70)),
      confidence: round2(Math.min(0.93, 0.6 + (overheadRatio - 1) * 0.2 + evidenceStrength * 0.16)),
      evidence: { sessionId, pattern: 'high_clicks_before_navigation', avgClicksBeforeNavigation: round2(avgClicksBeforeNav) },
    });
  }

  if (signals.longIdleMoments.length > 0) {
    const maxIdle = Math.max(...signals.longIdleMoments.map((item) => item.deltaMs));
    const severity = Math.min(1, maxIdle / 20000);
    candidates.push({
      issue: 'Users pause for long periods between actions',
      rootCause: 'Decision points are unclear and increase cognitive load.',
      recommendation: 'Clarify next steps and add contextual hints near high-friction points.',
      usabilityImprovementPercent: round2(clamp(usabilityImprovement + severity * 6, 0, 70)),
      performanceImprovementPercent: round2(clamp(performanceImprovement + severity * 5, 0, 70)),
      impact: round2(clamp((usabilityImprovement + performanceImprovement) / 2 + severity * 4, 0, 70)),
      confidence: round2(Math.min(0.9, 0.58 + severity * 0.25 + evidenceStrength * 0.18)),
      evidence: { sessionId, pattern: 'long_idle_between_actions', maxIdleMs: maxIdle },
    });
  }

  return candidates;
}

function isHighValueFinding(candidate) {
  return (
    candidate.confidence >= ANALYSIS_THRESHOLDS.minConfidence &&
    candidate.usabilityImprovementPercent >= ANALYSIS_THRESHOLDS.minUsabilityImpact &&
    candidate.performanceImprovementPercent >= ANALYSIS_THRESHOLDS.minPerformanceImpact
  );
}

function buildFindingDedupKey(finding) {
  const pattern = finding.evidence?.pattern || 'unknown';
  return `${pattern}::${finding.issue.trim().toLowerCase()}::${finding.recommendation.trim().toLowerCase()}`;
}

function validateFindings(candidates) {
  const accepted = [];
  const rejected = [];
  const seenKeys = new Set();

  for (const candidate of candidates) {
    if (!isHighValueFinding(candidate)) {
      rejected.push({ reason: 'weak_suggestion', candidate });
      continue;
    }

    const dedupKey = buildFindingDedupKey(candidate);
    if (seenKeys.has(dedupKey)) {
      rejected.push({ reason: 'duplicate_finding', candidate });
      continue;
    }

    seenKeys.add(dedupKey);
    accepted.push(candidate);
  }

  return { accepted, rejected };
}

function analyze(events) {
  const normalizedEvents = normalizeEvents(events);
  if (!normalizedEvents.length) {
    return {
      findings: [
        {
          issue: 'No event data available',
          rootCause: 'No recorded behavior to evaluate.',
          recommendation: 'No improvement needed',
          impact: 0,
          usabilityImprovementPercent: 0,
          performanceImprovementPercent: 0,
          confidence: 0.9,
          status: 'open',
          evidence: { reason: 'empty_event_store' },
        },
      ],
      summary: {
        analyzedEvents: 0,
        analyzedSessions: 0,
        acceptedFindings: 0,
        rejectedFindings: 0,
        message: 'No improvement needed',
      },
    };
  }

  const sessions = groupEventsBySession(normalizedEvents);
  const allCandidates = [];
  for (const [sessionId, sessionEvents] of sessions.entries()) {
    if (sessionEvents.length < ANALYSIS_THRESHOLDS.minSessionEventsForSuggestions) {
      continue;
    }
    allCandidates.push(...createCandidateFindings(sessionId, extractBehaviorSignals(sessionEvents)));
  }

  const validation = validateFindings(allCandidates);
  const highValueFindings = validation.accepted.map((finding) => ({ ...finding, status: 'open' }));

  if (!highValueFindings.length) {
    return {
      findings: [
        {
          issue: 'Current user flow appears optimal for observed behavior',
          rootCause: 'Detected friction remained below acceptance thresholds.',
          recommendation: 'No improvement needed',
          impact: 0,
          usabilityImprovementPercent: 0,
          performanceImprovementPercent: 0,
          confidence: 0.85,
          status: 'open',
          evidence: { reason: 'no_high_value_candidates', thresholds: ANALYSIS_THRESHOLDS },
        },
      ],
      summary: {
        analyzedEvents: normalizedEvents.length,
        analyzedSessions: sessions.size,
        acceptedFindings: 0,
        rejectedFindings: validation.rejected.length,
        message: 'No improvement needed',
      },
    };
  }

  return {
    findings: highValueFindings,
    summary: {
      analyzedEvents: normalizedEvents.length,
      analyzedSessions: sessions.size,
      acceptedFindings: highValueFindings.length,
      rejectedFindings: validation.rejected.length,
      message: 'High-value improvements identified',
    },
  };
}

module.exports = {
  analyze,
  validateFindings,
};
