export function createMockInvoice(consultationId: string) {
  return {
    invoice_id: `INV-${consultationId}`,
    status: 'pending'
  };
}

export function verifyMockPayment() {
  return {
    status: 'paid',
    event: 'payment.paid'
  };
}
