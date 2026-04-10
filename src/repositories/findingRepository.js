'use strict';

const { run, all } = require('../db/sqlite');

async function replaceFindings(db, findings) {
  await run(db, 'BEGIN TRANSACTION');
  try {
    await run(db, 'DELETE FROM findings');

    for (const finding of findings) {
      await run(
        db,
        `INSERT INTO findings (
          issue,
          root_cause,
          recommendation,
          impact,
          usability_improvement_percent,
          performance_improvement_percent,
          confidence,
          status,
          analysis_timestamp,
          evidence_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finding.issue,
          finding.rootCause,
          finding.recommendation,
          finding.impact,
          finding.usabilityImprovementPercent,
          finding.performanceImprovementPercent,
          finding.confidence,
          finding.status || 'open',
          Date.now(),
          finding.evidence ? JSON.stringify(finding.evidence) : null,
        ]
      );
    }
    await run(db, 'COMMIT');
  } catch (error) {
    await run(db, 'ROLLBACK');
    throw error;
  }
}

function fetchAllFindings(db) {
  return all(db, 'SELECT * FROM findings ORDER BY analysis_timestamp DESC, id DESC');
}

function updateFindingStatus(db, findingId, status) {
  return run(
    db,
    `UPDATE findings SET status = ?, analysis_timestamp = ? WHERE id = ?`,
    [status, Date.now(), findingId]
  );
}

module.exports = {
  replaceFindings,
  fetchAllFindings,
  updateFindingStatus,
};
