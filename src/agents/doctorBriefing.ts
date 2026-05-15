import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, DoctorBriefOutput } from '../types.js';

export function createDoctorBrief(symptoms: string[]) {
  return {
    summary: `Patient reports ${symptoms.length > 0 ? symptoms.join(', ') : 'symptoms requiring clarification'}.`,
    key_points: symptoms,
    event: 'doctor.brief.ready'
  };
}

export function runDoctorBriefingAgent(state: ConsultationState): AgentResult<DoctorBriefOutput> {
  const symptomText = state.symptoms.length > 0 ? state.symptoms.join(', ') : 'symptoms requiring clarification';
  const redFlagText = state.redFlags.length > 0 ? ` Red flags: ${state.redFlags.join(', ')}.` : ' No red flags detected in demo intake.';
  const output: DoctorBriefOutput = {
    summary: `Patient reports ${symptomText}. Duration: ${state.duration || 'not specified'}.${redFlagText}`,
    key_points: [
      `Chief complaint: ${state.chiefComplaint || 'not specified'}`,
      `Symptoms: ${symptomText}`,
      `Payment status: ${state.paymentPaid ? 'paid' : 'not paid'}`
    ],
    requires_attention: state.redFlags.length > 0
  };

  return createAgentResult('doctor-briefing', 'doctor.brief.ready', output, [
    'doctor_brief.summary.created',
    output.requires_attention ? 'doctor_brief.attention.required' : 'doctor_brief.standard_review'
  ]);
}
