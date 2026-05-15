import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, FinalReviewOutput } from '../types.js';

export function approveFinalReview() {
  return {
    status: 'approved',
    approved: true,
    patient_delivery_allowed: true,
    event: 'doctor.approved'
  };
}

export function runDoctorFinalReviewAgent(state: ConsultationState): AgentResult<FinalReviewOutput> {
  const mergedSections = [
    state.soap ? 'soap' : '',
    state.prescriptionDraft ? 'prescription_draft' : '',
    state.patientEducation ? 'patient_education' : ''
  ].filter(Boolean);
  const approved = mergedSections.length >= 2;
  const output: FinalReviewOutput = {
    approved,
    merged_sections: mergedSections,
    patient_delivery_allowed: approved
  };

  return createAgentResult('doctor-final-review', 'doctor.approved', output, [
    'doctor_final_review.package.created',
    approved ? 'doctor_final_review.approved' : 'doctor_final_review.needs_more_sections'
  ]);
}
