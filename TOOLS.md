# TOOLS

CareClaw agents use tools to interact with workflow state, payment state, audit logs, and delivery channels.

This public workspace documents sanitized tool contracts only.

Production credentials and private integrations are intentionally excluded.

## Shared Tools

### `consultation_state.read`

Reads scoped consultation state for the active task.

### `consultation_state.write`

Writes approved state transitions.

Only the orchestrator and explicitly authorized workflow components should write state.

### `schema.validate`

Validates agent output against expected schemas.

### `event.emit`

Emits workflow events between agents.

### `audit_log.write`

Writes a safe audit summary of agent activity.

Audit logs must not contain credentials, private prompts, or real patient identifiers.

### `safe_text.redact`

Redacts sensitive data before logging or returning errors.

### `agent_health.report`

Reports readiness and health status without exposing secrets.

## Payment Tools

### `mock_payment.create_invoice`

Creates a mock consultation invoice for public demo mode.

### `mock_payment.verify_status`

Returns a mock payment status such as:

```text
pending
paid
failed
```

In production, this concept maps to a real payment provider integration such as DOKU MCP Server.

## Doctor Review Tools

### `doctor_review.prepare_package`

Combines SOAP draft, prescription draft, and patient education draft into a doctor review package.

### `doctor_review.mark_approved`

Marks final content as doctor-approved.

This tool should only be called from a doctor-authorized action.

## Final Delivery Tools

### `final_delivery.send`

Sends final approved instructions to the patient.

This tool must reject draft or unapproved content.

## Tool Boundary

Agents should only receive the tools required for their role.

Payment tools should not be available to clinical drafting agents.

Final delivery tools should not be available before doctor approval.
