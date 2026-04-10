'use strict';

const { run, all } = require('./sqlite');

async function addColumnIfMissing(db, tableName, columnName, columnDDL) {
  const columns = await all(db, `PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (exists) return;

  await run(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDDL}`);
}

async function initializeDatabase(db) {
  // NOTE (Future SAP BTP migration):
  // Replace SQLite DDL/migrations with CAP CDS model deployment to SAP HANA.
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      page_url TEXT,
      element_selector TEXT,
      event_timestamp INTEGER NOT NULL,
      metadata_json TEXT,
      created_at INTEGER NOT NULL
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS findings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      impact REAL NOT NULL DEFAULT 0,
      usability_improvement_percent REAL NOT NULL,
      performance_improvement_percent REAL NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      analysis_timestamp INTEGER NOT NULL,
      evidence_json TEXT
    )`
  );

  await addColumnIfMissing(db, 'findings', 'root_cause', "TEXT NOT NULL DEFAULT 'unknown'");
  await addColumnIfMissing(db, 'findings', 'recommendation', "TEXT NOT NULL DEFAULT 'No improvement needed'");
  await addColumnIfMissing(db, 'findings', 'impact', 'REAL NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'findings', 'usability_improvement_percent', 'REAL NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'findings', 'performance_improvement_percent', 'REAL NOT NULL DEFAULT 0');

  await run(
    db,
    `CREATE INDEX IF NOT EXISTS idx_events_session_time
     ON events(session_id, event_timestamp)`
  );
}

module.exports = {
  initializeDatabase,
};
