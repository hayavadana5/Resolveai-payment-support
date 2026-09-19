# Stage 5 — Real-time Autonomous Execution

ResolveAI now exposes a server-sent event stream for each case. The AI teammate publishes lifecycle, action, workflow, verification and final status events while a case is executing.

## End-to-end execution

1. Case is accepted by the AI teammate.
2. Investigation and memory retrieval are streamed as lifecycle events.
3. Risk and decision stages are recorded.
4. Each controlled action emits RUNNING and SUCCESS/FAILED events.
5. n8n invocation emits STARTED/COMPLETED events; fallback execution is explicitly labelled.
6. n8n can POST a signed callback to `/api/intake/n8n/callback` for asynchronous workflow updates.
7. Verification publishes the checks used to prove the resulting state.
8. The final resolution is streamed to the Case Detail screen.

## Live stream

`GET /api/realtime/cases/:caseId/stream?token=<JWT>`

The frontend uses this stream on the case page and keeps the most recent 30 events in the live activity panel.

## n8n callback

POST `/api/intake/n8n/callback` with `X-N8N-Callback-Secret` equal to `N8N_WEBHOOK_SECRET`:

```json
{
  "caseId": "CASE-...",
  "workflow": "refund",
  "status": "SUCCESS",
  "message": "Refund completed",
  "data": { "reference": "REF-..." }
}
```

This is intentionally a status/event callback. ResolveAI remains responsible for policy, authorization and final verification.
