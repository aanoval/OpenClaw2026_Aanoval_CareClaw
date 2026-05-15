# Event-Driven Execution

CareClaw agents communicate through explicit workflow events.

## Rules

- Receive one task event.
- Read scoped context.
- Produce one result event.
- Avoid hidden direct handoffs.
- Keep transitions auditable.
