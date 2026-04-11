import { Router, Response } from "express";
import { pool } from "../db/sync-db";

const router = Router();

router.get("/", async (req, res: Response) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      error: "Database unavailable",
    });
  }
});

export default router;