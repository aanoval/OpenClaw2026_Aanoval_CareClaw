# Product Requirements Document

## Product Name

CareClaw

## Product Type

OpenClaw-based multi-agent healthcare communication platform.

## Problem

Online medical consultations often begin with unstructured patient messages. Doctors must spend time clarifying symptoms, extracting timelines, checking payment status, and preparing summaries before they can focus on clinical decisions.

This creates friction for patients and cognitive load for doctors.

## Product Thesis

A coordinated multi-agent system can improve healthcare communication by routing patient conversations through specialized agents before, during, and after doctor interaction.

## Target Users

### Patient

- Can start consultation immediately
- Can remain anonymous before payment
- Does not need mandatory login at first contact
- Pays before direct doctor communication
- Receives final education and instructions after doctor review

### Doctor

- Requires authenticated login
- Receives structured AI-generated briefing
- Communicates directly with patient
- Reviews and approves final medical outputs
- Remains the final clinical authority

## Primary Workflow

1. Patient starts web chat.
2. Orchestrator creates consultation state.
3. Initial Patient Agent collects the chief complaint and context.
4. Symptom Extraction Agent turns conversation into structured clinical data.
5. Billing and Payment Agent handles pre-consultation payment.
6. Doctor Briefing Agent prepares a doctor-ready summary.
7. Doctor joins direct chat with patient.
8. Doctor Assistant Agent remains available to help the doctor draft questions, responses, and documentation.
9. Doctor ends consultation.
10. Post-Consultation Orchestrator triggers SOAP, prescription draft, and patient education agents.
11. Doctor Final Review Agent prepares the final review screen.
12. Doctor reviews, edits, and approves final output.
13. Final Delivery Agent sends approved material to patient.

## Payment Integration

CareClaw will use **DOKU MCP Server** as the payment integration layer.

DOKU MCP Server connects DOKU payment APIs with AI-powered applications through the Model Context Protocol. This is aligned with CareClaw because the Billing and Payment Agent needs tool-call capability to create payment requests, check payment status, and unlock doctor access after successful payment.

### Planned DOKU MCP Use Cases

- Generate DOKU Checkout payment links for simple consultation payment
- Generate QRIS payment instructions for chat-based payment flow
- Generate Virtual Account payment instructions when needed
- Check transaction payment status
- Trigger post-payment workflow after successful payment
- Notify the Orchestrator Agent when doctor access can be unlocked

### Payment Experience

CareClaw should initially use **DOKU Checkout Payment** because it provides a hosted payment page and reduces UI complexity during the hackathon.

Future versions may support **DOKU Direct Payment** for QRIS, Virtual Account, e-wallet, or other specific payment methods directly inside the patient chat flow.

### Payment Safety

- Doctor access must remain locked until payment is verified.
- The Billing and Payment Agent must not provide medical advice.
- Payment status must be treated as workflow state, not clinical state.
- Payment callbacks or status checks must update the Orchestrator Agent.
- Failed or pending payment must not trigger Doctor Briefing Agent handoff.

## Non-Goals

- Replacing doctors
- Autonomous diagnosis
- Autonomous prescription
- Emergency triage as a standalone medical authority
- Handling regulated production medical data before compliance work is complete

## Success Criteria

- Patient can complete intake without confusion
- Doctor receives a concise structured briefing
- Payment state gates doctor access
- Doctor can review and approve all final outputs
- Red flags are detected and escalated safely
- The workflow can be demonstrated end-to-end in a hackathon setting

## Why Multi-Agent Instead of Single Chatbot?

Single chatbot systems:

- Mix all responsibilities together
- Lose context clarity
- Produce inconsistent outputs

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

This project extends OpenClaw into a healthcare-specific orchestrated multi-agent system.

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

## Frontend and Deployment Direction

CareClaw will use `webdr.id` as the product domain.

The existing `webdr.id` site will be rebuilt completely.

The frontend should be mobile-first and PWA-based. Even on desktop, the user should see a phone-like experience, such as a centered mobile mockup.

The interface should not behave like a normal menu-based website. It should feel like a guided, illustrative, gamified consultation journey.

Patient input should support:

- text chat
- voice note

OpenClaw agents should be deployable as isolated Docker containers to avoid runtime conflicts and keep agent responsibilities separated.

## Key Philosophy

> AI handles the workflow.
> Doctors handle the medical decisions.

## Final Vision

This project demonstrates how orchestrated AI agents can improve healthcare communication workflows without replacing healthcare professionals.

The goal is not to replace doctors.

The goal is to reduce friction, structure communication, and improve efficiency through specialized collaborative AI agents.

## Safety Requirements

- Every clinical output must be reviewable by a doctor
- Red flags must trigger urgent-care guidance
- Agents must avoid definitive diagnosis language
- Agents must clearly separate extracted facts from model-generated suggestions
- Patient education must be written in plain language
- Prescription drafts must never be delivered without doctor approval
