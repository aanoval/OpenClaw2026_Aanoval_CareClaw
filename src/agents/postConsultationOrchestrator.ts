import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, PostConsultationOutput } from '../types.js';

export function runPostConsultationOrchestrator(state: ConsultationState): AgentResult<PostConsultationOutput> {
  const ready = state.status === 'doctor_chat_ended' || state.doctorMessages.length > 0;
  const output: PostConsultationOutput = {
    tasks: ready ? ['soap.create', 'prescription.draft', 'patient_education.create'] : [],
    ready_for_review: ready
  };

  return createAgentResult('post-consultation-orchestrator', 'post_consultation.tasks.created', output, [
    ready ? 'post_consultation.ready' : 'post_consultation.waiting_for_doctor_end',
    ...output.tasks.map((task) => `post_consultation.task.${task}`)
  ]);
}
