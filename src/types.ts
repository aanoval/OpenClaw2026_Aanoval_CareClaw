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
  paymentPaid: boolean;
  doctorApproved: boolean;
  audit: string[];
}
