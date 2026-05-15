import type { ConsultationState } from './types.js';

export class ConsultationStateStore {
  private states = new Map<string, ConsultationState>();

  create(state: ConsultationState): ConsultationState {
    this.states.set(state.consultation_id, state);
    return state;
  }

  get(consultationId: string): ConsultationState {
    const state = this.states.get(consultationId);
    if (!state) throw new Error(`Consultation state not found: ${consultationId}`);
    return state;
  }

  update(consultationId: string, patch: Partial<ConsultationState>): ConsultationState {
    const next = {
      ...this.get(consultationId),
      ...patch
    };
    this.states.set(consultationId, next);
    return next;
  }

  appendAudit(consultationId: string, audit: string[]): ConsultationState {
    const current = this.get(consultationId);
    return this.update(consultationId, {
      audit: [...current.audit, ...audit]
    });
  }
}
