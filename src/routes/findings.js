'use strict';

const express = require('express');
const { FINDING_STATUSES } = require('../config/constants');
const { fetchAllFindings, updateFindingStatus } = require('../repositories/findingRepository');

function createFindingsRouter(db) {
  const router = express.Router();

  router.get('/findings', async (_req, res) => {
    try {
      const rows = await fetchAllFindings(db);
      const findings = rows.map((finding) => ({
        id: finding.id,
        issue: finding.issue,
        rootCause: finding.root_cause,
        recommendation: finding.recommendation,
        impact: finding.impact,
        usabilityImprovementPercent: finding.usability_improvement_percent,
        performanceImprovementPercent: finding.performance_improvement_percent,
        confidence: finding.confidence,
        status: finding.status,
        analysisTimestamp: finding.analysis_timestamp,
        evidence: finding.evidence_json ? JSON.parse(finding.evidence_json) : null,
      }));

      return res.status(200).json({ count: findings.length, findings });
    } catch (error) {
      console.error('GET /findings failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.patch('/findings/:id/status', async (req, res) => {
    try {
      const findingId = Number(req.params.id);
      const status = String(req.body?.status || '').toLowerCase();

      if (!Number.isInteger(findingId) || findingId <= 0) {
        return res.status(400).json({ error: 'finding id must be a positive integer' });
      }
      if (!FINDING_STATUSES.has(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed values: ${Array.from(FINDING_STATUSES).join(', ')}` });
      }

      const result = await updateFindingStatus(db, findingId, status);
      if (result.changes === 0) return res.status(404).json({ error: 'Finding not found' });

      return res.status(200).json({ message: 'Finding status updated', id: findingId, status });
    } catch (error) {
      console.error('PATCH /findings/:id/status failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = { createFindingsRouter };
