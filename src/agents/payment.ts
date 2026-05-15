import { createMockInvoice, verifyMockPayment } from '../tools/mockPayment.js';
import { createAgentResult } from '../agentRuntime.js';
import type { AgentResult, ConsultationState, PaymentOutput } from '../types.js';

export function runPaymentGate(consultationId: string) {
  const invoice = createMockInvoice(consultationId);
  const payment = verifyMockPayment() as { status: PaymentOutput['status']; event: string };
  return {
    ...invoice,
    status: payment.status,
    consultation_unlocked: true,
    event: payment.event
  };
}

export function runBillingPaymentAgent(state: ConsultationState): AgentResult<PaymentOutput> {
  const invoice = createMockInvoice(state.consultation_id);
  const payment = verifyMockPayment() as { status: PaymentOutput['status']; event: string };
  const output: PaymentOutput = {
    invoice_id: invoice.invoice_id,
    status: payment.status,
    consultation_unlocked: payment.status === 'paid',
    provider: 'DOKU MCP compatible mock'
  };

  return createAgentResult('payment', 'payment.paid', output, [
    'payment.invoice.created',
    output.consultation_unlocked ? 'payment.access.unlocked' : 'payment.access.blocked'
  ]);
}
