'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { randomUUID } = require('crypto');

const app = express();
const port = Number(process.env.PORT || 3000);

const caPath = path.join(__dirname, 'global-bundle.pem');

if (!fs.existsSync(caPath)) {
  throw new Error(
    `RDS CA certificate not found at ${caPath}. ` +
    'Download global-bundle.pem into the application directory.'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: fs.readFileSync(caPath, 'utf8'),
    rejectUnauthorized: true
  },
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (error) => {
  logEvent('ERROR', 'unexpected PostgreSQL pool error', {
    error: error.message
  });
});

const lambda = new LambdaClient({
  region: process.env.AWS_REGION || 'ap-south-1'
});

let demoDbLatencyEnabled = false;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function logEvent(level, message, extra = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: process.env.OTEL_SERVICE_NAME || 'ecommerce-web',
    message,
    ...extra
  }));
}

async function maybeDelayDatabase() {
  if (!demoDbLatencyEnabled) return;

  const delayMs = Number(process.env.DEMO_DB_DELAY_MS || 2200);

  // Deliberate latency for the conference demo.
  await pool.query('SELECT pg_sleep($1)', [delayMs / 1000]);
}

async function getPaymentAuthorization(orderId, amount) {
  if (process.env.USE_AWS_LAMBDA === 'true') {
    const command = new InvokeCommand({
      FunctionName: process.env.PAYMENT_FUNCTION_NAME,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify({
        orderId,
        amount,
        currency: 'USD'
      }))
    });

    const response = await lambda.send(command);

    if (response.FunctionError) {
      throw new Error(
        `Payment Lambda failed: ${response.FunctionError}`
      );
    }

    const payload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : {};

    return payload;
  }

  // Local fallback.
  await new Promise(resolve => setTimeout(resolve, 40));

  return {
    authorized: true,
    transactionId: `local-${randomUUID()}`
  };
}

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1 AS ok');

    res.json({
      status: 'ok',
      database: result.rows[0].ok === 1,
      service: process.env.OTEL_SERVICE_NAME || 'ecommerce-web'
    });
  } catch (error) {
    logEvent('ERROR', 'health check failed', {
      error: error.message
    });

    res.status(503).json({ status: 'error' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description, price, category, image_url
      FROM products
      WHERE active = true
      ORDER BY id
    `);

    res.json(result.rows);
  } catch (error) {
    logEvent('ERROR', 'product listing failed', {
      error: error.message
    });

    res.status(500).json({
      error: 'Unable to load products'
    });
  }
});

app.post('/api/orders', async (req, res) => {
  const orderId = randomUUID();
  const { items, customer } = req.body;
  let client;

  try {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Cart is empty'
      });
    }

    client = await pool.connect();

    await client.query('BEGIN');

    const ids = items.map(item => Number(item.productId));

    const products = await client.query(
      `SELECT id, name, price
       FROM products
       WHERE id = ANY($1::int[]) AND active = true`,
      [ids]
    );

    if (products.rows.length !== ids.length) {
      throw new Error('One or more products are unavailable');
    }

    const priceById = new Map(
      products.rows.map(product => [
        product.id,
        Number(product.price)
      ])
    );

    let total = 0;

    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity || 1));
      total += priceById.get(Number(item.productId)) * quantity;
    }

    const payment = await getPaymentAuthorization(orderId, total);

    if (!payment.authorized) {
      throw new Error('Payment was declined');
    }

    // Intentional database delay for the observability demo.
    await maybeDelayDatabase();

    await client.query(
      `INSERT INTO orders
       (id, customer_name, customer_email, total_amount, payment_transaction_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        orderId,
        customer?.name || 'Demo Customer',
        customer?.email || 'demo@example.com',
        total,
        payment.transactionId || null
      ]
    );

    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity || 1));

      await client.query(
        `INSERT INTO order_items
         (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [
          orderId,
          Number(item.productId),
          quantity,
          priceById.get(Number(item.productId))
        ]
      );
    }

    await client.query('COMMIT');

    logEvent('INFO', 'order completed', {
      order_id: orderId,
      item_count: items.length,
      total_amount: total,
      demo_db_latency: demoDbLatencyEnabled
    });

    res.status(201).json({
      orderId,
      total,
      paymentTransactionId: payment.transactionId
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    logEvent('ERROR', 'order failed', {
      order_id: orderId,
      error: error.message
    });

    res.status(500).json({
      error: error.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.get('/api/demo/status', (req, res) => {
  res.json({
    demoDbLatencyEnabled,
    delayMs: Number(process.env.DEMO_DB_DELAY_MS || 2200)
  });
});

app.post('/api/demo/failure', (req, res) => {
  demoDbLatencyEnabled = req.body.enabled === true;

  logEvent('WARN', 'demo database latency changed', {
    enabled: demoDbLatencyEnabled,
    delay_ms: Number(process.env.DEMO_DB_DELAY_MS || 2200)
  });

  res.json({
    demoDbLatencyEnabled,
    delayMs: Number(process.env.DEMO_DB_DELAY_MS || 2200)
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  logEvent('INFO', 'ecommerce service started', {
    port,
    environment: process.env.NODE_ENV || 'development'
  });
});

async function shutdown() {
  logEvent('INFO', 'shutting down ecommerce service');

  await pool.end();
  lambda.destroy();

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);