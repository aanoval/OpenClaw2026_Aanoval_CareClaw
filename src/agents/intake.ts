import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, IntakeOutput } from '../types.js';

export function runIntake(message: string) {
  return {
    chief_complaint: message,
    needs_more_info: false,
    event: 'intake.completed'
  };
}

export function runIntakeAgent(message: string, state: ConsultationState): AgentResult<IntakeOutput> {
  const normalized = message.trim();
  const output: IntakeOutput = {
    chief_complaint: normalized || 'Patient needs consultation',
    conversation_ready: normalized.length > 0,
    suggested_questions: [
      'When did the symptom start?',
      'Is it getting better, worse, or staying the same?',
      'Do you have any warning symptoms such as difficulty breathing or severe pain?'
    ]
  };

  return createAgentResult('intake', 'intake.completed', output, [
    'intake.chief_complaint.collected',
    output.conversation_ready ? 'intake.conversation.ready' : 'intake.conversation.needs_message'
  ]);
}
