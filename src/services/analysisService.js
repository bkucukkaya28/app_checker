'use strict';

const { fetchAllEvents } = require('../repositories/eventRepository');
const { replaceFindings } = require('../repositories/findingRepository');
const { analyze } = require('../analysis/engine');

async function runAnalysis(db) {
  const events = await fetchAllEvents(db);
  const analysis = analyze(events);

  // NOTE (Future SAP BTP migration):
  // Replace local SQLite writes with CAP service transaction handling.
  await replaceFindings(db, analysis.findings);

  return analysis;
}

module.exports = {
  runAnalysis,
};
