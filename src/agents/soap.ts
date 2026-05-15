import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, SoapNote } from '../types.js';

export function createSoapDraft() {
  return {
    subjective: 'Patient reports fever and cough for three days.',
    objective: 'No objective findings recorded in demo mode.',
    assessment: 'Doctor review required.',
    plan: 'Prepare doctor-reviewed final instructions.'
  };
}

export function runSoapGenerationAgent(state: ConsultationState): AgentResult<SoapNote> {
  const output: SoapNote = {
    subjective: `Patient reports ${state.symptoms.length > 0 ? state.symptoms.join(', ') : 'symptoms requiring clarification'} for ${state.duration || 'an unspecified duration'}.`,
    objective: 'No objective findings recorded in this remote demo workflow.',
    assessment: state.redFlags.length > 0 ? 'Red flag symptoms require urgent doctor attention.' : 'Doctor assessment required before final instructions.',
    plan: 'Doctor reviews the consultation, approves patient education, and decides whether medication instructions are appropriate.'
  };

  return createAgentResult('soap', 'soap.created', output, ['soap.subjective.created', 'soap.plan.created']);
}
