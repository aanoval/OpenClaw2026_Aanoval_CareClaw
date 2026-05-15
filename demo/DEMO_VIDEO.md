# Demo Video Guide

Video name:

```text
OpenClaw2026_Aanoval_CareClaw
```

Maximum duration: 2 minutes.

## Suggested Flow

### 0:00-0:15 - Problem

Show the product name and explain the problem:

Patients often send messy, incomplete chat messages before online consultations. Doctors lose time collecting basic context before they can make medical decisions.

### 0:15-0:35 - Patient Intake

Show the patient chat flow:

- patient enters a complaint
- intake agent asks follow-up questions
- the UI stays patient-friendly and does not expose internal agent terms

### 0:35-0:55 - Autonomous Agent Handoff

Show the backend trace or agent process panel:

- intake creates a handoff task
- symptom extraction structures clinical context
- red-flag logic checks urgency
- orchestrator updates the workspace

### 0:55-1:15 - Payment Gate

Show payment workflow:

- payment agent offers a method
- consultation remains locked while unpaid
- successful payment unlocks doctor access

### 1:15-1:40 - Doctor Workflow

Show doctor-facing flow:

- doctor sees structured patient briefing
- doctor can chat with the patient
- assistant output is only a draft
- doctor approval is required

### 1:40-2:00 - Final Delivery

Show final value:

- patient receives approved instructions
- doctors remain the final medical decision makers
- CareClaw improves workflow, not replaces clinical judgment

## Short Voiceover Script

CareClaw is an autonomous multi-agent healthcare workflow system for OpenClaw Agenthon Indonesia 2026.

Instead of acting as a single chatbot, CareClaw coordinates specialized agents for intake, symptom extraction, payment gating, doctor briefing, SOAP drafting, patient education, and final delivery.

A patient starts with a simple complaint. The intake agent asks follow-up questions and prepares the case for a doctor. The autonomous loop then updates a shared workspace, chooses the next agent, checks red flags, creates a payment gate, and prepares a doctor-ready handoff.

Payment remains part of the workflow. Doctor access is locked until payment is verified.

After consultation, post-consultation agents draft documentation and patient education, but the final result is blocked until the doctor reviews and approves it.

CareClaw does not replace doctors. AI handles the workflow. Doctors make the medical decisions.

