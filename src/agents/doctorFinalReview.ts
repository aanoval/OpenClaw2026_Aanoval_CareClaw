export function approveFinalReview() {
  return {
    status: 'approved',
    approved: true,
    patient_delivery_allowed: true,
    event: 'doctor.approved'
  };
}
