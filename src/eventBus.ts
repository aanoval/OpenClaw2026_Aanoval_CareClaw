export interface WorkflowEvent<TPayload = unknown> {
  name: string;
  payload: TPayload;
  createdAt: string;
}

export class EventBus {
  private queue: WorkflowEvent[] = [];
  private history: WorkflowEvent[] = [];

  publish<TPayload>(name: string, payload: TPayload): WorkflowEvent<TPayload> {
    const event = {
      name,
      payload,
      createdAt: new Date(0).toISOString()
    };
    this.queue.push(event);
    this.history.push(event);
    return event;
  }

  next(): WorkflowEvent | undefined {
    return this.queue.shift();
  }

  hasPendingEvents(): boolean {
    return this.queue.length > 0;
  }

  getHistory(): WorkflowEvent[] {
    return [...this.history];
  }
}
