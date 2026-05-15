# OpenClaw2026_Aanoval_CareClaw

## Project Description

CareClaw is an autonomous multi-agent healthcare workflow system built for OpenClaw Agenthon Indonesia 2026.

The project coordinates patient intake, symptom structuring, red-flag escalation, payment gating, doctor briefing, post-consultation documentation, patient education, and doctor-approved final delivery. It is designed to reduce unstructured patient chat before a medical consultation while keeping doctors as the final decision makers.

CareClaw is not a replacement for doctors. It is a workflow agent system that helps collect, structure, route, and prepare information so doctors can work faster and patients can receive clearer instructions.

## Submission Name

```text
OpenClaw2026_Aanoval_CareClaw
```

## Repository

```text
https://github.com/aanoval/OpenClaw2026_Aanoval_CareClaw
```

## Live Demo

```text
https://webdr.id
```

## Demo Video Name

```text
OpenClaw2026_Aanoval_CareClaw
```

## Pitch Deck

```text
pitch/OpenClaw2026_Aanoval_CareClaw.pdf
```

## What The Demo Shows

- A patient starts an anonymous consultation.
- The intake agent asks clinically useful follow-up questions.
- The autonomous handoff task structures the complaint into a doctor-ready workflow artifact.
- The planner routes the workspace through symptom extraction, safety checks, payment gating, and doctor briefing.
- The payment agent controls consultation unlock state.
- Doctor approval remains required before final patient-facing medical instructions are delivered.

## Why This Is An Agent System

CareClaw is not only a conversational UI. The system exposes agent behavior through:

- a shared workspace
- an autonomous loop
- dynamic planner decisions
- agent-to-agent handoff messages
- tool-backed workflow actions
- payment and approval gates
- traceable task completion

The autonomous consultation handoff task can be tested with:

```bash
npm install
npm run demo:handoff -- "Saya demam dan batuk sejak 3 hari, badan lemas."
```

The full deterministic agent workflow can be tested with:

```bash
npm run demo:agents
npm run demo:scenario -- normal
npm run demo:scenario -- red-flag
npm run test:approval-gate
```

The Docker workflow can be tested with:

```bash
docker compose up --build
```

## AI Tools And Models Used

- OpenClaw-style agent workspace and orchestration
- OpenAI-compatible LLM runtime adapter
- TypeScript autonomous workflow runtime
- Node.js API service
- Docker Compose deployment
- DOKU-compatible payment adapter design
- Mobile-first PWA frontend

## Safety Boundaries

- The system does not diagnose patients.
- The system does not prescribe medication directly to patients.
- Prescription output is draft-only.
- Patient-facing final delivery requires doctor approval.
- Red-flag cases are escalated for urgent doctor review.
- Public demo credentials and private production prompts are not included in this repository.

