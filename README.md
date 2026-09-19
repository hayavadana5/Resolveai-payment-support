# ResolveAI — Autonomous Payment Support Teammate

Track 3: Autonomous AI Teammates.

ResolveAI owns a payment-support case end to end. It reads what the customer said, digs into the payment and order records, recalls how cases like this were handled before, checks what it is allowed to do, acts through a controlled tool layer, then re-reads the system to confirm the change actually landed. If any of that fails — or the case is too risky, too expensive or too uncertain — it stops and hands a human the evidence.

It is not a chatbot. The measure of success is not a good answer; it is a **verified customer resolution**.

---

## The problem

Payment support is mostly a small set of boring, high-volume failures: a payment captured with no order behind it, a refund the customer is entitled to, a settlement that looks like a failed charge. Agents work these by hand, clicking through four systems to establish facts that are already in the database.

The tempting fix is to put an LLM in front of it. That fails in a specific way: a model that can answer confidently can also refund ₹50,000 confidently, and "the API returned 200" is not the same as "the customer got their order."

## The solution

Three commitments shape the whole system.

**The model proposes; the backend disposes.** Gemini has no database handle, no URLs and no tools of its own. It returns one structured JSON decision. Every action it names is routed through a registry that validates input, checks the caller's role, evaluates policy, executes, and writes an audit record — in that order. An unauthorised request is refused by code, not by prompt.

**Nothing is resolved on a claim.** After acting, a verification engine re-reads MongoDB and asserts the specific change it expected. Order retry has to produce an order in `CREATED` with an id; a refund has to move the refunded amount. Verification failing escalates the case even though the action reported success.

**Fallbacks are labelled, never disguised.** Gemini, Cognee and n8n can all be down. Each has a local stand-in, and the interface says plainly which one ran: `AI MODE: DEMO FALLBACK`, `MEMORY: LOCAL FALLBACK`. The system never claims a service it did not use.

---

## Architecture

```
                    React Frontend
                          │
                          ▼
                    Express API            JWT, role checks, input validation
                          │
                          ▼
                  AI Orchestrator          Gemini structured output  ·  rule fallback
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
       Cognee Memory             Policy Engine        backend-enforced, not prompt-enforced
             │                         │
             └────────────┬────────────┘
                          ▼
                  Controlled Tools        validate → authorize → policy → execute → audit
                          │
                          ▼
                    n8n Workflows         reconciliation · refund · escalation · notification
                          │
                          ▼
                       MongoDB
                          │
                          ▼
                 Verification Engine      re-reads state; never trusts a return value
                          │
                 ┌────────┴────────┐
                 ▼                 ▼
              RESOLVE           ESCALATE ─→ Human Agent
```

**Gemini never modifies MongoDB.** It cannot issue a query, reach a URL or call a tool directly. Its entire output surface is one validated JSON object naming an action the backend may or may not permit.

---

## Technology

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, React Router |
| Backend | Node.js, Express, TypeScript (strict) |
| Database | MongoDB via Mongoose |
| Reasoning | Gemini (`@google/generative-ai`), structured JSON output |
| Memory | Cognee knowledge graph, with local keyword retrieval as labelled fallback |
| Workflows | n8n Cloud webhooks |
| Auth | JWT, bcrypt, roles `SUPPORT_AGENT` and `ADMIN` |
| Tests | Jest, Supertest, `mongodb-memory-server` |

---

## Running it

Prerequisites: Node 18+, and MongoDB running locally or an Atlas connection string.

```bash
git clone <your-repo> && cd resolveai
npm run install:all

cp .env.example backend/.env
# Fill in MONGODB_URI and JWT_SECRET at minimum.
# GEMINI_API_KEY, COGNEE_* and N8N_* are optional — without them the system
# runs on labelled fallbacks rather than failing.

npm run seed          # wipes and reloads the demo world
npm run dev:backend   # http://localhost:4000
npm run dev:frontend  # http://localhost:5173
```

The backend prints which mode each integration is in at startup, and the app shows the same three badges on every page.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| `SUPPORT_AGENT` | `agent@resolveai.dev` | `Agent@12345` |
| `ADMIN` | `admin@resolveai.dev` | `Admin@12345` |

Only `ADMIN` can approve a refund above the autonomous ceiling. The agent account will be refused — that refusal is worth demonstrating.

### Environment variables

Everything lives in `backend/.env`, described in `.env.example`. The three secrets that matter — `GEMINI_API_KEY`, `COGNEE_API_KEY`, `N8N_WEBHOOK_SECRET` — are read only on the server and never serialised into an API response. `.env` is gitignored; commit only `.env.example`.

### MongoDB

Local works fine: `mongodb://127.0.0.1:27017/resolveai`. For Atlas, create a free M0 cluster, add your IP, and paste the SRV string. `npm run seed` is idempotent — it clears the collections and rebuilds them, so run it as often as you like.

### Gemini

Get a key at <https://aistudio.google.com/app/apikey>, set `GEMINI_API_KEY`. The orchestrator requests `responseMimeType: application/json` with a response schema, then validates the result with Zod before anything downstream sees it. A malformed response is treated as a Gemini failure and falls through to the rule engine rather than being half-parsed.

### Cognee

Set `COGNEE_API_URL` and `COGNEE_API_KEY`. `npm run seed` pushes the knowledge corpus in `backend/src/services/memory/knowledge.seed.ts` — payment runbooks, refund and escalation policy, merchant incident history, and resolved case write-ups — then calls cognify. During a case, the issue text plus the category and merchant id are used as the retrieval query, and whatever comes back is shown in the case UI with its source.

Without credentials, the same corpus is searched locally by keyword and the UI says `MEMORY: LOCAL FALLBACK`.

### n8n

Import the four files in `n8n/` into n8n Cloud, activate them, then set `N8N_BASE_URL` to your instance URL (e.g. `https://yourname.app.n8n.cloud`). The webhook paths default to the ones in the JSON. `N8N_WEBHOOK_SECRET` is sent as `X-ResolveAI-Signature`; add an IF node checking that header if you want the workflows to reject unsigned calls.

The backend calls these server-side only. No n8n URL or credential reaches the browser.

---

## Demo scenarios

All four are seeded and ready on the Cases page.

**1 · Payment deducted, order missing** — `CASE-DEMO01`, ₹2,499.
Investigates, finds `payment SUCCESS` against `order NOT_CREATED`, retrieves the merchant's history of exactly this synchronisation failure, reconciles, retries order creation, verifies the order now exists, notifies the customer, resolves. Roughly four seconds end to end.

**2 · Eligible refund** — `CASE-DEMO02`, ₹3,000.
Checks eligibility, confirms the amount is inside autonomous authority, refunds through the n8n workflow, verifies the refunded amount moved, notifies, resolves.

**3 · High-value refund** — `CASE-DEMO03`, ₹50,000.
This is the one to watch. The refund is *blocked by the policy engine before execution*, not talked out of by the prompt. An escalation is created carrying the investigation, the evidence and a recommended action. An admin approves it on the Escalations page; the refund then executes with the human's authority attached and is verified like any other action.

**4 · Suspicious transaction** — `CASE-DEMO04`, ₹45,000.
Risk signals from the transaction, the unverified new account and the high-risk merchant compound to `HIGH`. Retrieved knowledge says a disputed charge is a fraud case, not a refund. All autonomous financial action is blocked and the case goes to a human with the evidence attached. The money does not move.

---

## API

All routes except `/api/health` and `/api/auth/login` require `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Exchange credentials for a JWT |
| `GET` | `/api/auth/me` | Current user |
| `GET` | `/api/cases` | List cases, optionally `?status=` |
| `POST` | `/api/cases` | Open a case |
| `GET` | `/api/cases/:caseId` | Case, customer, transaction, audit trail, escalation |
| `POST` | `/api/cases/:caseId/resolve` | Hand the case to the teammate |
| `GET` | `/api/cases/meta/modes` | Which engines are live vs. fallback |
| `GET` | `/api/escalations` | Escalations with their cases attached |
| `POST` | `/api/escalations/:id/decision` | `APPROVE`, `REJECT` or `REQUEST_INFO` |
| `GET` | `/api/audit` | Audit records, filterable by case and event |
| `GET` | `/api/analytics` | Computed metrics |
| `GET` | `/api/analytics/dashboard` | Recent cases, activity, open escalations |
| `GET` | `/api/reference/{customers,merchants,transactions,tools,policies}` | Reference data |

---

## Security

- **Authentication** — bcrypt hashes, JWT with expiry. Login returns the same message for a wrong password and an unknown account, so it cannot be used to enumerate users.
- **Authorization** — route-level role guards, plus a second role check inside the tool registry. The AI caller has role `AI` and is never `ADMIN`.
- **Policy enforcement in code** — `services/policy/engine.ts` is the authority. A refund over the ceiling is refused whether the model asks nicely, asks twice, or claims the customer is angry.
- **Input validation** — every tool has a Zod schema; malformed input is rejected before any database access.
- **Secrets** — read from the environment on the server. The client bundle contains no keys.
- **Audit logging** — every decision, tool call, policy evaluation, workflow invocation, verification and human override is stored, with credential-shaped fields redacted.
- **Error handling** — stack traces and driver internals never reach the client.

What the model is structurally incapable of: arbitrary MongoDB access, arbitrary queries, arbitrary URLs, and unrestricted financial actions.

---

## Testing

```bash
npm test
```

Runs against an in-memory MongoDB, so no live database is touched. Coverage includes:

- authentication, including account enumeration resistance and role separation
- the policy engine across all five rules
- **a ₹50,000 refund is refused to the autonomous teammate** and the transaction is left untouched
- **a ₹3,000 eligible refund is processed autonomously** and the money actually moves
- verification failing when an action claims success but state did not change
- escalation creation, and an admin-approved refund executing and verifying afterwards
- the full four-scenario workflow, end to end
- analytics computed from records rather than hardcoded
- fallback honesty: with no API keys set, cases record `DEMO_FALLBACK` and `LOCAL_FALLBACK`

---

## Hackathon demo, 3–5 minutes

1. **Sign in** as the support agent. Point at the three mode badges — say out loud which services are live.
2. **`CASE-DEMO01`**, press *Resolve with AI*. Walk the six-stage spine as it fills: the retrieved merchant history, the policy check, the before/after state diff, the case turning green. This is the whole thesis in one screen.
3. **`CASE-DEMO03`**, the ₹50,000 refund. It stops. Show the escalation reason and that the transaction is untouched. Sign in as admin, approve, and show the refund executing *and being verified*.
4. **`CASE-DEMO04`**, the disputed charge. It stops for a different reason — risk, not authority — and the retrieved knowledge explains why refunding here would destroy chargeback evidence.
5. **Analytics.** Lead with verified customer resolutions and say why that number, rather than cases touched, is the one that matters.

Close on the audit trail: every step above is on the record, including the two refusals.

---

## Troubleshooting

**`MongoServerError: connect ECONNREFUSED`** — MongoDB is not running, or the Atlas IP allowlist does not include you.

**Everything says fallback** — expected with no API keys. Fill in `backend/.env` and restart the backend; the badges update on reload.

**Gemini calls fail with 400** — usually an invalid key or a model name your key cannot reach. Try `gemini-2.0-flash`. The case still completes on the rule engine.

**n8n returns 404** — the workflow is imported but not activated, or the webhook path does not match `N8N_PATH_*`. Production webhooks only respond when the workflow is active.

**Cognee search returns nothing** — run `npm run seed` again with the credentials set; retrieval needs the cognify step to have run.

**Frontend shows a blank page after login** — confirm the backend is on port 4000; the Vite dev server proxies `/api` there.

**Tests hang on first run** — `mongodb-memory-server` downloads a MongoDB binary once. Let it finish.

---

## Code layout

```
backend/src/
  config/env.ts              environment, and the is*Configured checks
  models/                    ten Mongoose models
  middleware/                JWT auth, role guards, error handling
  routes/                    auth, cases, escalations, audit, analytics, reference
  services/
    ai/                      prompt, schema, Gemini client, rule fallback, orchestrator
    memory/                  knowledge corpus, Cognee client, local fallback
    policy/                  rules and the enforcement engine
    tools/                   read tools, write tools, and the registry gate
    n8n/                     webhook client with labelled fallback
    verification/            state capture and post-action assertions
    workflow/runCase.ts      the six-stage loop
  seed/                      fixtures and the repeatable seed script
  tests/                     policy, tools, verification, workflow, API
frontend/src/
  pages/                     login, dashboard, cases, case detail, escalations, audit, analytics
  components/                layout, status and mode primitives
n8n/                         four importable workflow definitions
```

## Stage 2 — Customer + Email Experience

Stage 2 turns inbound communication into a first-class ResolveAI workflow.

### Customer portal

- `GET /customer` is a public customer-facing intake experience.
- `POST /api/portal/cases` creates a case, assigns a portal access token, and immediately hands the case to the AI teammate.
- `GET /api/portal/cases/:caseId?token=...` lets the customer track only the case for which they possess the access token.

### Email-to-case

- `POST /api/intake/email` is the production-facing inbound webhook for Gmail/Outlook/n8n.
- `X-Email-Ingest-Secret` protects the webhook.
- Email `subject` becomes the case name.
- Sender email/name become customer context.
- `messageId` is idempotent so the same email cannot create duplicate cases.
- The AI teammate can start automatically after case creation.
- `GET /api/intake/emails` is staff-authenticated and powers the Email Command Inbox.

Example n8n payload:

```json
{
  "messageId": "gmail-123456",
  "threadId": "thread-123",
  "from": "customer@example.com",
  "fromName": "Customer Name",
  "to": "support@resolveai.demo",
  "subject": "₹2,499 deducted but order missing",
  "body": "My payment succeeded but my order was not created.",
  "receivedAt": "2026-09-18T15:30:00.000Z",
  "autoRun": true
}
```

Set `EMAIL_INGEST_SECRET` in the backend environment and send the same value as `X-Email-Ingest-Secret` from n8n.

### Demo flow

Customer portal or Gmail/Outlook -> n8n -> `/api/intake/email` -> named case -> AI teammate -> recommendation -> autonomous action or human approval -> verification -> customer notification.


## Stage 3 — Autonomous Operations

This edition adds a competition-focused operational layer:

- deterministic multi-factor risk intelligence with transaction/customer/merchant/action/history components
- action-plan persistence so every AI recommendation becomes an ordered execution plan
- live case polling in the operations UI for teammate progress
- proactive merchant anomaly detection for captured payments with missing orders
- one-click creation of a system incident from a detected anomaly
- compact verified resolution summaries written back to Cognee when configured, with an explicit local fallback
- case-level risk evidence and action-plan visualization

The safety model remains backend-enforced: Gemini proposes; policy and risk controls decide whether an action may execute; controlled tools perform writes; verification must confirm the resulting state.

## Stage 7 — Production Hardening
See `STAGE7_PRODUCTION_HARDENING.md` for security, reliability, request tracing and deployment checks.
