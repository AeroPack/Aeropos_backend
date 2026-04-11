import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AuthRequest } from "../types/sync";

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  company_ids: string[];
  device_id: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({ error: "No auth token, access denied!" });
      return;
    }

    const verified = jwt.verify(token, config.jwt.secret) as JwtPayload;

    if (!verified.tenant_id) {
      res.status(401).json({ error: "Invalid token: missing tenant_id" });
      return;
    }

    req.tenantId = verified.tenant_id;
    req.deviceId = verified.device_id;
    req.userId = verified.sub;
    req.role = verified.role;
    req.companyIds = verified.company_ids;

    next();
  } catch (error) {
    res.status(401).json({ error: "Token verification failed!" });
  }
};

export const requireTenant = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenantId) {
    res.status(401).json({ error: "Tenant ID required" });
    return;
  }
  next();
};