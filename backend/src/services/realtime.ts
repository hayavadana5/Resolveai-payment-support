import { EventEmitter } from 'events';

export interface ResolveAIRealtimeEvent {
  id: string;
  type: 'LIFECYCLE' | 'ACTION' | 'WORKFLOW' | 'VERIFICATION' | 'DECISION' | 'CASE_STATUS' | 'ESCALATION' | 'MEMORY';
  caseId: string;
  title: string;
  detail?: string;
  status?: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

const bus = new EventEmitter();
bus.setMaxListeners(1000);
let sequence = 0;

export function publishCaseEvent(event: Omit<ResolveAIRealtimeEvent, 'id' | 'createdAt'>) {
  const enriched: ResolveAIRealtimeEvent = {
    ...event,
    id: `evt_${Date.now()}_${++sequence}`,
    createdAt: new Date().toISOString(),
  };
  bus.emit(`case:${event.caseId}`, enriched);
  bus.emit('all', enriched);
  return enriched;
}

export function subscribeCase(caseId: string, listener: (event: ResolveAIRealtimeEvent) => void) {
  const key = `case:${caseId}`;
  bus.on(key, listener);
  return () => bus.off(key, listener);
}
