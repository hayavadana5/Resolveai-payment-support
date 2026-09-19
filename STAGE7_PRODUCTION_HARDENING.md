# ResolveAI Stage 7 — Production Hardening

Stage 7 turns the autonomous teammate platform into a safer, more resilient hackathon-grade system.

## Security
- Helmet security headers and disabled `X-Powered-By`.
- Request IDs for traceability.
- Global API rate limiting plus stricter login/email/callback limits.
- Sensitive auth/portal/intake responses are marked `no-store`.
- JWT claims are validated after signature verification.
- Production startup rejects weak/missing JWT and email-ingest secrets.
- Existing backend-only secrets remain server-side.
- Existing Zod validation, role authorization, policy enforcement and audit redaction remain in place.

## Reliability
- n8n has a bounded request timeout and explicit fallback labelling.
- Email intake is idempotent on the unique external `messageId`.
- Action retries remain governed by `MAX_ACTION_ATTEMPTS` and policy evaluation.
- Verification remains a separate gate; a successful workflow response is not treated as proof of business outcome.
- Human approval continues to satisfy policy only through the existing controlled tool path.

## Operational traceability
Every request gets an `X-Request-ID`. Audit events preserve the AI/human/system actor distinction, while credential-like fields are redacted before persistence.

## Production checklist
1. Set a 32+ character random `JWT_SECRET`.
2. Set a 16+ character random `EMAIL_INGEST_SECRET`.
3. Restrict `CORS_ORIGIN` to the deployed frontend origin(s).
4. Configure MongoDB with authentication and TLS.
5. Configure Gemini, Cognee and n8n secrets only in backend environment variables.
6. Use HTTPS for deployed frontend/backend and n8n callbacks.
7. Run `npm test` and `npm run build` before the demo.
