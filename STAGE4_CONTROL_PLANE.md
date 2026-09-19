# Stage 4 — Human + AI Control Plane

This stage turns ResolveAI into an operations console for supervising autonomous AI teammates.

## Added
- `/control-plane` command center with five-second refresh
- AI teammate fleet status and workload
- live active-case queue
- pending human decision queue
- safety posture (refund ceiling, confidence floor, high-risk cases, blocked actions)
- proactive merchant signal cards
- autonomous activity stream
- `/api/operations/control-plane` aggregate endpoint

## Design principle
The model can recommend, but backend policy and authorization remain the final authority. The control plane surfaces that boundary to operators and judges.
