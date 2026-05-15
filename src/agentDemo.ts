import { appendAudit } from './agentRuntime.js';
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
import { runOrchestratorStep } from './orchestrator.js';
import { createDemoState } from './state.js';

let state = createDemoState();
const events: string[] = [];

function record(event: string, audit: string[]) {
  events.push(event);
  state = appendAudit(state, audit);
}

const openingMessage = 'I have had fever and cough for three days.';

record(runOrchestratorAgent(state).event, runOrchestratorAgent(state).audit);

const intake = runIntakeAgent(openingMessage, state);
record(intake.event, intake.audit);
state = {
  ...runOrchestratorStep(state, intake.event),
  chiefComplaint: intake.output.chief_complaint
};

const symptoms = runSymptomExtractionAgent(openingMessage, state);
record(symptoms.event, symptoms.audit);
state = {
  ...runOrchestratorStep(state, symptoms.event),
  symptoms: symptoms.output.symptoms,
  duration: symptoms.output.duration,
  severity: symptoms.output.severity,
  redFlags: symptoms.output.red_flags
};

const payment = runBillingPaymentAgent(state);
record(payment.event, payment.audit);
state = runOrchestratorStep(state, payment.event);

const brief = runDoctorBriefingAgent(state);
record(brief.event, brief.audit);
state = {
  ...runOrchestratorStep(state, brief.event),
  doctorBrief: brief.output.summary
};

const assistant = runDoctorAssistantAgent(state);
record(assistant.event, assistant.audit);
state = {
  ...runOrchestratorStep(state, 'doctor.chat.ended'),
  doctorMessages: [assistant.output.draft_response]
};

const post = runPostConsultationOrchestrator(state);
record(post.event, post.audit);

const soap = runSoapGenerationAgent(state);
record(soap.event, soap.audit);
state = { ...state, soap: soap.output };

const prescription = runPrescriptionDraftAgent(state);
record(prescription.event, prescription.audit);
state = { ...state, prescriptionDraft: prescription.output };

const education = runPatientEducationAgent(state);
record(education.event, education.audit);
state = { ...state, patientEducation: education.output };

const review = runDoctorFinalReviewAgent(state);
record(review.event, review.audit);
state = {
  ...runOrchestratorStep(state, review.event),
  doctorApproved: review.output.approved
};

const delivery = runFinalDeliveryAgent(state);
record(delivery.event, delivery.audit);
state = {
  ...runOrchestratorStep(state, delivery.event),
  finalDelivery: delivery.output
};

console.log(
  JSON.stringify(
    {
      workflow: 'careclaw-public-agent-demo',
      events,
      final_status: state.status,
      doctor_approved: state.doctorApproved,
      delivered: Boolean(state.finalDelivery),
      state
    },
    null,
    2
  )
);
