import type { Response } from 'express';

const clients = new Map<string, Set<Response>>();

export function subscribe(runId: string, res: Response): void {
  if (!clients.has(runId)) clients.set(runId, new Set());
  clients.get(runId)!.add(res);
}

export function unsubscribe(runId: string, res: Response): void {
  clients.get(runId)?.delete(res);
  if (clients.get(runId)?.size === 0) clients.delete(runId);
}

export function broadcast(runId: string, event: string, data: unknown): void {
  const subs = clients.get(runId);
  if (!subs || subs.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  subs.forEach((res) => res.write(payload));
}
