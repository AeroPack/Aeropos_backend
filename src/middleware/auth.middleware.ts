import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const JWT_SECRET = config.jwt.secret;

interface JwtPayload {
  sub: string;           // employee uuid or id
  company_ids: number[];  // array - your JWT uses this
  companyId?: number;   // fallback for older tokens
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      companyId: number;
      employeeId: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired JWT' });
    return;
  }

  // ── Validate header companyId ─────────────────────────────────
  const headerCompanyId = Number(req.headers['x-company-id']);

  if (!headerCompanyId || Number.isNaN(headerCompanyId)) {
    res.status(400).json({ error: 'Invalid or missing x-company-id header' });
    return;
  }

  // ── Support both array and single company format ──────────
  const companyIds = payload.company_ids 
    ? payload.company_ids.map(Number) 
    : payload.companyId 
      ? [payload.companyId] 
      : [];

  if (!companyIds.includes(headerCompanyId)) {
    res.status(403).json({ 
      error: 'X-Company-Id does not match JWT company claim' 
    });
    return;
  }

  // ── Attach validated context ────────────────────────
  req.companyId  = headerCompanyId;
  req.employeeId = payload.sub;

  next();
}