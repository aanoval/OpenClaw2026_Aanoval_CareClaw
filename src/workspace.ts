import type { AgentId } from './agentRegistry.js';
import type { ConsultationState } from './types.js';

export type WorkspaceTaskStatus = 'pending' | 'completed';

export interface WorkspaceTask {
  id: string;
  agent: AgentId;
  status: WorkspaceTaskStatus;
  reason: string;
}

export interface AgentMessage {
  from: AgentId;
  to: AgentId | 'workspace' | 'doctor' | 'patient';
  intent: 'handoff' | 'decision' | 'tool-result' | 'safety-gate' | 'completion';
  summary: string;
  task?: string;
}

export interface CareClawWorkspace {
  state: ConsultationState;
  patientTimeline: string[];
  agentMessages: AgentMessage[];
  pendingTasks: WorkspaceTask[];
  completedTasks: WorkspaceTask[];
  redFlags: string[];
  paymentStatus: {
    status: 'unpaid' | 'pending' | 'paid';
    invoiceId?: string;
  };
  doctorApprovalStatus: {
    approved: boolean;
    blockedReason?: string;
  };
  finalDeliveryStatus: {
    completed: boolean;
    blockedReason?: string;
  };
  openingMessage: string;
}

export function createWorkspace(state: ConsultationState, openingMessage: string): CareClawWorkspace {
  return {
    state,
    patientTimeline: [openingMessage],
    agentMessages: [],
    pendingTasks: [],
    completedTasks: [],
    redFlags: [],
    paymentStatus: { status: 'unpaid' },
    doctorApprovalStatus: { approved: false, blockedReason: 'Doctor has not approved final delivery.' },
    finalDeliveryStatus: { completed: false, blockedReason: 'Final delivery has not started.' },
    openingMessage
  };
}

export function addAgentMessage(workspace: CareClawWorkspace, message: AgentMessage): void {
  workspace.agentMessages.push(message);
}

export function addPendingTask(workspace: CareClawWorkspace, task: WorkspaceTask): void {
  if (!workspace.pendingTasks.some((item) => item.id === task.id)) {
    workspace.pendingTasks.push(task);
  }
}

export function completeTask(workspace: CareClawWorkspace, taskId: string): void {
  const task = workspace.pendingTasks.find((item) => item.id === taskId) || workspace.completedTasks.find((item) => item.id === taskId);
  if (!task) return;
  workspace.pendingTasks = workspace.pendingTasks.filter((item) => item.id !== taskId);
  if (!workspace.completedTasks.some((item) => item.id === taskId)) {
    workspace.completedTasks.push({ ...task, status: 'completed' });
  }
}
