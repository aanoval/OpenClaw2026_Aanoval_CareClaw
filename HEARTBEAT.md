# HEARTBEAT

CareClaw agents should behave like autonomous workflow workers, not passive chat responders.

The heartbeat describes what the system checks repeatedly during a consultation workflow.

## Heartbeat Checks

The system should regularly check:

- whether a consultation has a valid current state
- whether patient intake is complete
- whether symptom extraction is complete
- whether red flags require escalation
- whether payment is pending, failed, or paid
- whether doctor briefing is ready
- whether doctor chat has ended
- whether post-consultation drafts are ready
- whether doctor final review is complete
- whether final delivery is allowed

## Stalled Workflow Handling

If a workflow is stalled:

```text
detect stalled state
write audit event
retry recoverable task
emit workflow_error if unrecoverable
do not bypass safety or payment gates
```

## Safety Heartbeat

Always check:

- no final diagnosis without doctor review
- no final prescription without doctor approval
- no patient delivery of draft content
- no payment bypass before doctor access
- no hidden use of private credentials in public demo mode

## Demo Mode

In public demo mode, heartbeat checks may use mock state, mock events, and mock payment status.

Mock behavior must be clearly labeled.
