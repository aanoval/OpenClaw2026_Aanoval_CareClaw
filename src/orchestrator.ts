import { transition } from './events.js';
import type { ConsultationState } from './types.js';

export function runOrchestratorStep(state: ConsultationState, event: string): ConsultationState {
  switch (event) {
    case 'intake.completed':
      return transition(state, 'intake_completed', 'consultation.intake.completed');
    case 'symptoms.extracted':
      return transition(state, 'symptoms_structured', 'consultation.symptoms.extracted');
    case 'payment.paid':
      return { ...transition(state, 'payment_paid', 'consultation.payment.paid'), paymentPaid: true };
    case 'doctor.brief.ready':
      return transition(state, 'doctor_brief_ready', 'consultation.doctor_brief.ready');
    case 'doctor.chat.ended':
      return transition(state, 'doctor_chat_ended', 'consultation.doctor_chat.ended');
    case 'doctor.approved':
      return { ...transition(state, 'doctor_approved', 'consultation.doctor_review.approved'), doctorApproved: true };
    case 'final.sent':
      if (!state.doctorApproved) throw new Error('Final delivery requires doctor approval');
      return transition(state, 'final_delivery_sent', 'consultation.final_delivery.sent');
    default:
      throw new Error(`Unsupported event: ${event}`);
  }
}
