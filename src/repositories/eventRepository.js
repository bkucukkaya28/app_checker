'use strict';

const { run, all } = require('../db/sqlite');

async function insertEvent(db, event) {
  return run(
    db,
    `INSERT INTO events (
      session_id,
      event_type,
      page_url,
      element_selector,
      event_timestamp,
      metadata_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      event.sessionId,
      event.eventType,
      event.pageUrl || null,
      event.elementSelector || null,
      event.eventTimestamp,
      event.metadata ? JSON.stringify(event.metadata) : null,
      Date.now(),
    ]
  );
}

async function insertEventsBulk(db, events) {
  if (!events.length) return { inserted: 0 };

  await run(db, 'BEGIN TRANSACTION');
  try {
    for (const event of events) {
      await insertEvent(db, event);
    }
    await run(db, 'COMMIT');
    return { inserted: events.length };
  } catch (error) {
    await run(db, 'ROLLBACK');
    throw error;
  }
}

function fetchAllEvents(db) {
  return all(db, 'SELECT * FROM events ORDER BY event_timestamp ASC');
}

module.exports = {
  insertEvent,
  insertEventsBulk,
  fetchAllEvents,
};
