import type { AgentResult, ConsultationState } from './types.js';

export interface PublicAgent<TInput, TOutput> {
  name: string;
  description: string;
  run(input: TInput, state: ConsultationState): AgentResult<TOutput>;
}

export function createAgentResult<TOutput>(
  agent: string,
  event: string,
  output: TOutput,
  audit: string[]
): AgentResult<TOutput> {
  return {
    agent,
    event,
    output,
    audit: [`agent.${agent}.started`, ...audit, `agent.${agent}.completed`]
  };
}

export function appendAudit(state: ConsultationState, audit: string[]): ConsultationState {
  return {
    ...state,
    audit: [...state.audit, ...audit]
  };
}
