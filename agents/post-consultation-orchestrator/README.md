# Post-Consultation Orchestrator

## Role

Coordinates post-consultation draft generation after the doctor ends live chat.

## Responsibilities

- trigger SOAP draft generation
- trigger prescription draft preparation
- trigger patient education drafting
- track draft readiness
- prepare the workflow for doctor final review

## Inputs

- doctor chat ended event
- consultation state
- draft readiness events

## Outputs

- SOAP request
- prescription draft request
- patient education request
- doctor review package readiness event

## Tools

- `consultation_state.read`
- `consultation_state.write`
- `schema.validate`
- `event.emit`
- `audit_log.write`

## Safety Boundary

The Post-Consultation Orchestrator does not approve or deliver final patient content.

It only coordinates draft preparation.
