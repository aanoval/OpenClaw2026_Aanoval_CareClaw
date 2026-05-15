export function sendFinalDelivery(doctorApproved: boolean) {
  if (!doctorApproved) throw new Error('Cannot deliver unapproved content');
  return {
    status: 'sent',
    channel: 'demo',
    event: 'final.sent'
  };
}
