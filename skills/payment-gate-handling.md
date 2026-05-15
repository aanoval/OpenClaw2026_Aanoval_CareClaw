# Payment Gate Handling

CareClaw uses payment status as a workflow gate before direct doctor access.

## Rules

- Payment status is not clinical state.
- Doctor access remains locked before payment.
- Payment tools do not provide medical advice.
- Failed payment must not trigger doctor handoff.
