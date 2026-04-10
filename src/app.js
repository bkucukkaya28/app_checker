'use strict';

const express = require('express');
const { createEventsRouter } = require('./routes/events');
const { createAnalysisRouter } = require('./routes/analysis');
const { createFindingsRouter } = require('./routes/findings');
const { createHealthRouter } = require('./routes/health');

function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use(createEventsRouter(db));
  app.use(createAnalysisRouter(db));
  app.use(createFindingsRouter(db));
  app.use(createHealthRouter());

  return app;
}

module.exports = { createApp };
