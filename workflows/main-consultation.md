# Main Consultation Workflow

## Goal

This workflow shows how CareClaw coordinates multiple specialized agents to transform a raw patient conversation into a structured, payment-gated, doctor-reviewed consultation flow.

The workflow is designed to demonstrate:

- autonomous agent routing
- explicit state transitions
- tool usage
- payment gating
- doctor approval boundary
- patient-friendly final delivery

## Actors

### Patient

Starts the consultation, provides symptom context, completes payment, chats with the doctor, and receives final approved instructions.

### Doctor

Reviews the AI-generated briefing, communicates directly with the patient, approves or edits final outputs, and remains the final clinical decision maker.

### Agents

- Orchestrator Agent
- Initial Patient Agent
- Symptom Extraction Agent
- Billing and Payment Agent
- Doctor Briefing Agent
- Doctor Assistant Agent
- Post-Consultation Orchestrator
- SOAP Generation Agent
- Prescription Draft Agent
- Patient Education Agent
- Doctor Final Review Agent
- Final Delivery Agent

## Workflow States

```text
created
intake_in_progress
intake_completed
symptoms_structured
payment_required
payment_pending
payment_paid
doctor_brief_ready
doctor_chat_active
doctor_chat_ended
post_consultation_processing
doctor_review_ready
doctor_approved
final_delivery_sent
workflow_error
```

## Event Flow

```text
consultation.created
  -> consultation.intake.requested
  -> consultation.intake.completed
  -> consultation.symptoms.extract.requested
  -> consultation.symptoms.extracted
  -> consultation.payment.requested
  -> consultation.payment.created
  -> consultation.payment.paid
  -> consultation.doctor_brief.requested
  -> consultation.doctor_brief.ready
  -> consultation.doctor_chat.started
  -> consultation.doctor_chat.ended
  -> consultation.post_consultation.requested
  -> consultation.soap.ready
  -> consultation.prescription_draft.ready
  -> consultation.education.ready
  -> consultation.doctor_review.ready
  -> consultation.doctor_review.approved
  -> consultation.final_delivery.requested
  -> consultation.final_delivery.sent
```

## Step-by-Step Flow

### 1. Patient Starts Consultation

The patient opens the consultation interface and sends an initial message.

The Orchestrator Agent creates a consultation state and emits:

```text
consultation.intake.requested
```

### 2. Initial Intake

The Initial Patient Agent collects:

- chief complaint
- duration
- basic symptom context
- missing clarification if needed

Output event:

```text
consultation.intake.completed
```

### 3. Symptom Structuring

The Symptom Extraction Agent converts the intake conversation into structured clinical context.

It extracts:

- reported symptoms
- duration
- severity estimate
- uncertainty
- possible red flags

Output event:

```text
consultation.symptoms.extracted
```

If red flags are detected, the workflow emits:

```text
consultation.symptoms.red_flag_detected
```

### 4. Payment Gate

The Billing and Payment Agent creates a payment request.

In demo mode, this may use a mock payment tool. In a real integration, the same workflow maps to a payment provider tool such as DOKU MCP Server.

Payment states:

```text
payment_required
payment_pending
payment_paid
payment_failed
```

Doctor access remains locked until:

```text
consultation.payment.paid
```

### 5. Doctor Briefing

After payment is verified, the Doctor Briefing Agent prepares a concise doctor-ready summary.

The summary includes:

- chief complaint
- key symptoms
- duration
- possible red flags
- patient context
- payment status

Output event:

```text
consultation.doctor_brief.ready
```

### 6. Live Doctor Chat

The doctor joins direct chat with the patient.

The Doctor Assistant Agent may help by suggesting:

- follow-up questions
- draft response ideas
- documentation notes

The doctor remains in control.

Output event after doctor ends chat:

```text
consultation.doctor_chat.ended
```

### 7. Post-Consultation Processing

The Post-Consultation Orchestrator triggers draft generation agents:

- SOAP Generation Agent
- Prescription Draft Agent
- Patient Education Agent

Each draft remains doctor-review-required.

Output events:

```text
consultation.soap.ready
consultation.prescription_draft.ready
consultation.education.ready
```

### 8. Doctor Final Review

The Doctor Final Review Agent assembles a review package.

The doctor can:

- edit
- approve
- request revision
- send final output

No patient-facing clinical output is delivered before doctor approval.

Approval event:

```text
consultation.doctor_review.approved
```

### 9. Final Delivery

The Final Delivery Agent sends doctor-approved content to the patient.

Final output may include:

- consultation summary
- home-care guidance
- medication instructions if doctor-approved
- warning signs
- follow-up recommendation

Terminal event:

```text
consultation.final_delivery.sent
```

## Payment Gate

Payment status is workflow state, not clinical state.

The payment gate controls doctor access only.

The Billing and Payment Agent must not:

- provide medical advice
- change symptom severity
- create doctor briefing content
- unlock doctor access before verified payment

## Doctor Review Gate

All final clinical outputs must pass doctor review.

The system must reject final delivery if content is:

- draft
- unapproved
- missing review status
- generated after an invalid workflow transition

## Red Flag Handling

If possible red flags appear, the workflow should:

1. preserve the red flag signal
2. notify the Orchestrator Agent
3. surface the concern to the doctor or urgent-care path
4. avoid reassuring language
5. keep the event auditable

The system should not downgrade potential urgency without doctor review.

## Terminal States

```text
final_delivery_sent
payment_failed
doctor_required_emergency_escalation
consultation_cancelled
workflow_error
```

## Demo Path

A reproducible demo can use this simplified path:

```text
patient message
  -> intake completed
  -> symptoms extracted
  -> mock payment paid
  -> doctor brief ready
  -> doctor chat ended
  -> post-consultation drafts ready
  -> doctor approved
  -> final delivery sent
```

The demo path still shows the key judging criteria:

- autonomous loop
- tool usage
- payment gate
- multi-agent handoff
- doctor approval boundary
- final patient delivery
