import { createDemoState, runOrchestratorStep } from './index.js';
import { runIntake } from './agents/intake.js';
import { extractSymptoms } from './agents/symptomExtraction.js';
import { runPaymentGate } from './agents/payment.js';
import { createDoctorBrief } from './agents/doctorBriefing.js';
import { approveFinalReview } from './agents/doctorFinalReview.js';
import { sendFinalDelivery } from './agents/finalDelivery.js';

let state = createDemoState();

const intake = runIntake('I have had fever and cough for three days.');
state = runOrchestratorStep(state, intake.event);

const symptoms = extractSymptoms(intake.chief_complaint);
state = { ...runOrchestratorStep(state, symptoms.event), symptoms: symptoms.symptoms };

const payment = runPaymentGate(state.consultation_id);
state = runOrchestratorStep(state, payment.event);

createDoctorBrief(state.symptoms);
state = runOrchestratorStep(state, 'doctor.brief.ready');
state = runOrchestratorStep(state, 'doctor.chat.ended');

const review = approveFinalReview();
state = runOrchestratorStep(state, review.event);

const delivery = sendFinalDelivery(state.doctorApproved);
state = runOrchestratorStep(state, delivery.event);

console.log(JSON.stringify({ state, delivery }, null, 2));
