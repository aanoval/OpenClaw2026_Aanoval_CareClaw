import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, PatientEducation } from '../types.js';

export function createPatientEducationDraft() {
  return {
    patient_summary: 'Your doctor is preparing final instructions based on your consultation.',
    warning_signs: ['Seek urgent care if breathing becomes difficult.'],
    doctor_review_required: true
  };
}

export function runPatientEducationAgent(state: ConsultationState): AgentResult<PatientEducation> {
  const output: PatientEducation = {
    patient_summary: `Your symptoms include ${state.symptoms.length > 0 ? state.symptoms.join(', ') : 'symptoms that need doctor review'}. Your doctor will confirm the final advice.`,
    home_care: ['Rest as needed.', 'Drink enough fluids.', 'Monitor symptom changes.'],
    warning_signs: ['Seek urgent care if breathing becomes difficult.', 'Seek urgent care for severe chest pain or confusion.'],
    follow_up: 'Follow the doctor-approved instructions and return for care if symptoms worsen.'
  };

  return createAgentResult('patient-education', 'patient_education.created', output, [
    'patient_education.plain_language.created',
    'patient_education.warning_signs.created'
  ]);
}
