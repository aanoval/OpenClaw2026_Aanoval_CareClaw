import { appendAudit } from './agentRuntime.js';
import { decideNextAction } from './plannerAgent.js';
import { runDoctorAssistantAgent } from './agents/doctorAssistant.js';
import { runDoctorBriefingAgent } from './agents/doctorBriefing.js';
import { runDoctorFinalReviewAgent } from './agents/doctorFinalReview.js';
import { runFinalDeliveryAgent } from './agents/finalDelivery.js';
import { runIntakeAgent } from './agents/intake.js';
import { runPatientEducationAgent } from './agents/patientEducation.js';
import { runBillingPaymentAgent } from './agents/payment.js';
import { runPostConsultationOrchestrator } from './agents/postConsultationOrchestrator.js';
import { runPrescriptionDraftAgent } from './agents/prescriptionDraft.js';
import { runSoapGenerationAgent } from './agents/soap.js';
import { runSymptomExtractionAgent } from './agents/symptomExtraction.js';
import { runOrchestratorStep } from './orchestrator.js';
import { createDemoState } from './state.js';
import type { AgentId } from './agentRegistry.js';
import type { AgentResult } from './types.js';
import { addAgentMessage, addPendingTask, completeTask, createWorkspace, type CareClawWorkspace } from './workspace.js';

function recordResult(workspace: CareClawWorkspace, task: string, result: AgentResult<unknown>): void {
  workspace.state = appendAudit(workspace.state, result.audit);
  addAgentMessage(workspace, {
    from: result.agent as AgentId,
    to: 'workspace',
    intent: 'completion',
    task,
    summary: `${result.agent} emitted ${result.event}`
  });
  completeTask(workspace, task);
}

async function runAgent(task: string, workspace: CareClawWorkspace): Promise<string> {
  switch (task) {
    case 'intake.collect': {
      const result = runIntakeAgent(workspace.openingMessage, workspace.state);
      recordResult(workspace, task, result);
      workspace.state = {
        ...runOrchestratorStep(workspace.state, result.event),
        chiefComplaint: result.output.chief_complaint
      };
      addAgentMessage(workspace, {
        from: 'intake',
        to: 'symptom-extraction',
        intent: 'handoff',
        task,
        summary: `Chief complaint captured: ${result.output.chief_complaint}`
      });
      return result.event;
    }

    case 'symptoms.extract': {
      const result = runSymptomExtractionAgent(workspace.openingMessage, workspace.state);
      recordResult(workspace, task, result);
      workspace.redFlags = result.output.red_flags;
      workspace.state = {
        ...runOrchestratorStep(workspace.state, result.event),
        symptoms: result.output.symptoms,
        duration: result.output.duration,
        severity: result.output.severity,
        redFlags: result.output.red_flags
      };
      addAgentMessage(workspace, {
        from: 'symptom-extraction',
        to: result.output.red_flags.length > 0 ? 'doctor-briefing' : 'payment',
        intent: result.output.red_flags.length > 0 ? 'safety-gate' : 'handoff',
        task,
        summary: result.output.red_flags.length > 0
          ? `Red flags detected: ${result.output.red_flags.join(', ')}`
          : `Symptoms structured: ${result.output.symptoms.join(', ')}`
      });
      return result.event;
    }

    case 'payment.verify': {
      const result = runBillingPaymentAgent(workspace.state);
      recordResult(workspace, task, result);
      workspace.paymentStatus = {
        status: result.output.status === 'paid' ? 'paid' : 'pending',
        invoiceId: result.output.invoice_id
      };
      workspace.state = runOrchestratorStep(workspace.state, result.event);
      addAgentMessage(workspace, {
        from: 'payment',
        to: 'doctor-briefing',
        intent: 'tool-result',
        task,
        summary: `Payment ${result.output.status}; doctor access unlocked: ${result.output.consultation_unlocked}`
      });
      return result.event;
    }

    case 'doctor.brief': {
      const result = runDoctorBriefingAgent(workspace.state);
      recordResult(workspace, task, result);
      workspace.state = {
        ...runOrchestratorStep(workspace.state, result.event),
        doctorBrief: result.output.summary
      };
      addAgentMessage(workspace, {
        from: 'doctor-briefing',
        to: 'doctor-assistant',
        intent: 'handoff',
        task,
        summary: result.output.summary
      });
      return result.event;
    }

    case 'doctor.chat': {
      const result = runDoctorAssistantAgent(workspace.state);
      recordResult(workspace, task, result);
      workspace.state = {
        ...runOrchestratorStep(workspace.state, 'doctor.chat.ended'),
        doctorMessages: [result.output.draft_response]
      };
      addAgentMessage(workspace, {
        from: 'doctor-assistant',
        to: 'post-consultation-orchestrator',
        intent: 'handoff',
        task,
        summary: 'Doctor chat support completed and documentation can be prepared.'
      });
      return 'doctor.chat.ended';
    }

    case 'post_consultation.plan': {
      const result = runPostConsultationOrchestrator(workspace.state);
      recordResult(workspace, task, result);
      addPendingTask(workspace, {
        id: 'soap.create',
        agent: 'soap',
        status: 'pending',
        reason: 'Doctor-only SOAP documentation is required.'
      });
      addPendingTask(workspace, {
        id: 'prescription.draft',
        agent: 'prescription-draft',
        status: 'pending',
        reason: 'Medication instructions must remain doctor-reviewed drafts.'
      });
      addPendingTask(workspace, {
        id: 'patient_education.create',
        agent: 'patient-education',
        status: 'pending',
        reason: 'Patient-friendly education is required before final review.'
      });
      return result.event;
    }

    case 'soap.create': {
      const result = runSoapGenerationAgent(workspace.state);
      workspace.state = { ...workspace.state, soap: result.output };
      recordResult(workspace, task, result);
      return result.event;
    }

    case 'prescription.draft': {
      const result = runPrescriptionDraftAgent(workspace.state);
      workspace.state = { ...workspace.state, prescriptionDraft: result.output };
      recordResult(workspace, task, result);
      return result.event;
    }

    case 'patient_education.create': {
      const result = runPatientEducationAgent(workspace.state);
      workspace.state = { ...workspace.state, patientEducation: result.output };
      recordResult(workspace, task, result);
      return result.event;
    }

    case 'doctor.final_review': {
      const result = runDoctorFinalReviewAgent(workspace.state);
      recordResult(workspace, task, result);
      workspace.doctorApprovalStatus = {
        approved: result.output.approved,
        blockedReason: result.output.approved ? undefined : 'Doctor did not approve final delivery.'
      };
      workspace.state = {
        ...runOrchestratorStep(workspace.state, result.event),
        doctorApproved: result.output.approved
      };
      addAgentMessage(workspace, {
        from: 'doctor-final-review',
        to: result.output.approved ? 'final-delivery' : 'workspace',
        intent: result.output.approved ? 'handoff' : 'safety-gate',
        task,
        summary: result.output.approved ? 'Doctor approved final patient delivery.' : 'Final delivery remains blocked.'
      });
      return result.event;
    }

    case 'final.delivery': {
      const result = runFinalDeliveryAgent(workspace.state);
      recordResult(workspace, task, result);
      workspace.finalDeliveryStatus = { completed: true };
      workspace.state = {
        ...runOrchestratorStep(workspace.state, result.event),
        finalDelivery: result.output
      };
      return result.event;
    }

    default:
      throw new Error(`Unsupported autonomous task: ${task}`);
  }
}

export async function runAutonomousLoop(openingMessage: string): Promise<CareClawWorkspace> {
  const workspace = createWorkspace(createDemoState(), openingMessage);
  let guard = 0;

  while (!workspace.finalDeliveryStatus.completed) {
    if (guard++ > 20) throw new Error('Autonomous loop exceeded task guard.');
    const nextAction = decideNextAction(workspace);
    addPendingTask(workspace, {
      id: nextAction.task,
      agent: nextAction.agent,
      status: 'pending',
      reason: nextAction.reason
    });
    addAgentMessage(workspace, {
      from: 'orchestrator',
      to: nextAction.agent,
      intent: 'decision',
      task: nextAction.task,
      summary: nextAction.reason
    });
    await runAgent(nextAction.task, workspace);
  }

  return workspace;
}
