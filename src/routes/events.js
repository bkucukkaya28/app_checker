'use strict';

const express = require('express');
const { insertEvent, insertEventsBulk } = require('../repositories/eventRepository');

function validateEventPayload(payload) {
  const required = ['sessionId', 'eventType', 'eventTimestamp'];
  for (const key of required) {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      return `Missing required field: ${key}`;
    }
  }

  const allowedTypes = new Set(['click', 'input', 'navigation']);
  if (!allowedTypes.has(payload.eventType)) {
    return `Invalid eventType. Allowed values: ${Array.from(allowedTypes).join(', ')}`;
  }

  if (!Number.isFinite(Number(payload.eventTimestamp))) {
    return 'eventTimestamp must be a valid number (epoch ms)';
  }

  return null;
}

function createEventsRouter(db) {
  const router = express.Router();

  function mapEventPayload(payload) {
    return {
      sessionId: payload.sessionId,
      eventType: payload.eventType,
      pageUrl: payload.pageUrl,
      elementSelector: payload.elementSelector,
      eventTimestamp: Number(payload.eventTimestamp),
      metadata: payload.metadata,
    };
  }

  router.post('/events', async (req, res) => {
    try {
      const validationError = validateEventPayload(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const saved = await insertEvent(db, mapEventPayload(req.body));

      return res.status(201).json({ message: 'Event stored successfully', eventId: saved.id });
    } catch (error) {
      console.error('POST /events failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/events/bulk', async (req, res) => {
    try {
      const events = Array.isArray(req.body?.events) ? req.body.events : [];
      if (!events.length) return res.status(400).json({ error: 'events must be a non-empty array' });

      for (const payload of events) {
        const validationError = validateEventPayload(payload || {});
        if (validationError) return res.status(400).json({ error: validationError });
      }

      const result = await insertEventsBulk(db, events.map(mapEventPayload));
      return res.status(201).json({ message: 'Events stored successfully', inserted: result.inserted });
    } catch (error) {
      console.error('POST /events/bulk failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = { createEventsRouter };
