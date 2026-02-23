import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Permission, ROLE_PERMISSIONS } from '../config/permissions';

export const checkPermission = (requiredPermission: Permission) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userRole = req.role;

            if (!userRole) {
                res.status(403).json({ error: "Access denied. No role assigned." });
                return;
            }

            const permissions = ROLE_PERMISSIONS[userRole];

            if (!permissions || !permissions.includes(requiredPermission)) {
                res.status(403).json({
                    error: "Access denied. Insufficient permissions.",
                    required: requiredPermission,
                    role: userRole
                });
                return;
            }

            next();
        } catch (error) {
            res.status(500).json({ error: "Internal server error during permission check." });
        }
    };
};
