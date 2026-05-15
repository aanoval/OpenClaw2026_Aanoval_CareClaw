import type { PaymentTool, ToolCallResult } from './contracts.js';

export class DokuPaymentMock implements PaymentTool {
  createInvoice(consultationId: string): ToolCallResult<{ invoice_id: string; provider: string }> {
    return {
      tool: 'doku.payment.createInvoice',
      ok: true,
      output: {
        invoice_id: `DOKU-DEMO-${consultationId}`,
        provider: 'DOKU MCP mock'
      }
    };
  }

  verifyPayment(invoiceId: string): ToolCallResult<{ status: 'paid' | 'pending'; consultation_unlocked: boolean }> {
    return {
      tool: 'doku.payment.verifyPayment',
      ok: true,
      output: {
        status: invoiceId.length > 0 ? 'paid' : 'pending',
        consultation_unlocked: invoiceId.length > 0
      }
    };
  }
}
