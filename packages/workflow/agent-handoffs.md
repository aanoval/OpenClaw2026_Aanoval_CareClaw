# Agent Handoffs

Each handoff should be explicit.

```text
Orchestrator -> Initial Patient Agent
Initial Patient Agent -> Symptom Extraction Agent
Symptom Extraction Agent -> Billing and Payment Agent
Billing and Payment Agent -> Doctor Briefing Agent
Doctor Briefing Agent -> Doctor Chat
Doctor Chat -> Post-Consultation Orchestrator
Post-Consultation Orchestrator -> Doctor Final Review Agent
Doctor Final Review Agent -> Final Delivery Agent
```
