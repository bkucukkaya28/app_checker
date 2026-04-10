'use strict';

const path = require('path');
const { createDatabaseConnection } = require('./db/sqlite');
const { initializeDatabase } = require('./db/migrations');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'ux_optimizer.db');

async function start() {
  const db = createDatabaseConnection(DB_PATH);

  try {
    await initializeDatabase(db);
    const app = createApp(db);

    app.listen(PORT, () => {
      console.log(`UX optimizer backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

module.exports = { start };
