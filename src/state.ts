import type { ConsultationState } from './types.js';

export function createDemoState(): ConsultationState {
  return {
    consultation_id: 'demo-consultation-001',
    status: 'created',
    symptoms: [],
    paymentPaid: false,
    doctorApproved: false,
    audit: ['consultation.created']
  };
}
