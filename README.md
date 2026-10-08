# From Telemetry to Intelligence — AWS CloudWatch Omni Demo

A small full-stack e-commerce application designed for a live DevOps observability demo.

## Demo architecture

Browser
  -> Node.js E-commerce API on Amazon EC2
      -> AWS Lambda "payment-service"
      -> Amazon RDS for PostgreSQL
      -> OpenTelemetry instrumentation
      -> CloudWatch / Application Signals / Logs / Metrics
      -> CloudWatch Omni

The application deliberately supports a controlled database-latency switch. This lets you demonstrate:

1. Healthy application.
2. Customer-facing latency regression.
3. Infrastructure metrics that do not immediately explain the problem.
4. Application telemetry and dependency visibility.
5. Trace/log correlation using trace_id.
6. PromQL / Logs Insights exploration.
7. CloudWatch Omni natural-language investigation.

## Important

This repository does NOT contain AWS credentials, real secrets, or an RDS endpoint.

For the conference demo, use a dedicated AWS account or demo environment and keep the database private.

---

# 1. Run locally first

Requirements:
- Node.js 20+
- Docker Desktop

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`.

Then:

```bash
npm run db:init
npm run dev
```

Open:

http://localhost:3000

The local application uses PostgreSQL and a local mock payment service by default.

To exercise the application:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/products
curl -X POST http://localhost:3000/api/demo/failure -H "Content-Type: application/json" -d '{"enabled":true}'
curl http://localhost:3000/api/demo/status
```

The demo failure switch causes checkout/order queries to execute `pg_sleep()` before the database operation. This is deliberate and only for the demo.

---

# 2. AWS target architecture

For the final AWS demo:

- Amazon EC2: Node.js application
- Amazon RDS for PostgreSQL: products/orders
- AWS Lambda: payment dependency
- Amazon CloudWatch: telemetry platform
- CloudWatch Application Signals: application-centric service/dependency signals
- OpenTelemetry: application instrumentation and context propagation
- CloudWatch Logs Insights: log investigation
- PromQL: metric investigation where enabled
- CloudWatch Omni: AI-powered telemetry exploration

Do not add EKS, ECS or X-Ray for this demo. Keeping the architecture small makes the observability story clearer.

---

# 3. Recommended EC2 setup

Use Amazon Linux 2023.

Install:

```bash
sudo dnf update -y
sudo dnf install -y git nodejs npm postgresql15
node --version
npm --version
```

Clone/copy this project to the EC2 instance.

Install:

```bash
npm ci
```

Create `.env`:

```bash
cp .env.example .env
```

Set:

```dotenv
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://<username>:<password>@<rds-endpoint>:5432/ecommerce

AWS_REGION=<your-region>
PAYMENT_FUNCTION_NAME=ecommerce-payment-service
USE_AWS_LAMBDA=true

DEMO_DB_DELAY_MS=0

OTEL_SERVICE_NAME=ecommerce-web
OTEL_SERVICE_VERSION=1.0.0
OTEL_DEPLOYMENT_ENVIRONMENT=demo
```

Initialize the database:

```bash
npm run db:init
```

Start:

```bash
npm start
```

For a persistent process, use systemd or PM2. For a conference demo, systemd is preferable because it is one less moving part.

---

# 4. RDS

Create an RDS PostgreSQL instance in the same VPC as EC2.

Recommended demo settings:
- PostgreSQL
- Small burstable instance suitable for a temporary demo
- Private subnet
- Public access: No
- Security group: allow TCP/5432 ONLY from the EC2 security group
- Automated backups: according to your demo policy
- Deletion protection: disable for a disposable demo environment

Create the schema:

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
```

The application creates:
- products
- orders
- order_items

---

# 5. Lambda payment dependency

The Lambda source is under:

`lambda/payment-service/index.js`

The function accepts:

```json
{
  "orderId": "uuid",
  "amount": 129.99,
  "currency": "USD"
}
```

and returns a simulated authorization.

Deploy the Lambda using the AWS console, SAM, CDK or your preferred pipeline.

For the live observability demo, enable CloudWatch Application Signals/OpenTelemetry on the Lambda function through the CloudWatch/Lambda console.

Set:

```text
PAYMENT_DEMO_DELAY_MS=0
```

Do not hard-code credentials.

---

# 6. OpenTelemetry

The Node application uses OpenTelemetry SDK + auto-instrumentation.

Instrumentation is loaded before the Express application:

```bash
node -r ./otel.js server.js
```

The npm start script already does this.

The instrumentation covers the application and common libraries such as HTTP and PostgreSQL.

For AWS telemetry delivery, use the CloudWatch/ADOT setup appropriate for your EC2 environment. Do not assume the local console exporter is the production path.

The repository keeps application instrumentation separate from the AWS-specific telemetry transport so you can demonstrate the concept clearly.

---

# 7. Demo sequence

## Stage A — Healthy

1. Open the e-commerce UI.
2. Browse products.
3. Add an item to cart.
4. Checkout several times.
5. Show CloudWatch/Application Signals.
6. Show request rate, errors and duration.
7. Open a trace and identify:
   - ecommerce-web
   - payment Lambda
   - PostgreSQL dependency

Say:

> "At this point, the application is healthy. But the interesting question is whether our telemetry gives us enough context to explain the next problem."

## Stage B — Introduce the failure

Enable:

```bash
curl -X POST http://localhost:3000/api/demo/failure \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
```

On EC2 use the same endpoint against the EC2 application.

Now perform several checkout requests.

The checkout path executes a controlled PostgreSQL delay.

The intended effect:

```text
Browser
  -> EC2 ecommerce-web
      -> Lambda payment-service
      -> RDS PostgreSQL  <-- intentional latency
```

## Stage C — Show the misleading infrastructure view

Show:
- EC2 CPU
- EC2 memory
- request volume
- database availability

The point is that CPU may remain normal while user-facing latency increases.

Say:

> "This is where infrastructure monitoring alone can mislead us. The host is not necessarily unhealthy. The application is."

## Stage D — Follow the request

Use Application Signals / CloudWatch telemetry to find the affected service and dependency.

Show the request duration increasing.

Open a representative trace.

Expected conceptual trace:

```text
ecommerce-web
  ├── payment-service Lambda
  └── PostgreSQL
        └── slow DB operation
```

The exact visual representation depends on the current AWS telemetry configuration.

## Stage E — Correlate logs

The application logs include:

- trace_id
- span_id
- service.name
- request path
- duration
- order ID

Search CloudWatch Logs Insights for the trace ID.

Example query:

```sql
fields @timestamp, level, service, trace_id, span_id, message, duration_ms
| filter trace_id = "<TRACE_ID>"
| sort @timestamp asc
```

The key message:

> "Metrics told us what changed. The trace told us where. The log gave us context."

## Stage F — PromQL

Where PromQL is enabled for the telemetry source, use a query appropriate to the metrics available in your environment.

Example conceptual query:

```promql
histogram_quantile(
  0.95,
  sum by (le, service_name) (
    rate(http_server_request_duration_bucket[5m])
  )
)
```

Important: metric names differ by instrumentation/export configuration. Inspect the available labels and metric names in your environment before using the query live.

## Stage G — CloudWatch Omni

Move to Omni only after you have manually shown the telemetry.

Ask questions such as:

> "Which service or dependency is contributing most to the increase in request duration?"

> "Which service is affected by the latency increase?"

> "Show the telemetry associated with the slow requests."

> "What changed in the application's request duration?"

Omni can use natural language to draft/run SQL or PromQL queries against available telemetry. Verify the generated query and explain what it is doing rather than treating the AI answer as authoritative.

---

# 8. The key conference narrative

Use this sequence:

```text
Metrics
   ↓
What changed?

Traces
   ↓
Where did it happen?

Logs
   ↓
What was happening?

OpenTelemetry
   ↓
How do we connect the application context?

CloudWatch
   ↓
Where do we observe it?

CloudWatch Omni
   ↓
How can we interact with that telemetry more naturally?
```

Your talk is NOT about an autonomous remediation agent.

The distinction from the other ACD workshops is:

- Workshop 1: deployment/IaC/canary
- Workshop 2: building a custom DevOps agent
- Workshop 3: autonomous incident investigation/remediation
- Your session: application observability + connected telemetry + AI-assisted exploration

---

# 9. Reset the demo

Disable the failure:

```bash
curl -X POST http://localhost:3000/api/demo/failure \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'
```

Verify:

```bash
curl http://localhost:3000/api/demo/status
```

Expected:

```json
{
  "demoDbLatencyEnabled": false
}
```

---

# 10. Files

- `server.js` — Express API + e-commerce workflow
- `otel.js` — OpenTelemetry initialization
- `public/` — frontend
- `db/schema.sql` — PostgreSQL schema
- `db/seed.sql` — demo data
- `lambda/payment-service/index.js` — payment Lambda
- `scripts/init-db.js` — database initialization
- `docker-compose.yml` — local PostgreSQL
- `.env.example` — configuration template
- `infra/` — optional AWS deployment notes/templates
