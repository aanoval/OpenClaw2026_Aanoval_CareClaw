export interface StructuredLog {
  level: 'info' | 'warn' | 'error';
  event: string;
  agent?: string;
  detail?: unknown;
}

export function createLog(event: string, detail?: unknown, agent?: string): StructuredLog {
  return {
    level: 'info',
    event,
    agent,
    detail
  };
}

export function printLog(log: StructuredLog): void {
  console.log(JSON.stringify(log));
}
