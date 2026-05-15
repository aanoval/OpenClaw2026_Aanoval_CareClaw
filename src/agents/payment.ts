import { createMockInvoice, verifyMockPayment } from '../tools/mockPayment.js';

export function runPaymentGate(consultationId: string) {
  const invoice = createMockInvoice(consultationId);
  const payment = verifyMockPayment();
  return {
    ...invoice,
    status: payment.status,
    consultation_unlocked: true,
    event: payment.event
  };
}
