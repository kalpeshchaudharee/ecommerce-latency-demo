'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();

  const schema = fs.readFileSync(
    path.join(__dirname, '..', 'db', 'schema.sql'),
    'utf8'
  );

  const seed = fs.readFileSync(
    path.join(__dirname, '..', 'db', 'seed.sql'),
    'utf8'
  );

  await client.query(schema);
  await client.query(seed);

  console.log('Database initialized.');
  await client.end();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
