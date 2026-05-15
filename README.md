# CareClaw

CareClaw is an autonomous multi-agent healthcare workflow system for OpenClaw Agenthon Indonesia 2026.

It coordinates patient intake, symptom structuring, payment gating, doctor briefing, SOAP generation, patient education, and doctor-approved final delivery.

It does not replace doctors. AI handles the workflow; doctors make the medical decisions.

> Better doctor-patient communication through coordinated healthcare agents.

## Quick Start

Run the autonomous multi-agent workflow:

```bash
npm install
npm run demo:agents
npm run demo:handoff
```

Run scenario-based demos:

```bash
npm run demo:scenario -- normal
npm run demo:scenario -- red-flag
npm run test:approval-gate
```

Run the Docker demo:

```bash
docker compose up --build
```

Build the patient PWA:

```bash
npm run build
```

Expected demo result:

```json
{
  "workflow": "careclaw-public-autonomous-workspace-demo",
  "final_status": "final_delivery_sent",
  "doctor_approved": true,
  "delivered": true,
  "pending_tasks": [],
  "completed_tasks": [
    "intake.collect",
    "symptoms.extract",
    "payment.verify",
    "doctor.brief",
    "doctor.chat",
    "post_consultation.plan",
    "soap.create",
    "prescription.draft",
    "patient_education.create",
    "doctor.final_review",
    "final.delivery"
  ],
  "agent_messages": [
    {
      "from": "orchestrator",
      "to": "payment",
      "intent": "decision",
      "summary": "Doctor access remains locked until payment is verified."
    }
  ]
}
```

For submission materials, see:

- [SUBMISSION.md](SUBMISSION.md)
- [Demo Video Guide](demo/DEMO_VIDEO.md)
- [Pitch Deck](pitch/OpenClaw2026_Aanoval_CareClaw.pdf)

## Overview

Most AI healthcare products use a single chatbot. CareClaw explores a different architecture:

```text
Patient Web Chat
  -> OpenClaw Gateway
  -> Orchestrator Agent
  -> Intake and Clinical Agents
  -> Billing and Payment Flow
  -> Doctor Briefing
  -> Doctor-Patient Chat
  -> Post-Consultation Agents
  -> Doctor Final Review
  -> Patient Delivery
```

The system is designed for online consultation workflows where patients need a fast path to care, and doctors need structured, relevant, and reviewable information.

## Why This Is Not a Basic Chatbot

CareClaw is not a single chat wrapper around an LLM. It is a workflow-oriented agent system with separate responsibilities, explicit state transitions, safety gates, and tool-backed actions.

The system can:

- collect patient intake
- structure symptoms and red flags
- decide whether a case needs urgent doctor review
- block doctor access until payment is verified
- prepare a doctor briefing
- draft SOAP and patient education after consultation
- prevent final delivery until doctor approval
- keep payment, doctor chat, and final delivery as separate workflow states

## Why CareClaw Is an Autonomous Multi-Agent System

CareClaw uses a shared workspace and an autonomous loop:

- agents share one workspace with patient timeline, agent messages, pending tasks, completed tasks, red flags, payment status, doctor approval status, and final delivery status
- planner agent decides the next agent dynamically from workspace state
- each agent writes handoff or safety messages back into the workspace
- the loop continues until final delivery is completed
- payment and doctor approval gates can block unsafe or unpaid transitions
- post-consultation tasks are queued as workspace tasks instead of being hidden inside one function

The public demo entry point is `src/agentDemo.ts`, which calls `runAutonomousLoop()` from `src/autonomousLoop.ts`.

## Autonomous Consultation Handoff

The main autonomous task is:

> Transform a raw patient complaint into a doctor-ready consultation handoff.

This task is intentionally different from a plain LLM chat response. It produces a completed workflow artifact with agent decisions, tool calls, handoffs, a payment gate, and a doctor briefing.

Run it locally:

```bash
npm run demo:handoff -- "Saya demam dan batuk sejak 3 hari, badan lemas."
```

Expected shape:

```json
{
  "task": "autonomous_consultation_handoff",
  "task_status": "completed",
  "source_runtime": "openclaw_workspace",
  "tool_calls": [
    { "tool": "collect_patient_intake", "agent": "intake", "status": "completed" },
    { "tool": "extract_symptoms_and_red_flags", "agent": "symptom-extraction", "status": "completed" },
    { "tool": "create_payment_gate", "agent": "payment", "status": "completed" },
    { "tool": "write_doctor_briefing", "agent": "doctor-briefing", "status": "completed" }
  ],
  "agent_handoffs": [],
  "doctor_briefing": "Patient reports fever, cough...",
  "payment_gate": {
    "status": "payment_required",
    "consultation_unlocked": false
  }
}
```

The deployed API exposes the same product surface:

```text
POST /api/agent/handoff
GET  /api/agent/tasks/:id/trace
```

The handoff endpoint makes the OpenClaw-based workflow visible as a task that reaches completion, rather than only as a conversational assistant.

Runtime design:

- patient intake chat is handled by the OpenClaw intake bridge, not by a separate manual LLM chat-completion fallback
- OpenClaw remains the runtime for every intake turn and for the final handoff orchestration
- after the configured turn limit, default `INTAKE_HANDOFF_TURN_LIMIT=10`, the system forces an intake handoff check instead of letting anamnesis run forever
- OpenClaw then runs the autonomous handoff task: symptom structuring, safety decision, payment gate, doctor briefing, and trace output
- Payment Agent owns the payment method flow after the handoff gate, so payment remains part of the agent workflow instead of being hidden in the UI

If the OpenClaw bridge is unavailable, the API can return a deterministic local fallback message, but it does not fall back to a separate direct LLM API call for intake.

## Goals

- Reduce friction between patients and doctors
- Prevent doctors from handling unstructured patient chats
- Improve consultation efficiency
- Preserve doctor authority in clinical decisions
- Demonstrate realistic healthcare agent orchestration with OpenClaw
- Provide clear boundaries between assistance, drafting, and medical decision-making

## Autonomous Agent Behaviors

CareClaw demonstrates autonomous behavior through decision points rather than a fixed chat transcript.

| Decision point | Agent behavior |
| --- | --- |
| New patient message | Orchestrator routes the event to intake and clinical structuring. |
| Missing clinical context | Intake agent asks the next useful question instead of moving forward too early. |
| Red flags detected | Symptom extraction marks urgent review and doctor-facing safety context. |
| Payment not verified | Payment agent keeps doctor access locked and follows up while pending. |
| Payment verified | Consultation is unlocked and routed into the doctor queue. |
| Doctor chat ended | Post-consultation orchestrator triggers SOAP, education, and prescription-draft agents. |
| Doctor approval missing | Final delivery remains blocked. |
| Doctor approval received | Final delivery agent sends the approved patient-facing result. |

## Core Agents

- Orchestrator Agent
- Initial Patient Agent
- Symptom Extraction Agent
- Billing and Payment Agent
- Doctor Briefing Agent
- Doctor Assistant Agent
- Post-Consultation Orchestrator
- SOAP Agent
- Prescription Draft Agent
- Patient Education Agent
- Doctor Final Review Agent
- Final Delivery Agent

## Key Principle

CareClaw agents can collect, structure, summarize, draft, and educate.

Only licensed doctors can diagnose, prescribe, approve final medical instructions, or make clinical decisions.

## Clinical Safety & Red-Flag Escalation

CareClaw keeps clinical safety explicit:

- symptom extraction records severity and red flags
- red-flag cases are routed to urgent doctor review
- prescription output is draft-only and blocked from patient delivery
- final patient instructions require doctor approval
- the public demo includes `npm run demo:scenario -- red-flag` to show escalation behavior

## Why Multi-Agent Instead of a Single Chatbot?

Single chatbot systems often mix responsibilities together, lose context clarity, and produce inconsistent outputs.

CareClaw separates responsibilities into specialized agents.

Benefits:

- Better workflow control
- More reliable outputs
- Clear orchestration
- Easier scalability
- Better explainability

## Why OpenClaw?

OpenClaw provides:

- Multi-channel communication layer
- Agent gateway architecture
- Session handling
- Tool integration
- Agent extensibility

CareClaw extends OpenClaw into a healthcare-specific orchestrated multi-agent system.

## Payment Layer

CareClaw uses a DOKU-compatible payment agent for consultation payment workflows.

The Billing and Payment Agent can chat with the patient, offer QRIS or Virtual Account options, create direct Non-SNAP VA instructions for supported banks, follow up while payment is pending, and unlock doctor access after successful payment verification.

The public agent demo uses deterministic mock payment for reproducible local runs. The deployed API and production adapter support DOKU-compatible QRIS and Virtual Account flows through private credentials configured outside this public repository.

## Key Philosophy

> AI handles the workflow.
> Doctors handle the medical decisions.

## Final Vision

CareClaw demonstrates how orchestrated AI agents can improve healthcare communication workflows without replacing healthcare professionals.

The goal is not to replace doctors.

The goal is to reduce friction, structure communication, and improve efficiency through specialized collaborative AI agents.

## Future Expansion

- WhatsApp continuation
- Persistent patient accounts
- Real payment gateway integration
- Doctor scheduling
- Multi-doctor routing
- AI follow-up monitoring
- Medical history memory
- Lab result interpretation
- Voice consultation support

## Repository Structure

```text
careclaw/
  README.md
  PRD.md
  openclaw/
    workspace/
      BOOT.md
      HEARTBEAT.md
      IDENTITY.md
      MEMORY.md
      SOUL.md
      TOOLS.md
  agents/
  apps/
    web/
    api/
  packages/
    workflow/
    schemas/
    tools/
    demo/
  schemas/
  workflows/
  examples/
  skills/
```

## Workspace Layout

CareClaw is organized as a multi-agent product repository.

The OpenClaw workspace-level identity files live under:

```text
openclaw/workspace/
```

Agent-specific documentation and implementation will live under:

```text
agents/
```

Frontend and backend application code will live under:

```text
apps/web/
apps/api/
```

Shared workflow, schema, tool, and demo code will live under:

```text
packages/
schemas/
workflows/
examples/
skills/
```

## Demo Commands

After dependencies are installed, run the deterministic consultation demo:

```bash
npm install
npm run demo
```

Run the public multi-agent autonomous demo:

```bash
npm run demo:agents
```

The demo walks through:

```text
patient intake
symptom extraction
mock payment approval
doctor briefing
doctor chat completion
doctor final approval
final delivery
```

The multi-agent demo emits workspace tasks, agent handoff messages, a workflow event log, and final consultation state so autonomous execution can be verified from intake to doctor-approved delivery.

## Docker Agent Demo

Run the public agent workflow in a container:

```bash
docker compose up --build
```

The container runs `npm run demo:agents` by default. The public Docker workflow uses deterministic mock tools and does not require private credentials.

## Additional Evaluation Commands

Run the autonomous multi-agent workflow:

```bash
npm run demo:agents
```

Run scenario-based demos:

```bash
npm run demo:scenario -- normal
npm run demo:scenario -- red-flag
npm run test:approval-gate
```

Run the Docker demo:

```bash
docker compose up --build
```

For older Compose installations:

```bash
docker-compose run --rm careclaw-agents
```

Run one agent in container mode:

```bash
AGENT_NAME=payment docker-compose run --rm careclaw-agents
```

## VPS Docker Deployment

The `deploy/docker-compose.webdr.yml` file runs the public patient PWA and API behind a host reverse proxy:

```bash
cd deploy
cp doku.env.example .env.doku
docker-compose -f docker-compose.webdr.yml up -d --build careclaw-web careclaw-api
docker-compose -f docker-compose.webdr.yml --profile check run --rm careclaw-agents-check
```

The patient flow creates DOKU-compatible QRIS or direct Virtual Account instructions and moves the patient into a waiting-for-doctor-chat state. Direct VA banks supported in the public adapter are BNI, BSI, CIMB, Danamon, Permata, BRI, and Mandiri. Real DOKU credentials should be configured only in `.env.doku`.

The same compose file runs an OpenClaw gateway with a CareClaw workspace and a private Docker-network bridge used by the API:

```bash
cd deploy
cp openclaw.env.example .env.openclaw
docker-compose -f docker-compose.webdr.yml up -d --build careclaw-openclaw careclaw-api
docker-compose -f docker-compose.webdr.yml --profile check run --rm careclaw-openclaw-check
```

`.env.openclaw` must stay private and should provide the OpenAI-compatible provider values for the selected model gateway.

The runtime connection is:

```text
Patient PWA
  -> CareClaw API
  -> OPENCLAW_AGENT_URL
  -> OpenClaw bridge inside the careclaw-openclaw container
  -> OpenClaw agent workspace
  -> patient-facing intake response
```

The API attempts the OpenClaw bridge first. If the bridge is unavailable or times out, the API falls back to the configured OpenAI-compatible adapter so the demo remains usable.

Relevant environment variables:

| Variable | Purpose |
| --- | --- |
| `OPENCLAW_AGENT_URL` | Internal Docker URL for API-to-OpenClaw intake calls, for example `http://careclaw-openclaw:18800/agent`. |
| `OPENCLAW_AGENT_TIMEOUT_MS` | API timeout for one OpenClaw intake turn. |
| `OPENCLAW_BRIDGE_PORT` | Bridge port inside the OpenClaw container. |
| `OPENCLAW_GATEWAY_PORT` | OpenClaw gateway/control port. |

## Web App Demo

Build the mobile-first PWA shell:

```bash
npm install
npm run build
```

Run the demo API locally:

```bash
npm run start:api
```

The API listens on `127.0.0.1:8050` by default and exposes:

```text
GET  /health
POST /auth/register
POST /auth/login
GET  /auth/me
GET  /history
POST /agent/handoff
GET  /agent/tasks/:id/trace
POST /login
GET  /consultation/demo
POST /consultation/start
POST /intake/start
POST /intake/message
POST /payment/chat/start
POST /payment/chat/message
GET  /payment/chat/status/:sessionId
POST /payment/mock
GET  /doctor/queue
POST /doctor/consultations/:id/claim
POST /doctor/consultations/:id/message
POST /doctor/consultations/:id/end
GET  /patient/consultations/:id
POST /patient/consultations/:id/message
POST /doctor/approve
```

Doctor login is intentionally minimal for the hackathon demo and can be changed with `DOCTOR_USERNAME` and `DOCTOR_PASSWORD` environment variables.

## Status

Hackathon-ready autonomous multi-agent prototype with deterministic public demos, Docker reproducibility, payment mock adapter, DOKU-compatible payment integration, clinical safety gates, patient PWA, doctor queue, and doctor approval workflow.

## License

MIT
