# OpenClaw2026_Aanoval_CareClaw

Team: Aanoval
Project: CareClaw
Event: OpenClaw Agenthon Indonesia 2026

## Slide 1 - Problem Statement

Online medical consultation often starts with unstructured chat. Doctors spend valuable time reading incomplete patient stories, asking repeated basic questions, checking red flags, and preparing notes. Payment and doctor access are usually separate from clinical workflow, creating friction before the consultation even starts.

## Slide 2 - Solution Overview

CareClaw is an OpenClaw-powered multi-agent healthcare communication system. A patient starts with a mobile-first chat, the system performs structured intake, then OpenClaw orchestrates clinical handoff, payment gating, doctor briefing, and post-consultation preparation. Doctors remain the final decision makers.

## Slide 3 - AI Agent Workflow / Architecture

Patient PWA -> API -> OpenClaw Intake Bridge -> Orchestrator -> Symptom Extraction -> Safety Gate -> Payment Agent -> Doctor Briefing -> Doctor Queue -> Doctor Review.

The autonomous handoff task produces agent trace, tool calls, handoffs, payment gate status, and doctor briefing output.

## Slide 4 - Key Features & Tech Stack

- OpenClaw agent workspace and bridge
- Autonomous consultation handoff task
- Tool-call style trace and agent handoffs
- DOKU-compatible payment gate
- Patient PWA and hidden doctor workspace
- Doctor approval gate for final outputs
- Docker deployment on VPS
- Node.js, TypeScript, vanilla PWA, Nginx

## Slide 5 - Future Development / Impact

CareClaw can reduce doctor intake burden, improve consultation readiness, and make patient handoff safer. Future work includes real DOKU production payment callbacks, WhatsApp continuation, voice note intake, persistent patient history, doctor scheduling, stronger medical RAG, and deployable clinic workflows.
