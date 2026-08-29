import { Router } from 'express';
import { runQueries } from '../../db/supabase/queries/runs.queries.js';

const router = Router();

// POST /api/runs
router.post('/runs', async (req, res) => {
  const { operationId, agentName } = req.body ?? {};

  if (!operationId) {
    res.status(400).json({ error: 'operationId es requerido' });
    return;
  }

  try {
    const run = await runQueries.create({
      operationId,
      agentName: agentName ?? 'ari',
    });
    res.status(201).json(run);
  } catch (err) {
    console.error('[POST /runs]', err);
    res.status(500).json({ error: 'no se pudo crear el run' });
  }
});

// GET /api/runs/:runId
router.get('/runs/:runId', async (req, res) => {
  const run = await runQueries.getById(req.params.runId);
  if (!run) {
    res.status(404).json({ error: 'run no encontrado' });
    return;
  }
  res.json(run);
});

export default router;
