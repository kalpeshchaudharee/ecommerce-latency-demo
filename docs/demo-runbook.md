# 25-minute conference demo runbook

## 0:00–2:30 — Hook

Show the application.

Say:

"Your dashboard is green. Your users are still complaining. Now what?"

Create a few normal orders.

---

## 2:30–6:00 — Explain the application

Architecture:

Browser
→ EC2 ecommerce service
→ Lambda payment service
→ RDS PostgreSQL

Then introduce telemetry:

EC2 application
→ OpenTelemetry
→ CloudWatch

Explain:
- metrics
- logs
- traces
- service/dependency context

---

## 6:00–10:00 — Establish healthy state

Show:
- request rate
- duration
- errors
- dependency view
- a healthy trace

Point out that the system is not just "up"; we can see how a request moves through dependencies.

---

## 10:00–13:00 — Break it

Click "Introduce latency".

Generate 5–10 checkout requests.

Do not immediately reveal the cause.

Ask the audience:

"CPU looks okay. The service is reachable. The database is available. So why are customers waiting?"

---

## 13:00–17:00 — Investigate manually

1. Application Signals/service view.
2. Request duration.
3. Trace.
4. Find the slow database operation.
5. Copy trace_id.
6. Find the same trace_id in logs.

Narration:

"Metrics told us what changed. The trace told us where. The log gave us context."

---

## 17:00–21:30 — CloudWatch Omni

Move to Omni.

Ask natural-language questions.

Examples:

"Which service or dependency is contributing most to the increase in request duration?"

"Which service is affected by the latency increase?"

"Show the telemetry associated with the slow requests."

Show the generated SQL/PromQL when useful.

Emphasize:
- AI is helping explore telemetry.
- It is not changing infrastructure.
- It is not replacing observability fundamentals.

---

## 21:30–25:00 — Close

Disable the demo latency.

Return to healthy state.

Closing:

"We started with a simple customer problem: the application was slow.

Metrics told us what changed.
Traces showed us where.
Logs gave us context.
OpenTelemetry connected the application telemetry.
CloudWatch gave us the observability platform.
And CloudWatch Omni gave us a more natural way to interact with that telemetry.

Don't just collect telemetry. Design it for context.

Instrument once. Correlate everything. Ask better questions."
