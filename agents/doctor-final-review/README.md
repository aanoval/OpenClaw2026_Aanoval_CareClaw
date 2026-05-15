# Doctor Final Review Agent

## Role

Prepares the final review package for the doctor.

## Responsibilities

- combine SOAP draft
- combine prescription draft
- combine patient education draft
- label review status
- identify missing or unsafe sections
- prepare approve/edit/send controls

## Inputs

- SOAP draft
- prescription draft
- patient education draft
- consultation state

## Outputs

- review package
- missing section flags
- doctor action required status
- patient delivery allowed status

## Tools

- `doctor_review.prepare_package`
- `consultation_state.read`
- `consultation_state.write`
- `schema.validate`
- `event.emit`
- `audit_log.write`

## Safety Boundary

The Doctor Final Review Agent does not approve clinical content.

Only a doctor can approve final patient delivery.
