# Schema-First Output

Agents should return structured data that can be validated before it changes workflow state.

## Rules

- Prefer JSON-compatible outputs.
- Keep free text inside named fields.
- Validate required fields before emitting events.
- Treat invalid output as a workflow error.
