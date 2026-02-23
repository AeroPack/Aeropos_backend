import { Router } from "express";
import { db } from "../db";
import { rolePermissions } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";
import { SYSTEM_PERMISSIONS, DEFAULT_ROLES, getDefaultPermissions } from "../config/rbac";

const roleRouter = Router();

// Get available permissions (System definitions)
roleRouter.get("/definitions", auth, (req, res) => {
    res.json(SYSTEM_PERMISSIONS);
});

// Get all roles (Default + Configured)
roleRouter.get("/", auth, async (req: AuthRequest, res) => {
    try {
        if (!req.companyId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Get custom roles from DB
        const customRolesResult = await db
            .selectDistinct({ role: rolePermissions.role })
            .from(rolePermissions)
            .where(eq(rolePermissions.companyId, req.companyId));

        const customRoles = customRolesResult.map(r => r.role);

        // Merge with defaults
        const allRoles = Array.from(new Set([...DEFAULT_ROLES, ...customRoles]));

        res.json(allRoles);
    } catch (e) {
        console.error("Get roles error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get permissions for a specific role
roleRouter.get("/:role/permissions", auth, async (req: AuthRequest, res) => {
    try {
        const { role } = req.params;
        if (!req.companyId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const permissions = await db
            .select()
            .from(rolePermissions)
            .where(
                and(
                    eq(rolePermissions.role, role),
                    eq(rolePermissions.companyId, req.companyId)
                )
            );

        // If no permissions found in DB, return defaults
        if (permissions.length === 0) {
            res.json(getDefaultPermissions(role));
            return;
        }

        res.json(permissions.map(p => p.permission));
    } catch (e) {
        console.error("Get role permissions error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Update permissions for a role
roleRouter.post("/:role/permissions", auth, async (req: AuthRequest, res) => {
    try {
        const { role } = req.params;
        const { permissions } = req.body; // Array of permission keys

        if (!req.companyId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        if (!Array.isArray(permissions)) {
            res.status(400).json({ error: "Permissions must be an array" });
            return;
        }

        // Transaction to replace permissions
        await db.transaction(async (tx) => {
            // Delete existing
            await tx
                .delete(rolePermissions)
                .where(
                    and(
                        eq(rolePermissions.role, role),
                        eq(rolePermissions.companyId, req.companyId!)
                    )
                );

            // Insert new
            if (permissions.length > 0) {
                await tx.insert(rolePermissions).values(
                    permissions.map((p: string) => ({
                        role,
                        permission: p,
                        companyId: req.companyId!
                    }))
                );
            }
        });

        res.json({ success: true });
    } catch (e) {
        console.error("Update role permissions error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default roleRouter;
