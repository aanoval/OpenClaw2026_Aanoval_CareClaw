import { EventBus } from './eventBus.js';
import { findAgentByEvent } from './agentRegistry.js';
import { createDemoState } from './state.js';
import { ConsultationStateStore } from './stateStore.js';
import { runOrchestratorStep } from './orchestrator.js';
import type { AgentResult, ConsultationState } from './types.js';

export interface WorkflowRunOptions {
  message: string;
  consultationId?: string;
  autoApproveDoctor?: boolean;
}

export interface WorkflowRunResult {
  state: ConsultationState;
  events: string[];
  agentResults: AgentResult<unknown>[];
}

export function runWorkflow(options: WorkflowRunOptions): WorkflowRunResult {
  const store = new ConsultationStateStore();
  const bus = new EventBus();
  const agentResults: AgentResult<unknown>[] = [];
  const state = {
    ...createDemoState(),
    consultation_id: options.consultationId || 'demo-consultation-001'
  };
  store.create(state);
  bus.publish('intake.requested', { message: options.message });

  while (bus.hasPendingEvents()) {
    const event = bus.next();
    if (!event) break;
    const current = store.get(state.consultation_id);
    const agent = findAgentByEvent(event.name);
    if (!agent) continue;

    const input = typeof event.payload === 'object' && event.payload && 'message' in event.payload ? String(event.payload.message) : options.message;
    const result = agent.run(input, current);
    agentResults.push(result);
    store.appendAudit(state.consultation_id, result.audit);

    const nextState = store.update(state.consultation_id, applyAgentResult(store.get(state.consultation_id), result));

    for (const nextEvent of routeNextEvents(nextState, result.event, options)) {
      bus.publish(nextEvent, { message: options.message });
    }
  }

  return {
    state: store.get(state.consultation_id),
    events: bus.getHistory().map((event) => event.name),
    agentResults
  };
}

function applyAgentResult(state: ConsultationState, result: AgentResult<unknown>): Partial<ConsultationState> {
  if (result.event === 'intake.completed' && hasRecord(result.output)) {
    return {
      ...runOrchestratorStep(state, result.event),
      chiefComplaint: String(result.output.chief_complaint || '')
    };
  }

  if (result.event === 'symptoms.extracted' && hasRecord(result.output)) {
    return {
      ...runOrchestratorStep(state, result.event),
      symptoms: Array.isArray(result.output.symptoms) ? result.output.symptoms.map(String) : [],
      duration: String(result.output.duration || 'not specified'),
      severity: result.output.severity === 'high' ? 'high' : result.output.severity === 'low' ? 'low' : 'unknown',
      redFlags: Array.isArray(result.output.red_flags) ? result.output.red_flags.map(String) : []
    };
  }

  if (result.event === 'payment.paid') return runOrchestratorStep(state, result.event);

  if (result.event === 'doctor.brief.ready' && hasRecord(result.output)) {
    return {
      ...runOrchestratorStep(state, result.event),
      doctorBrief: String(result.output.summary || '')
    };
  }

  if (result.event === 'doctor.assistant.ready' && hasRecord(result.output)) {
    return {
      ...runOrchestratorStep(state, 'doctor.chat.ended'),
      doctorMessages: [String(result.output.draft_response || '')]
    };
  }

  if (result.event === 'soap.created') return { ...state, soap: result.output as ConsultationState['soap'] };
  if (result.event === 'prescription.draft.created') return { ...state, prescriptionDraft: result.output as ConsultationState['prescriptionDraft'] };
  if (result.event === 'patient_education.created') return { ...state, patientEducation: result.output as ConsultationState['patientEducation'] };

  if (result.event === 'doctor.approved' && hasRecord(result.output)) {
    return {
      ...runOrchestratorStep(state, result.event),
      doctorApproved: Boolean(result.output.approved)
    };
  }

  if (result.event === 'final.sent') {
    return {
      ...runOrchestratorStep(state, result.event),
      finalDelivery: result.output as ConsultationState['finalDelivery']
    };
  }

  return state;
}

function routeNextEvents(state: ConsultationState, event: string, options: WorkflowRunOptions): string[] {
  if (event === 'intake.completed') return ['symptoms.extraction.requested'];
  if (event === 'symptoms.extracted') return ['payment.requested'];
  if (event === 'payment.paid') return ['doctor.brief.requested'];
  if (event === 'doctor.brief.ready') return ['doctor.chat.requested'];
  if (event === 'doctor.assistant.ready') return ['post_consultation.requested'];
  if (event === 'post_consultation.tasks.created') return ['soap.create', 'prescription.draft', 'patient_education.create'];
  if (['soap.created', 'prescription.draft.created', 'patient_education.created'].includes(event)) {
    if (state.soap && state.prescriptionDraft && state.patientEducation && options.autoApproveDoctor !== false) return ['doctor.final_review.requested'];
  }
  if (event === 'doctor.approved') return ['final_delivery.requested'];
  return [];
}

function hasRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
