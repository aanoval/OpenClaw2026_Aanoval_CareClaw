import { createMockInvoice, verifyMockPayment } from '../tools/mockPayment.js';
import { createAgentResult } from '../agentRuntime.js';
import { DokuPaymentMock } from '../tools/dokuPaymentMock.js';
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
  const paymentTool = new DokuPaymentMock();
  const invoice = paymentTool.createInvoice(state.consultation_id);
  const payment = paymentTool.verifyPayment(invoice.output.invoice_id);
  const output: PaymentOutput = {
    invoice_id: invoice.output.invoice_id,
    status: payment.output.status,
    consultation_unlocked: payment.output.consultation_unlocked,
    provider: invoice.output.provider
  };

  return createAgentResult('payment', 'payment.paid', output, [
    'payment.invoice.created',
    output.consultation_unlocked ? 'payment.access.unlocked' : 'payment.access.blocked'
  ]);
}
