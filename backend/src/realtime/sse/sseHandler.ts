import type { Request, Response } from 'express';
import { eventBus } from '../../bus/eventBus.js';
import { BUS_EVENTS } from '../../bus/events.js';
import { subscribe, unsubscribe, broadcast } from './sseManager.js';

export function sseHandler(req: Request, res: Response): void {
  const { runId } = req.params as { runId: string };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Ping inicial para evitar que proxies cierren la conexión
  res.write(': keep-alive\n\n');

  subscribe(runId, res);

  const listener = (payload: unknown) => {
    const event = (payload as { type: string }).type;
    broadcast(runId, event, payload);
  };

  eventBus.on(BUS_EVENTS.RUN_UPDATED(runId), listener);

  req.on('close', () => {
    unsubscribe(runId, res);
    eventBus.off(BUS_EVENTS.RUN_UPDATED(runId), listener);
  });
}
