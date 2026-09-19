# Stage 6 — Multi-Agent AI Teammates

ResolveAI now includes a specialist collaboration layer. The specialists are evidence-producing agents; they do not directly mutate financial state. The central orchestrator remains responsible for policy enforcement and controlled actions.

## Specialists
- Payment Resolution Teammate
- Risk Investigation Teammate
- Refund Specialist Teammate
- Customer Context Teammate

## Collaboration flow
1. Load the same customer, transaction, merchant, order and recent case context.
2. Run specialist assessments in one coordinated collaboration pass.
3. Retrieve organisational memory through the existing Cognee/local-memory layer.
4. Run the independent risk engine.
5. Produce structured findings with confidence, recommendation and evidence.
6. Form an explicit consensus and identify the next owner.
7. Persist collaboration state on the case and stream a realtime consensus event.
8. Feed specialist findings into the Gemini orchestrator as decision context.

## Safety boundary
Specialists propose findings only. They do not call financial write tools. Existing backend policy, authorization and verification remain the final authority.

## Demo
Open any transaction-backed case and select **Run team review**. The case displays the four specialist cards, confidence, evidence, consensus and next owner. Selecting **Resolve with AI** runs the full autonomous lifecycle and uses the collaboration findings as additional decision context.
