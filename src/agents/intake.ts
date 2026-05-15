export function runIntake(message: string) {
  return {
    chief_complaint: message,
    needs_more_info: false,
    event: 'intake.completed'
  };
}
