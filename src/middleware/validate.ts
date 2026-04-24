import { Request, Response, NextFunction } from "express";
import { auth, AuthRequest } from "../middleware/auth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export function validateUUID(field: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (value !== undefined && value !== null && !isValidUUID(value)) {
      return res.status(400).json({
        error: "INVALID_UUID",
        field: field,
        message: `Invalid UUID format for ${field}`,
      });
    }
    
    next();
  };
}

export function validateRequiredUUID(field: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const value = req.body[field];
    
    if (!value) {
      return res.status(400).json({
        error: "MISSING_REQUIRED_FIELD",
        field: field,
        message: `${field} is required`,
      });
    }
    
    if (!isValidUUID(value)) {
      return res.status(400).json({
        error: "INVALID_UUID",
        field: field,
        message: `${field} must be a valid UUID`,
      });
    }
    
    next();
  };
}

export function checkDeprecatedFields(req: AuthRequest, res: Response, next: NextFunction) {
  const deprecatedFields = [];
  
  if (req.body.unitId !== undefined) {
    deprecatedFields.push("unitId");
    console.warn(`DEPRECATED: unitId used by company ${req.companyId} - Use unitUuid instead`);
  }
  if (req.body.categoryId !== undefined) {
    deprecatedFields.push("categoryId");
    console.warn(`DEPRECATED: categoryId used by company ${req.companyId} - Use categoryUuid instead`);
  }
  if (req.body.brandId !== undefined) {
    deprecatedFields.push("brandId");
    console.warn(`DEPRECATED: brandId used by company ${req.companyId} - Use brandUuid instead`);
  }
  
  if (deprecatedFields.length > 0) {
    console.warn(`DEPRECATION WARNING: Deprecated fields [${deprecatedFields.join(", ")}] used in request by company ${req.companyId}. These will be rejected in a future version.`);
  }
  
  next();
}

function validateProductUUIDFields(req: AuthRequest, res: Response, next: NextFunction) {
  checkDeprecatedFields(req, res, next);
}

export const validateProduct = [auth, checkDeprecatedFields];

export function validateParamUUID(req: any, res: Response, next: NextFunction) {
  const paramUuid = req.params.uuid;
  
  if (paramUuid && !isValidUUID(paramUuid)) {
    res.status(400).json({
      error: "INVALID_UUID",
      field: "uuid",
      message: "Invalid UUID format in URL parameter",
    });
    return;
  }
  
  next();
}