import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, FinalDelivery } from '../types.js';

export function sendFinalDelivery(doctorApproved: boolean) {
  if (!doctorApproved) throw new Error('Cannot deliver unapproved content');
  return {
    status: 'sent',
    channel: 'demo',
    event: 'final.sent'
  };
}

export function runFinalDeliveryAgent(state: ConsultationState): AgentResult<FinalDelivery> {
  if (!state.doctorApproved) throw new Error('Final delivery requires doctor approval');

  const output: FinalDelivery = {
    channel: 'demo',
    delivered_sections: ['patient_summary', 'home_care', 'warning_signs', 'follow_up'],
    message: state.patientEducation?.patient_summary || 'Doctor-approved consultation instructions are ready.'
  };

  return createAgentResult('final-delivery', 'final.sent', output, [
    'final_delivery.approval.checked',
    'final_delivery.patient_message.sent'
  ]);
}
