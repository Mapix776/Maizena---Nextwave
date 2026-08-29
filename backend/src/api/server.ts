import express from 'express';
import cors from 'cors';
import { env } from '../config/env.js';
import agentsRoutes from './routes/agents.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.FRONTEND_URL }));
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/agents', agentsRoutes);

  // TODO: agregar rutas de documents, operations, runs, decisions

  return app;
}
