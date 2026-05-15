import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const agents = [
  {
    id: 'orchestrator',
    title: 'Orchestrator Agent',
    role: 'Coordinates consultation state, routes events, and prevents invalid workflow transitions.',
    tools: ['consultation-state', 'event-bus', 'audit-log'],
    skills: ['state-machine-reasoning', 'event-driven-execution', 'approval-gate-checking'],
    output: ['next_event', 'state_patch', 'blocked_reason']
  },
  {
    id: 'intake',
    title: 'Initial Patient Agent',
    role: 'Collects chief complaint and prepares the patient conversation for clinical structuring.',
    tools: ['consultation-state', 'patient-message-buffer'],
    skills: ['empathetic-intake', 'question-selection', 'low-friction-conversation'],
    output: ['chief_complaint', 'conversation_ready', 'suggested_questions']
  },
  {
    id: 'symptom-extraction',
    title: 'Symptom Extraction Agent',
    role: 'Transforms patient text into structured symptoms, duration, severity, and red flags.',
    tools: ['consultation-state', 'clinical-red-flag-rules'],
    skills: ['schema-first-output', 'clinical-signal-extraction', 'red-flag-detection'],
    output: ['symptoms', 'duration', 'severity', 'red_flags']
  },
  {
    id: 'payment',
    title: 'Billing and Payment Agent',
    role: 'Creates a consultation payment gate and unlocks doctor access after verified payment.',
    tools: ['mock-payment', 'doku-mcp-contract', 'consultation-state'],
    skills: ['payment-gate-handling', 'transaction-status-checking', 'access-control'],
    output: ['invoice_id', 'status', 'consultation_unlocked', 'provider']
  },
  {
    id: 'doctor-briefing',
    title: 'Doctor Briefing Agent',
    role: 'Converts structured intake into a concise doctor-ready briefing.',
    tools: ['consultation-state', 'brief-builder'],
    skills: ['clinical-summarization', 'noise-reduction', 'decision-support-boundaries'],
    output: ['summary', 'key_points', 'requires_attention']
  },
  {
    id: 'doctor-assistant',
    title: 'Doctor Assistant Agent',
    role: 'Assists doctors during live consultation without replacing doctor decisions.',
    tools: ['consultation-state', 'draft-response-helper'],
    skills: ['follow-up-question-generation', 'doctor-draft-support', 'safe-medical-language'],
    output: ['suggested_questions', 'draft_response', 'doctor_decision_required']
  },
  {
    id: 'post-consultation-orchestrator',
    title: 'Post-Consultation Orchestrator',
    role: 'Starts documentation, education, and draft medication workflows after the doctor ends chat.',
    tools: ['event-bus', 'consultation-state', 'audit-log'],
    skills: ['parallel-task-routing', 'workflow-readiness-checking', 'review-package-coordination'],
    output: ['tasks', 'ready_for_review']
  },
  {
    id: 'soap',
    title: 'SOAP Generation Agent',
    role: 'Creates doctor-visible SOAP documentation from the consultation context.',
    tools: ['consultation-state', 'soap-template'],
    skills: ['soap-formatting', 'clinical-documentation', 'doctor-only-output'],
    output: ['subjective', 'objective', 'assessment', 'plan']
  },
  {
    id: 'prescription-draft',
    title: 'Prescription Draft Agent',
    role: 'Prepares editable medication instruction drafts that always require doctor approval.',
    tools: ['consultation-state', 'medication-instruction-template'],
    skills: ['draft-only-prescribing', 'instruction-formatting', 'approval-gate-checking'],
    output: ['medication_draft', 'instructions', 'doctor_review_required', 'patient_delivery_allowed']
  },
  {
    id: 'patient-education',
    title: 'Patient Education Agent',
    role: 'Converts doctor-reviewed clinical context into patient-friendly education.',
    tools: ['consultation-state', 'education-template'],
    skills: ['plain-language-health-education', 'warning-sign-generation', 'safe-medical-language'],
    output: ['patient_summary', 'home_care', 'warning_signs', 'follow_up']
  },
  {
    id: 'doctor-final-review',
    title: 'Doctor Final Review Agent',
    role: 'Assembles SOAP, education, and draft instructions into a doctor approval package.',
    tools: ['consultation-state', 'doctor-approval-gate'],
    skills: ['review-package-assembly', 'approval-gate-checking', 'patient-delivery-control'],
    output: ['approved', 'merged_sections', 'patient_delivery_allowed']
  },
  {
    id: 'final-delivery',
    title: 'Final Delivery Agent',
    role: 'Delivers only doctor-approved consultation results to the patient.',
    tools: ['final-delivery', 'audit-log', 'consultation-state'],
    skills: ['delivery-readiness-checking', 'patient-facing-summarization', 'audit-safe-output'],
    output: ['channel', 'delivered_sections', 'message']
  }
];

function mdList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function schema(agent) {
  return `${JSON.stringify({
    title: `${agent.title} Output`,
    type: 'object',
    required: agent.output,
    properties: Object.fromEntries(agent.output.map((key) => [key, { description: `${key} generated by ${agent.title}` }]))
  }, null, 2)}\n`;
}

for (const agent of agents) {
  const dir = path.join('agents', agent.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'IDENTITY.md'), `# ${agent.title} Identity\n\n${agent.role}\n\n## Boundaries\n\n- The agent supports healthcare communication workflow only.\n- The agent does not replace licensed clinicians.\n- The agent must produce structured, reviewable output.\n- Patient-facing medical instructions require doctor approval before delivery.\n`);
  await writeFile(path.join(dir, 'SYSTEM_PROMPT.public.md'), `# ${agent.title} Public System Prompt\n\nYou are ${agent.title} in the CareClaw multi-agent healthcare communication workflow.\n\nYour responsibility: ${agent.role}\n\nFollow these rules:\n\n- Use structured outputs that match the published schema.\n- Keep clinical language cautious and reviewable.\n- Escalate uncertainty instead of inventing clinical facts.\n- Never claim to diagnose, prescribe, or approve final medical decisions.\n- Preserve auditability by naming the event you produce.\n`);
  await writeFile(path.join(dir, 'MEMORY.md'), `# ${agent.title} Memory\n\n## Allowed Memory\n\n- Current consultation state fields required for this agent task.\n- Synthetic demo inputs used for reproducible local runs.\n- Workflow events generated during the current run.\n\n## Disallowed Memory\n\n- Real patient identifiers.\n- Real credentials or payment secrets.\n- Private model prompts or private datasets.\n- Data from unrelated consultations.\n`);
  await writeFile(path.join(dir, 'TOOLS.md'), `# ${agent.title} Tools\n\n${mdList(agent.tools)}\n\nTool usage must be deterministic in the public demo and replaceable by production adapters.\n`);
  await writeFile(path.join(dir, 'SKILLS.md'), `# ${agent.title} Skills\n\n${mdList(agent.skills)}\n`);
  await writeFile(path.join(dir, 'OUTPUT_SCHEMA.json'), schema(agent));
  await writeFile(path.join(dir, 'EXAMPLES.md'), `# ${agent.title} Examples\n\n## Example Output Fields\n\n${mdList(agent.output)}\n\nThe public demo uses synthetic consultation data only.\n`);
}

console.log(`Generated ${agents.length} public agent workspaces.`);
