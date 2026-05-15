import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, SymptomExtractionOutput } from '../types.js';

export function extractSymptoms(message: string) {
  const symptoms = ['fever', 'cough'].filter((symptom) => message.toLowerCase().includes(symptom));
  return {
    symptoms,
    severity: 'unknown',
    red_flags: [],
    event: 'symptoms.extracted'
  };
}

export function runSymptomExtractionAgent(message: string, state: ConsultationState): AgentResult<SymptomExtractionOutput> {
  const lower = message.toLowerCase();
  const symptoms = ['fever', 'cough', 'sore throat', 'headache', 'nausea', 'chest pain', 'shortness of breath'].filter((symptom) =>
    lower.includes(symptom)
  );
  const redFlags = ['chest pain', 'shortness of breath'].filter((symptom) => lower.includes(symptom));
  const durationMatch = lower.match(/(\d+\s*(day|days|hour|hours|week|weeks))/);
  const output: SymptomExtractionOutput = {
    symptoms,
    duration: durationMatch?.[1] || state.duration || 'not specified',
    severity: redFlags.length > 0 ? 'high' : symptoms.length > 0 ? 'low' : 'unknown',
    red_flags: redFlags
  };

  return createAgentResult('symptom-extraction', 'symptoms.extracted', output, [
    'symptoms.structured',
    redFlags.length > 0 ? 'symptoms.red_flags.detected' : 'symptoms.red_flags.none_detected'
  ]);
}
