import type { ConsultationState } from './types.js';

export function createDemoState(): ConsultationState {
  return {
    consultation_id: 'demo-consultation-001',
    status: 'created',
    symptoms: [],
    redFlags: [],
    paymentPaid: false,
    doctorApproved: false,
    doctorMessages: [],
    audit: ['consultation.created']
  };
}
