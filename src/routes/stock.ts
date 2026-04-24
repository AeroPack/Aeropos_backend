import { Router, Response } from "express";
import { authMiddleware, requireTenant } from "../middleware/auth-sync";
import { processStockOperations, getStockChanges } from "../services/stock";
import { stockSyncRequestSchema, stockPullRequestSchema } from "../validators/sync.validator";
import type { AuthRequest } from "../types/sync.types";

const router = Router();

router.use(authMiddleware);
router.use(requireTenant);

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    const hasOperations = req.body.operations && req.body.operations.length > 0;
    const hasLedgerId = req.body.last_ledger_id !== undefined;

    if (!hasOperations && !hasLedgerId) {
      res.status(400).json({
        error: "Invalid request: must include operations or last_ledger_id",
      });
      return;
    }

    if (hasOperations && hasLedgerId) {
      res.status(400).json({
        error: "Invalid request: cannot include both operations and last_ledger_id",
      });
      return;
    }

    if (hasOperations) {
      const validation = stockSyncRequestSchema.safeParse({
        tenant_id: tenantId,
        client_id: req.body.client_id,
        operations: req.body.operations,
      });

      if (!validation.success) {
        res.status(400).json({
          error: "Invalid stock sync request",
          details: validation.error.errors,
        });
        return;
      }

      const { client_id, operations } = validation.data;

      const { acked, rejected, currentStock } = await processStockOperations(
        tenantId,
        operations || []
      );

      res.json({
        acked,
        rejected,
        current_stock: currentStock,
      });
      return;
    }

    const pullValidation = stockPullRequestSchema.safeParse({
      tenant_id: tenantId,
      last_ledger_id: req.body.last_ledger_id,
    });

    if (!pullValidation.success) {
      res.status(400).json({
        error: "Invalid stock pull request",
        details: pullValidation.error.errors,
      });
      return;
    }

    const { last_ledger_id } = pullValidation.data;

    const { operations, lastLedgerId } = await getStockChanges(
      tenantId,
      last_ledger_id ?? 0,
      200
    );

    res.json({
      last_ledger_id: lastLedgerId,
      operations,
    });
  } catch (error: unknown) {
    console.error("Stock sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Internal server error during stock sync",
      details: errorMessage,
    });
  }
});

export default router;