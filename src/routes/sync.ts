import { Router, Response } from "express";
import { authMiddleware, requireTenant } from "../middleware/auth-sync";
import { processOperations, getServerChanges } from "../services/operations";
import { syncRequestSchema, pullRequestSchema } from "../validators/sync";
import type { AuthRequest } from "../types/sync";

const router = Router();

router.use(authMiddleware);
router.use(requireTenant);

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    const isPullOnly = !req.body.operations || req.body.operations.length === 0;

    if (isPullOnly) {
      const pullValidation = pullRequestSchema.safeParse({
        tenant_id: tenantId,
        cursor: req.body.cursor || 0,
        page_size: req.body.page_size,
        page_token: req.body.page_token,
      });

      if (!pullValidation.success) {
        res.status(400).json({
          error: "Invalid pull request",
          details: pullValidation.error.errors,
        });
        return;
      }

      const { cursor, page_size = 500, page_token } = pullValidation.data;
      const { operations, nextCursor, hasMore } = await getServerChanges(
        tenantId,
        cursor,
        page_size,
        page_token
      );

      res.json({
        cursor: nextCursor,
        server_changes: operations,
        has_more: hasMore,
        next_page_token: hasMore ? Buffer.from(nextCursor.toString()).toString("base64") : undefined,
      });
      return;
    }

    const validation = syncRequestSchema.safeParse({
      tenant_id: tenantId,
      client_id: req.body.client_id,
      cursor: req.body.cursor,
      operations: req.body.operations,
      page_size: req.body.page_size,
      page_token: req.body.page_token,
    });

    if (!validation.success) {
      res.status(400).json({
        error: "Invalid sync request",
        details: validation.error.errors,
      });
      return;
    }

    const { client_id, cursor, operations } = validation.data;

    const { acked, rejected } = await processOperations(
      tenantId,
      client_id,
      operations || []
    );

    const { operations: serverChanges, nextCursor, hasMore } = await getServerChanges(
      tenantId,
      cursor,
      500
    );

    res.json({
      cursor: nextCursor,
      acked,
      rejected,
      server_changes: serverChanges,
      has_more: hasMore,
      next_page_token: hasMore ? Buffer.from(nextCursor.toString()).toString("base64") : undefined,
    });
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Internal server error during sync",
      details: errorMessage,
    });
  }
});

export default router;