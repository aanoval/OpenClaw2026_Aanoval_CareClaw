import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, DoctorAssistantOutput } from '../types.js';

export function runDoctorAssistantAgent(state: ConsultationState): AgentResult<DoctorAssistantOutput> {
  const output: DoctorAssistantOutput = {
    suggested_questions: [
      'Have you taken any medication for this symptom?',
      'Do you have allergies or chronic medical conditions?',
      'What symptoms would make you seek urgent care?'
    ],
    draft_response: 'Thank you. I will review your symptoms and ask a few follow-up questions before giving final instructions.',
    doctor_decision_required: true
  };

  return createAgentResult('doctor-assistant', 'doctor.assistant.ready', output, [
    'doctor_assistant.follow_up_questions.created',
    'doctor_assistant.decision_boundary.applied'
  ]);
}
