/**
 * Health Routes - System health checks and fixes
 */

import { Router, Request, Response } from 'express';
import { runHealthChecks, fixHealthIssue } from '../health-service';

const router = Router();

/**
 * GET /api/health - Run health checks
 */
router.get('/', async (_req: Request, res: Response) => {
  const report = await runHealthChecks();
  res.json(report);
});

/**
 * POST /api/health/fix/:checkId - Fix a health issue
 */
router.post('/fix/:checkId', (req: Request, res: Response): void => {
  const { checkId } = req.params;
  const result = fixHealthIssue(checkId);

  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(400).json({ success: false, message: result.message });
  }
});

export default router;
