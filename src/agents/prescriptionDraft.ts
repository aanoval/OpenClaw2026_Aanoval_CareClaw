import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, PrescriptionDraft } from '../types.js';

export function createPrescriptionDraft() {
  return {
    medication_draft: [],
    doctor_review_required: true,
    patient_delivery_allowed: false
  };
}

export function runPrescriptionDraftAgent(state: ConsultationState): AgentResult<PrescriptionDraft> {
  const output: PrescriptionDraft = {
    medication_draft: [],
    instructions: [
      'No autonomous medication is issued by this demo agent.',
      'Doctor must review and edit any medication instruction before patient delivery.'
    ],
    doctor_review_required: true,
    patient_delivery_allowed: false
  };

  return createAgentResult('prescription-draft', 'prescription.draft.created', output, [
    'prescription_draft.review_required',
    'prescription_draft.patient_delivery.blocked'
  ]);
}
