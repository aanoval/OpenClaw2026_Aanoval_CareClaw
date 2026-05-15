# CareClaw

CareClaw is an autonomous multi-agent healthcare workflow system for OpenClaw Agenthon Indonesia 2026.

It coordinates patient intake, symptom structuring, payment gating, doctor briefing, SOAP generation, patient education, and doctor-approved final delivery.

It does not replace doctors. AI handles the workflow; doctors make the medical decisions.

> Better doctor-patient communication through coordinated healthcare agents.

## Judge Quick Start

Run the autonomous multi-agent workflow:

```bash
npm install
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

Build the patient PWA:

```bash
npm run build
```

Expected demo result:

```json
{
  "workflow": "careclaw-public-agent-demo",
  "final_status": "final_delivery_sent",
  "doctor_approved": true,
  "delivered": true,
  "events": [
    "orchestrator.next_event.selected",
    "intake.completed",
    "symptoms.extracted",
    "payment.paid",
    "doctor.brief.ready",
    "soap.created",
    "patient_education.created",
    "doctor.approved",
    "final.sent"
  ]
}
```

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

The public agent demo uses deterministic mock payment for judge reproducibility. The deployed API and production adapter support DOKU-compatible QRIS and Virtual Account flows through private credentials configured outside this public repository.

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

The multi-agent demo emits a workflow event log and final consultation state so judges can verify autonomous agent execution from intake to doctor-approved delivery.

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

The same compose file can run an OpenClaw gateway with a CareClaw workspace:

```bash
cd deploy
cp openclaw.env.example .env.openclaw
docker-compose -f docker-compose.webdr.yml up -d --build careclaw-openclaw
docker-compose -f docker-compose.webdr.yml --profile check run --rm careclaw-openclaw-check
```

`.env.openclaw` must stay private and should provide the OpenAI-compatible provider values for the selected model gateway.

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
