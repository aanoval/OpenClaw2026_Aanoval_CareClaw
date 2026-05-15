export function extractSymptoms(message: string) {
  const symptoms = ['fever', 'cough'].filter((symptom) => message.toLowerCase().includes(symptom));
  return {
    symptoms,
    severity: 'unknown',
    red_flags: [],
    event: 'symptoms.extracted'
  };
}
