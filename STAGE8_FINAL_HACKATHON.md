# ResolveAI — Stage 8 Final Hackathon Edition

Stage 8 turns the previous stages into one judge-facing product journey.

## Judge demo

1. Open **Judge Demo**.
2. Launch **Payment captured, order missing**.
3. Watch the case move through Understand → Investigate → Memory → Risk → Decide → Act → Verify → Resolve.
4. Open the case detail to show specialist collaboration, evidence, action plan and verification proof.
5. Launch **₹50,000 refund approval** to demonstrate that policy authority stops autonomous execution and routes the case to a human.
6. Launch **Suspicious ₹45,000 transaction** to demonstrate risk-based blocking and escalation.
7. Show the **Control Plane** and Analytics to connect individual cases to measurable operational outcomes.

## Product story

ResolveAI is an autonomous financial-support teammate for a simulated fintech/payment operation. Customer emails or portal requests become cases. Specialized AI teammates investigate context, retrieve organisational memory, assess risk, evaluate policy and produce a structured recommendation. The backend—not the model—authorizes actions. n8n executes approved workflows, the verification engine proves the resulting state, and the outcome can be stored as organisational memory.

## External services

Configure Gemini, Cognee and n8n credentials in the backend environment. If they are unavailable, ResolveAI surfaces its fallback mode honestly rather than pretending an external service was used.

## Important claim boundary

The demo uses simulated fintech/payment data and controlled workflows. It does not claim access to Paytm's internal production systems unless an official hackathon integration is separately provided.
