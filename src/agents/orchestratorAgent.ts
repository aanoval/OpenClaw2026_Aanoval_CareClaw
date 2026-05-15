import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState } from '../types.js';

export interface OrchestratorOutput {
  next_event: string;
  state_patch: Partial<ConsultationState>;
  blocked_reason: string | null;
}

export function runOrchestratorAgent(state: ConsultationState): AgentResult<OrchestratorOutput> {
  let nextEvent = 'intake.requested';
  let blockedReason: string | null = null;

  if (state.status === 'intake_completed') nextEvent = 'symptoms.extraction.requested';
  if (state.status === 'symptoms_structured') nextEvent = 'payment.requested';
  if (state.status === 'payment_paid') nextEvent = 'doctor.brief.requested';
  if (state.status === 'doctor_brief_ready') nextEvent = state.redFlags.length > 0 ? 'urgent_doctor_review.required' : 'doctor.chat.requested';
  if (state.status === 'doctor_chat_ended') nextEvent = 'post_consultation.requested';
  if (state.status === 'doctor_approved') nextEvent = 'final_delivery.requested';
  if (state.status === 'final_delivery_sent') {
    nextEvent = 'workflow.completed';
    blockedReason = 'No further event is required.';
  }

  const output: OrchestratorOutput = {
    next_event: nextEvent,
    state_patch: {},
    blocked_reason: blockedReason
  };

  return createAgentResult('orchestrator', 'orchestrator.next_event.selected', output, [
    `orchestrator.next_event.${nextEvent}`
  ]);
}
