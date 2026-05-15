import type { AgentId } from './agentRegistry.js';
import type { CareClawWorkspace, WorkspaceTask } from './workspace.js';

export interface PlannerAction {
  agent: AgentId;
  task: string;
  reason: string;
}

function action(agent: AgentId, task: string, reason: string): PlannerAction {
  return { agent, task, reason };
}

function hasCompleted(workspace: CareClawWorkspace, task: string): boolean {
  return workspace.completedTasks.some((item) => item.id === task);
}

function queuedPostTask(workspace: CareClawWorkspace): WorkspaceTask | undefined {
  return workspace.pendingTasks.find((item) =>
    ['soap.create', 'prescription.draft', 'patient_education.create'].includes(item.id)
  );
}

export function decideNextAction(workspace: CareClawWorkspace): PlannerAction {
  if (!hasCompleted(workspace, 'intake.collect')) {
    return action('intake', 'intake.collect', 'The patient timeline has not been converted into a consultation intake.');
  }

  if (!hasCompleted(workspace, 'symptoms.extract')) {
    return action('symptom-extraction', 'symptoms.extract', 'The intake needs structured symptoms, severity, and red flags.');
  }

  if (workspace.redFlags.length > 0 && !hasCompleted(workspace, 'doctor.brief')) {
    return action('doctor-briefing', 'doctor.brief', 'Red flags were detected, so the doctor needs an early safety briefing.');
  }

  if (workspace.paymentStatus.status !== 'paid') {
    return action('payment', 'payment.verify', 'Doctor access remains locked until payment is verified.');
  }

  if (!hasCompleted(workspace, 'doctor.brief')) {
    return action('doctor-briefing', 'doctor.brief', 'Payment is verified, so the doctor needs a concise briefing.');
  }

  if (!hasCompleted(workspace, 'doctor.chat')) {
    return action(
      'doctor-assistant',
      'doctor.chat',
      workspace.redFlags.length > 0
        ? 'The doctor assistant should prioritize urgent review questions.'
        : 'The doctor assistant can support follow-up questions and documentation.'
    );
  }

  if (!hasCompleted(workspace, 'post_consultation.plan')) {
    return action('post-consultation-orchestrator', 'post_consultation.plan', 'Doctor chat ended, so post-consultation tasks must be planned.');
  }

  const postTask = queuedPostTask(workspace);
  if (postTask) {
    return action(postTask.agent, postTask.id, postTask.reason);
  }

  if (!workspace.doctorApprovalStatus.approved) {
    return action('doctor-final-review', 'doctor.final_review', 'Final patient delivery is blocked until doctor approval.');
  }

  return action('final-delivery', 'final.delivery', 'Doctor approval is complete, so patient delivery can be sent.');
}
