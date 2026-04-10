'use strict';

const ANALYSIS_THRESHOLDS = {
  minConfidence: 0.71,
  minUsabilityImpact: 10.01,
  minPerformanceImpact: 10.01,
  minSessionEventsForSuggestions: 6,
  rageClicks: {
    minClicks: 4,
    windowMs: 2000,
  },
  excessiveClicksPerNav: 6,
  longIdleBetweenActionsMs: 8000,
};

const FINDING_STATUSES = new Set(['open', 'approved', 'rejected', 'implemented']);

module.exports = {
  ANALYSIS_THRESHOLDS,
  FINDING_STATUSES,
};
