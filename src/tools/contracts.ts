export interface ToolCallResult<TOutput> {
  tool: string;
  ok: boolean;
  output: TOutput;
}

export interface PaymentTool {
  createInvoice(consultationId: string): ToolCallResult<{ invoice_id: string; provider: string }>;
  verifyPayment(invoiceId: string): ToolCallResult<{ status: 'paid' | 'pending'; consultation_unlocked: boolean }>;
}

export interface AuditTool {
  record(event: string, payload: unknown): ToolCallResult<{ recorded: true; event: string }>;
}

export interface DeliveryTool {
  sendPatientMessage(consultationId: string, message: string): ToolCallResult<{ sent: boolean; channel: 'demo' }>;
}
