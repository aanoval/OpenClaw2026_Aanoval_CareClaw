import type { ConsultationState } from './types.js';

export function needsUrgentDoctorReview(state: ConsultationState): boolean {
  return state.redFlags.length > 0 || state.severity === 'high';
}

export function redFlagRoute(state: ConsultationState): string {
  return needsUrgentDoctorReview(state) ? 'urgent_doctor_review.required' : 'standard_doctor_review.allowed';
}
