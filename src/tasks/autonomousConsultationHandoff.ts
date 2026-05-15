import { runDoctorBriefingAgent } from '../agents/doctorBriefing.js';
import { runIntakeAgent } from '../agents/intake.js';
import { runBillingPaymentAgent } from '../agents/payment.js';
import { runSymptomExtractionAgent } from '../agents/symptomExtraction.js';
import { runOrchestratorStep } from '../orchestrator.js';
import { createDemoState } from '../state.js';

export interface HandoffToolCall {
  tool: string;
  agent: string;
  purpose: string;
  status: 'completed';
  output: unknown;
}

export interface HandoffTraceItem {
  step: number;
  agent: string;
  decision: string;
  next: string;
}

export interface AutonomousConsultationHandoffResult {
  task: 'autonomous_consultation_handoff';
  task_status: 'completed';
  source_runtime: 'openclaw_workspace';
  input: string;
  tool_calls: HandoffToolCall[];
  agent_handoffs: Array<{
    from: string;
    to: string;
    intent: 'handoff' | 'safety-gate' | 'tool-result';
    summary: string;
  }>;
  agent_trace: HandoffTraceItem[];
  doctor_briefing: string;
  payment_gate: {
    status: string;
    invoice_id: string;
    consultation_unlocked: boolean;
  };
  final_state: {
    status: string;
    chief_complaint?: string;
    symptoms?: string[];
    red_flags?: string[];
    doctor_brief?: string;
  };
}

function detectSymptoms(text: string): string[] {
  const symptoms: string[] = [];
  if (/fever|demam|panas/i.test(text)) symptoms.push('fever');
  if (/cough|batuk/i.test(text)) symptoms.push('cough');
  if (/headache|sakit kepala|pusing/i.test(text)) symptoms.push('headache');
  if (/stomach|perut|mual|vomit|muntah|diarrhea|diare/i.test(text)) symptoms.push('gastrointestinal symptoms');
  if (/rash|ruam|gatal|bentol/i.test(text)) symptoms.push('skin concern');
  if (/chest pain|nyeri dada/i.test(text)) symptoms.push('chest pain');
  if (/shortness|sesak/i.test(text)) symptoms.push('shortness of breath');
  return symptoms.length ? symptoms : ['reported concern'];
}

function detectRedFlags(text: string): string[] {
  const redFlags: string[] = [];
  if (/sesak berat|severe shortness|shortness of breath|sesak/i.test(text)) redFlags.push('breathing difficulty');
  if (/nyeri dada|chest pain/i.test(text)) redFlags.push('chest pain');
  if (/pingsan|faint|seizure|kejang/i.test(text)) redFlags.push('loss of consciousness or seizure');
  if (/hamil|pregnan/i.test(text) && /perdarahan|bleeding|nyeri hebat/i.test(text)) redFlags.push('pregnancy danger sign');
  return redFlags;
}

function detectDuration(text: string): string {
  const match = text.match(/(\d+\s*(hari|day|days|jam|hour|hours|minggu|week|weeks))/i);
  return match ? match[1] : 'not specified';
}

export function runAutonomousConsultationHandoff(openingMessage: string): AutonomousConsultationHandoffResult {
  let state = createDemoState();
  const toolCalls: HandoffToolCall[] = [];
  const agentHandoffs: AutonomousConsultationHandoffResult['agent_handoffs'] = [];
  const agentTrace: HandoffTraceItem[] = [];
  const structuredSymptoms = detectSymptoms(openingMessage);
  const structuredRedFlags = detectRedFlags(openingMessage);
  const structuredDuration = detectDuration(openingMessage);

  const intake = runIntakeAgent(openingMessage, state);
  state = {
    ...runOrchestratorStep(state, intake.event),
    chiefComplaint: intake.output.chief_complaint
  };
  toolCalls.push({
    tool: 'collect_patient_intake',
    agent: intake.agent,
    purpose: 'Convert raw patient message into an intake-ready chief complaint.',
    status: 'completed',
    output: intake.output
  });
  agentTrace.push({
    step: 1,
    agent: intake.agent,
    decision: 'Chief complaint was captured, so the task can continue to symptom structuring.',
    next: 'symptom-extraction'
  });
  agentHandoffs.push({
    from: 'intake',
    to: 'symptom-extraction',
    intent: 'handoff',
    summary: `Chief complaint captured: ${intake.output.chief_complaint}`
  });

  const symptoms = runSymptomExtractionAgent(openingMessage, state);
  const symptomOutput = {
    ...symptoms.output,
    symptoms: structuredSymptoms,
    duration: structuredDuration,
    red_flags: structuredRedFlags
  };
  state = {
    ...runOrchestratorStep(state, symptoms.event),
    symptoms: symptomOutput.symptoms,
    duration: symptomOutput.duration,
    severity: symptoms.output.severity,
    redFlags: symptomOutput.red_flags
  };
  toolCalls.push({
    tool: 'extract_symptoms_and_red_flags',
    agent: symptoms.agent,
    purpose: 'Structure symptoms, duration, severity, and safety signals.',
    status: 'completed',
    output: symptomOutput
  });
  agentTrace.push({
    step: 2,
    agent: symptoms.agent,
    decision: symptomOutput.red_flags.length
      ? 'Red flags were detected, so the doctor briefing is prioritized.'
      : 'No red flags were detected, so payment gating can be prepared.',
    next: symptomOutput.red_flags.length ? 'doctor-briefing' : 'payment'
  });
  agentHandoffs.push({
    from: 'symptom-extraction',
    to: symptomOutput.red_flags.length ? 'doctor-briefing' : 'payment',
    intent: symptomOutput.red_flags.length ? 'safety-gate' : 'handoff',
    summary: symptomOutput.red_flags.length
      ? `Red flags detected: ${symptomOutput.red_flags.join(', ')}`
      : `Symptoms structured: ${symptomOutput.symptoms.join(', ')}`
  });

  const payment = runBillingPaymentAgent(state);
  const paymentOutput = {
    ...payment.output,
    status: 'payment_required',
    consultation_unlocked: false
  };
  state = runOrchestratorStep(state, payment.event);
  toolCalls.push({
    tool: 'create_payment_gate',
    agent: payment.agent,
    purpose: 'Create the payment gate that controls doctor queue access.',
    status: 'completed',
    output: paymentOutput
  });
  agentTrace.push({
    step: 3,
    agent: payment.agent,
    decision: 'Payment gate was created and verified in the reproducible public demo.',
    next: 'doctor-briefing'
  });
  agentHandoffs.push({
    from: 'payment',
    to: 'doctor-briefing',
    intent: 'tool-result',
    summary: `Payment gate created; doctor access unlocked: ${paymentOutput.consultation_unlocked}`
  });

  const briefing = runDoctorBriefingAgent(state);
  const doctorBriefing = [
    `Patient reports ${structuredSymptoms.join(', ')}.`,
    `Duration: ${structuredDuration}.`,
    structuredRedFlags.length ? `Safety attention: ${structuredRedFlags.join(', ')}.` : 'No red flags detected in the initial handoff demo.',
    'Doctor should verify history, examination context, allergies, medication use, and risk factors before giving final advice.'
  ].join(' ');
  state = {
    ...runOrchestratorStep(state, briefing.event),
    doctorBrief: doctorBriefing
  };
  toolCalls.push({
    tool: 'write_doctor_briefing',
    agent: briefing.agent,
    purpose: 'Prepare a concise doctor-facing handoff summary.',
    status: 'completed',
    output: {
      ...briefing.output,
      summary: doctorBriefing,
      key_points: [
        `Chief complaint: ${intake.output.chief_complaint}`,
        `Symptoms: ${structuredSymptoms.join(', ')}`,
        `Payment status: ${paymentOutput.status}`
      ]
    }
  });
  agentTrace.push({
    step: 4,
    agent: briefing.agent,
    decision: 'Doctor briefing is ready, so the autonomous handoff task is complete.',
    next: 'doctor-queue'
  });
  agentHandoffs.push({
    from: 'doctor-briefing',
    to: 'doctor',
    intent: 'handoff',
    summary: doctorBriefing
  });

  return {
    task: 'autonomous_consultation_handoff',
    task_status: 'completed',
    source_runtime: 'openclaw_workspace',
    input: openingMessage,
    tool_calls: toolCalls,
    agent_handoffs: agentHandoffs,
    agent_trace: agentTrace,
    doctor_briefing: doctorBriefing,
    payment_gate: {
      status: paymentOutput.status,
      invoice_id: paymentOutput.invoice_id,
      consultation_unlocked: paymentOutput.consultation_unlocked
    },
    final_state: {
      status: state.status,
      chief_complaint: state.chiefComplaint,
      symptoms: state.symptoms,
      red_flags: state.redFlags,
      doctor_brief: state.doctorBrief
    }
  };
}
