export function createDoctorBrief(symptoms: string[]) {
  return {
    summary: `Patient reports ${symptoms.length > 0 ? symptoms.join(', ') : 'symptoms requiring clarification'}.`,
    key_points: symptoms,
    event: 'doctor.brief.ready'
  };
}
