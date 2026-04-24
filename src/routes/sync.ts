import { Router, Request, Response } from 'express';
import { syncRequestSchema } from '../validators/sync.validator';
import { processPushOperations } from '../services/pushProcessor';
import { fetchPullOperations } from '../services/pullProcessor';
import { SyncResponse } from '../types/sync.types';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware
router.use(authMiddleware);

/**
 * POST /api/sync
 * Single endpoint for all offline-first sync.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  // ── Validate body ─────────────────────────────────────────
  const parsed = syncRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid sync request',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { deviceId, lastPulledAt, operations } = parsed.data;
  const { companyId, employeeId } = req as Request & { companyId: number; employeeId: string };

  // ── PUSH: sort by timestamp then process ──────────────────
  const sortedOps = [...operations].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const acknowledged = await processPushOperations(sortedOps, {
    companyId,
    employeeId,
    deviceId,
  });

  // ── PULL: fetch ops since lastPulledAt ────────────────────
  const { operations: pulledOps, nextCursor } = await fetchPullOperations(
    companyId,
    lastPulledAt,
  );

  const response: SyncResponse = {
    serverTime:   new Date().toISOString(),
    acknowledged,
    operations:   pulledOps,
    nextCursor,
  };

  res.status(200).json(response);
});

export { router as syncRouter };
