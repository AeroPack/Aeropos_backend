import { UUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { employees } from "../db/schema";
import { eq } from "drizzle-orm";
import { Role } from "../config/permissions";

type AuthRequestFields = {
  employeeId?: number | string;
  companyId?: number;
  role?: Role;
  token?: string;
  requestId?: string;
  deviceId?: string;
};

export type AuthRequest = Request & AuthRequestFields;

export const auth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Support both x-auth-token and Authorization: Bearer headers
    let token = req.header("x-auth-token");
    if (!token) {
      token = req.header("Authorization")?.replace("Bearer ", "");
    }

    if (!token) {
      res.status(401).json({ error: "No auth token, access denied!" });
      return;
    }

    // verify if the token is valid
    const verified = jwt.verify(token, process.env.JWT_SECRET || "passwordKey");

    if (!verified) {
      res.status(401).json({ error: "Token verification failed!" });
      return;
    }

    // get the employee data if the token is valid
    const verifiedToken = verified as { id: string };

    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.uuid, verifiedToken.id));

    if (!employee) {
      res.status(401).json({ error: "Employee not found!" });
      return;
    }

    if (employee.isDeleted) {
      res.status(401).json({ error: "Employee account has been deleted!" });
      return;
    }

    (req as any).employeeId = employee.id;
    (req as any).companyId = employee.companyId;
    req.role = employee.role as Role;
    req.token = token;
    req.requestId = req.header("X-Request-Id") || req.header("x-request-id");
    req.deviceId = req.header("X-Device-Id") || req.header("x-device-id");
    next();
  } catch (e) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: String(e) });
  }
};
