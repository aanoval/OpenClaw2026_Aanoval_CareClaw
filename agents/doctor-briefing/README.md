# Doctor Briefing Agent

## Role

Prepares concise doctor-ready summaries after intake, symptom extraction, and payment completion.

## Responsibilities

- summarize chief complaint
- highlight key symptoms
- show red flags and uncertainty
- reduce doctor reading time
- prepare consultation context

## Inputs

- intake result
- symptom extraction result
- payment status
- consultation state

## Outputs

- doctor brief
- key symptom list
- red flag summary
- readiness status for doctor chat

## Tools

- `consultation_state.read`
- `schema.validate`
- `event.emit`
- `audit_log.write`

## Safety Boundary

The Doctor Briefing Agent produces support material for doctors only.

It does not make final clinical decisions.
