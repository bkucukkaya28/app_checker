'use strict';

const express = require('express');
const { runAnalysis } = require('../services/analysisService');

function createAnalysisRouter(db) {
  const router = express.Router();

  router.get('/analyze', async (_req, res) => {
    try {
      const analysis = await runAnalysis(db);
      return res.status(200).json({
        message: 'Analysis completed',
        summary: analysis.summary,
        findingsGenerated: analysis.findings.length,
        findings: analysis.findings,
      });
    } catch (error) {
      console.error('GET /analyze failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = { createAnalysisRouter };
