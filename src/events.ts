import type { ConsultationState, ConsultationStatus } from './types.js';

export function transition(state: ConsultationState, status: ConsultationStatus, event: string): ConsultationState {
  return {
    ...state,
    status,
    audit: [...state.audit, event]
  };
}
