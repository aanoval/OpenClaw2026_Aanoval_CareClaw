export type ConsultationStatus =
  | 'created'
  | 'intake_completed'
  | 'symptoms_structured'
  | 'payment_paid'
  | 'doctor_brief_ready'
  | 'doctor_chat_ended'
  | 'doctor_approved'
  | 'final_delivery_sent';

export interface ConsultationState {
  consultation_id: string;
  status: ConsultationStatus;
  symptoms: string[];
  chiefComplaint?: string;
  duration?: string;
  severity?: 'low' | 'medium' | 'high' | 'unknown';
  redFlags: string[];
  paymentPaid: boolean;
  doctorApproved: boolean;
  doctorBrief?: string;
  doctorMessages: string[];
  soap?: SoapNote;
  prescriptionDraft?: PrescriptionDraft;
  patientEducation?: PatientEducation;
  finalDelivery?: FinalDelivery;
  audit: string[];
}

export interface AgentResult<TOutput> {
  agent: string;
  event: string;
  output: TOutput;
  audit: string[];
}

export interface IntakeOutput {
  chief_complaint: string;
  conversation_ready: boolean;
  suggested_questions: string[];
}

export interface SymptomExtractionOutput {
  symptoms: string[];
  duration: string;
  severity: 'low' | 'medium' | 'high' | 'unknown';
  red_flags: string[];
}

export interface PaymentOutput {
  invoice_id: string;
  status: 'paid' | 'pending';
  consultation_unlocked: boolean;
  provider: string;
}

export interface DoctorBriefOutput {
  summary: string;
  key_points: string[];
  requires_attention: boolean;
}

export interface DoctorAssistantOutput {
  suggested_questions: string[];
  draft_response: string;
  doctor_decision_required: true;
}

export interface PostConsultationOutput {
  tasks: string[];
  ready_for_review: boolean;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface PrescriptionDraft {
  medication_draft: string[];
  instructions: string[];
  doctor_review_required: true;
  patient_delivery_allowed: false;
}

export interface PatientEducation {
  patient_summary: string;
  home_care: string[];
  warning_signs: string[];
  follow_up: string;
}

export interface FinalReviewOutput {
  approved: boolean;
  merged_sections: string[];
  patient_delivery_allowed: boolean;
}

export interface FinalDelivery {
  channel: 'demo';
  delivered_sections: string[];
  message: string;
}
