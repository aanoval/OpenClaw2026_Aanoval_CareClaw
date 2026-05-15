import { runDoctorAssistantAgent } from './agents/doctorAssistant.js';
import { runDoctorBriefingAgent } from './agents/doctorBriefing.js';
import { runDoctorFinalReviewAgent } from './agents/doctorFinalReview.js';
import { runFinalDeliveryAgent } from './agents/finalDelivery.js';
import { runIntakeAgent } from './agents/intake.js';
import { runOrchestratorAgent } from './agents/orchestratorAgent.js';
import { runPatientEducationAgent } from './agents/patientEducation.js';
import { runBillingPaymentAgent } from './agents/payment.js';
import { runPostConsultationOrchestrator } from './agents/postConsultationOrchestrator.js';
import { runPrescriptionDraftAgent } from './agents/prescriptionDraft.js';
import { runSoapGenerationAgent } from './agents/soap.js';
import { runSymptomExtractionAgent } from './agents/symptomExtraction.js';
import type { AgentResult, ConsultationState } from './types.js';

export type AgentId =
  | 'orchestrator'
  | 'intake'
  | 'symptom-extraction'
  | 'payment'
  | 'doctor-briefing'
  | 'doctor-assistant'
  | 'post-consultation-orchestrator'
  | 'soap'
  | 'prescription-draft'
  | 'patient-education'
  | 'doctor-final-review'
  | 'final-delivery';

export interface AgentRegistryEntry {
  id: AgentId;
  title: string;
  listensTo: string[];
  emits: string[];
  run: (input: string, state: ConsultationState) => AgentResult<unknown>;
}

export const agentRegistry: AgentRegistryEntry[] = [
  {
    id: 'orchestrator',
    title: 'Orchestrator Agent',
    listensTo: ['workflow.started', 'state.changed'],
    emits: ['orchestrator.next_event.selected'],
    run: (_input, state) => runOrchestratorAgent(state)
  },
  {
    id: 'intake',
    title: 'Initial Patient Agent',
    listensTo: ['intake.requested'],
    emits: ['intake.completed'],
    run: (input, state) => runIntakeAgent(input, state)
  },
  {
    id: 'symptom-extraction',
    title: 'Symptom Extraction Agent',
    listensTo: ['symptoms.extraction.requested'],
    emits: ['symptoms.extracted'],
    run: (input, state) => runSymptomExtractionAgent(input, state)
  },
  {
    id: 'payment',
    title: 'Billing and Payment Agent',
    listensTo: ['payment.requested'],
    emits: ['payment.paid'],
    run: (_input, state) => runBillingPaymentAgent(state)
  },
  {
    id: 'doctor-briefing',
    title: 'Doctor Briefing Agent',
    listensTo: ['doctor.brief.requested'],
    emits: ['doctor.brief.ready'],
    run: (_input, state) => runDoctorBriefingAgent(state)
  },
  {
    id: 'doctor-assistant',
    title: 'Doctor Assistant Agent',
    listensTo: ['doctor.chat.requested'],
    emits: ['doctor.assistant.ready'],
    run: (_input, state) => runDoctorAssistantAgent(state)
  },
  {
    id: 'post-consultation-orchestrator',
    title: 'Post-Consultation Orchestrator',
    listensTo: ['post_consultation.requested'],
    emits: ['post_consultation.tasks.created'],
    run: (_input, state) => runPostConsultationOrchestrator(state)
  },
  {
    id: 'soap',
    title: 'SOAP Generation Agent',
    listensTo: ['soap.create'],
    emits: ['soap.created'],
    run: (_input, state) => runSoapGenerationAgent(state)
  },
  {
    id: 'prescription-draft',
    title: 'Prescription Draft Agent',
    listensTo: ['prescription.draft'],
    emits: ['prescription.draft.created'],
    run: (_input, state) => runPrescriptionDraftAgent(state)
  },
  {
    id: 'patient-education',
    title: 'Patient Education Agent',
    listensTo: ['patient_education.create'],
    emits: ['patient_education.created'],
    run: (_input, state) => runPatientEducationAgent(state)
  },
  {
    id: 'doctor-final-review',
    title: 'Doctor Final Review Agent',
    listensTo: ['doctor.final_review.requested'],
    emits: ['doctor.approved'],
    run: (_input, state) => runDoctorFinalReviewAgent(state)
  },
  {
    id: 'final-delivery',
    title: 'Final Delivery Agent',
    listensTo: ['final_delivery.requested'],
    emits: ['final.sent'],
    run: (_input, state) => runFinalDeliveryAgent(state)
  }
];

export function findAgentByEvent(event: string): AgentRegistryEntry | undefined {
  return agentRegistry.find((agent) => agent.listensTo.includes(event));
}
