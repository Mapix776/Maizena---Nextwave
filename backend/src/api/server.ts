import express from 'express';
import cors from 'cors';
import agentsRoutes from './routes/agents.routes.js';
import runsRoutes from './routes/runs.routes.js';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://maizena-nextwave.vercel.app',
  'https://maizena-nextwave-git-main-joshuapzzs-projects.vercel.app',
  // regex para previews de Vercel que cambian con cada deploy
  /^https:\/\/maizena-nextwave-.*\.vercel\.app$/,
];

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        // Requests sin origin (curl, mobile, server-to-server)
        if (!origin) return callback(null, true);
        const ok = ALLOWED_ORIGINS.some((o) =>
          o instanceof RegExp ? o.test(origin) : o === origin
        );
        callback(ok ? null : new Error(`CORS bloqueado: ${origin}`), ok);
      },
    })
  );

  app.use(express.json());

  // Health check — Render lo usa para saber si el servicio está vivo
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/agents', agentsRoutes);
  app.use('/api', runsRoutes);

  return app;
}
