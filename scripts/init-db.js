'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const caPath = path.join(__dirname, '..', 'global-bundle.pem');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from your .env file.');
  }

  if (!fs.existsSync(caPath)) {
    throw new Error(
      `RDS CA certificate not found at ${caPath}. ` +
      'Download global-bundle.pem into the project root.'
    );
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      ca: fs.readFileSync(caPath, 'utf8'),
      rejectUnauthorized: true
    }
  });

  try {
    await client.connect();
    console.log('Connected to RDS PostgreSQL.');

    const schema = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'schema.sql'),
      'utf8'
    );

    const seed = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'seed.sql'),
      'utf8'
    );

    await client.query('BEGIN');

    try {
      await client.query(schema);
      await client.query(seed);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log('Database initialized successfully.');
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
});
