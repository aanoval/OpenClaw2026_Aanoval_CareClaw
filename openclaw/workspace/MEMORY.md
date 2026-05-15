# MEMORY

CareClaw memory must be scoped, minimal, and auditable.

## Memory Principle

Use only the memory needed to complete the current workflow.

Do not create unrestricted hidden memory across consultations.

## Consultation Memory

Consultation memory may include:

- consultation id
- patient messages
- voice transcript text if available
- intake result
- symptom extraction result
- payment status
- doctor briefing
- doctor chat transcript
- post-consultation drafts
- doctor approval status
- final delivery status
- audit events

## Agent Memory

Agent memory may include:

- current task id
- current input event
- retry count
- tools used
- validation result
- emitted output event

## Forbidden Memory

Never store in workspace memory:

- real patient data
- production credentials
- private prompts
- private datasets
- payment secrets
- full payment payload logs
- infrastructure access details

## Demo Data Rule

Examples must use synthetic fictional data.

If patient-like data appears in examples, it must be clearly fictional and not traceable to a real person.
