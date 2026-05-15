# CareClaw

CareClaw is an OpenClaw-based multi-agent healthcare communication system designed to make doctor-patient communication more meaningful, efficient, and clinically structured.

It does not replace doctors. It coordinates specialized agents that help transform raw patient conversations into structured workflows for medical consultations, while keeping doctors as the final decision makers.

> Better doctor-patient communication through coordinated healthcare agents.

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

## Goals

- Reduce friction between patients and doctors
- Prevent doctors from handling unstructured patient chats
- Improve consultation efficiency
- Preserve doctor authority in clinical decisions
- Demonstrate realistic healthcare agent orchestration with OpenClaw
- Provide clear boundaries between assistance, drafting, and medical decision-making

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

Production DOKU credentials and endpoint overrides must be configured outside this public repository.

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

## Demo Command

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

## Evaluate In 5 Minutes

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
POST /login
GET  /consultation/demo
POST /consultation/start
POST /payment/chat/start
POST /payment/chat/message
GET  /payment/chat/status/:sessionId
POST /payment/mock
POST /doctor/approve
```

Doctor login is intentionally minimal for the hackathon demo and can be changed with `DOCTOR_USERNAME` and `DOCTOR_PASSWORD` environment variables.

## Status

Early hackathon project scaffold.

The current repository defines product direction, agent responsibilities, workflow state, safety boundaries, and implementation-ready documentation.

## License

MIT
