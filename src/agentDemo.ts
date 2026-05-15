import { runAutonomousLoop } from './autonomousLoop.js';

const openingMessage = 'I have had fever and cough for three days.';
const workspace = await runAutonomousLoop(openingMessage);

console.log(
  JSON.stringify(
    {
      workflow: 'careclaw-public-autonomous-workspace-demo',
      final_status: workspace.state.status,
      doctor_approved: workspace.doctorApprovalStatus.approved,
      delivered: workspace.finalDeliveryStatus.completed,
      pending_tasks: workspace.pendingTasks,
      completed_tasks: workspace.completedTasks.map((task) => task.id),
      agent_messages: workspace.agentMessages,
      red_flags: workspace.redFlags,
      payment_status: workspace.paymentStatus,
      state: workspace.state
    },
    null,
    2
  )
);
