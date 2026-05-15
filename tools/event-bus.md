# Event Bus Tool

## `event.emit`

Emits a workflow event after an agent completes a task.

Events make agent handoffs visible and auditable.

## Event Shape

```json
{
  "type": "consultation.intake.completed",
  "consultation_id": "demo-consultation-001",
  "agent": "intake"
}
```
