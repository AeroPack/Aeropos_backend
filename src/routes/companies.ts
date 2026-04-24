import { Router } from "express";
import { db } from "../db";
import { companies, employees, NewCompany, NewEmployee } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDefaultPermissions } from "../config/rbac";

const companyRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "passwordKey";

// All company routes require authentication
companyRouter.use(auth);

// GET /api/companies/my — List all companies for the current user (by email)
companyRouter.get("/my", async (req: AuthRequest, res) => {
    try {
        if (!req.employeeId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Get current employee to find their email
        const [currentEmployee] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, Number(req.employeeId)));

        if (!currentEmployee) {
            res.status(404).json({ error: "Employee not found" });
            return;
        }

        // Find all non-deleted employee records with the same email
        const allEmployeeRecords = await db
            .select({
                employeeId: employees.id,
                employeeUuid: employees.uuid,
                role: employees.role,
                isOwner: employees.isOwner,
                companyId: companies.id,
                companyUuid: companies.uuid,
                businessName: companies.businessName,
                businessAddress: companies.businessAddress,
                phone: companies.phone,
                email: companies.email,
                logoUrl: companies.logoUrl,
                createdByEmployeeId: companies.createdByEmployeeId,
            })
            .from(employees)
            .innerJoin(companies, eq(employees.companyId, companies.id))
            .where(
                and(
                    eq(employees.email, currentEmployee.email),
                    eq(employees.isDeleted, false),
                    eq(companies.isDeleted, false)
                )
            );

        // Map to company list with role info
        const companyList = allEmployeeRecords.map(record => ({
            id: record.companyId,
            uuid: record.companyUuid,
            businessName: record.businessName,
            businessAddress: record.businessAddress,
            phone: record.phone,
            email: record.email,
            logoUrl: record.logoUrl,
            role: record.role,
            isOwner: record.isOwner,
            isCurrent: record.companyId === req.companyId,
        }));

        res.json({ companies: companyList });
    } catch (e) {
        console.error("Get my companies error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/companies — Create a new company (admin only)
companyRouter.post("/", async (req: AuthRequest, res) => {
    try {
        if (!req.employeeId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Get current employee
        const [currentEmployee] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, Number(req.employeeId)));

        if (!currentEmployee) {
            res.status(404).json({ error: "Employee not found" });
            return;
        }

        // Only admins/owners can create new companies
        if (currentEmployee.role !== "admin" && !currentEmployee.isOwner) {
            res.status(403).json({ error: "Only admins can create new companies" });
            return;
        }

        const {
            businessName,
            businessAddress,
            taxId,
            companyPhone,
            companyEmail,
        } = req.body;

        if (!businessName) {
            res.status(400).json({ error: "Business name is required" });
            return;
        }

        // Create the new company
        const newCompany: NewCompany = {
            businessName,
            businessAddress: businessAddress || null,
            taxId: taxId || null,
            phone: companyPhone || null,
            email: companyEmail || null,
            createdByEmployeeId: currentEmployee.id,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const [createdCompany] = await db
            .insert(companies)
            .values(newCompany)
            .returning();

        // Create mirror admin employee in the new company
        const mirrorEmployee: NewEmployee = {
            name: currentEmployee.name,
            email: currentEmployee.email,
            password: currentEmployee.password, // Same password hash
            phone: currentEmployee.phone,
            companyId: createdCompany.id,
            role: "admin",
            isOwner: true,
            googleAuth: currentEmployee.googleAuth,
            isEmailVerified: currentEmployee.isEmailVerified,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const [createdEmployee] = await db
            .insert(employees)
            .values(mirrorEmployee)
            .returning();

        // Update company with the creator's employee ID in the new company
        await db
            .update(companies)
            .set({ createdByEmployeeId: createdEmployee.id })
            .where(eq(companies.id, createdCompany.id));

        // Also set createdByEmployeeId on the original company if it's not set
        const [originalCompany] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, currentEmployee.companyId));

        if (originalCompany && !originalCompany.createdByEmployeeId) {
            await db
                .update(companies)
                .set({ createdByEmployeeId: currentEmployee.id })
                .where(eq(companies.id, originalCompany.id));
        }

        const { password: _, ...employeeWithoutPassword } = createdEmployee;

        res.status(201).json({
            message: "Company created successfully",
            company: createdCompany,
            employee: employeeWithoutPassword,
        });
    } catch (e) {
        console.error("Create company error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/companies/switch — Switch to a different company
companyRouter.post("/switch", async (req: AuthRequest, res) => {
    try {
        if (!req.employeeId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { companyId: targetCompanyId } = req.body;

        if (!targetCompanyId) {
            res.status(400).json({ error: "companyId is required" });
            return;
        }

        // Get current employee to find their email
        const [currentEmployee] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, Number(req.employeeId)));

        if (!currentEmployee) {
            res.status(404).json({ error: "Employee not found" });
            return;
        }

        // SECURITY: Find employee record in the target company with the SAME email
        const [targetEmployee] = await db
            .select()
            .from(employees)
            .where(
                and(
                    eq(employees.email, currentEmployee.email),
                    eq(employees.companyId, targetCompanyId),
                    eq(employees.isDeleted, false)
                )
            );

        if (!targetEmployee) {
            res.status(403).json({ error: "You do not have access to this company" });
            return;
        }

        // Get target company details
        const [targetCompany] = await db
            .select()
            .from(companies)
            .where(
                and(
                    eq(companies.id, targetCompanyId),
                    eq(companies.isDeleted, false)
                )
            );

        if (!targetCompany) {
            res.status(404).json({ error: "Company not found" });
            return;
        }

        if (!targetCompany.tenantId) {
            res.status(500).json({ error: "Company has no tenant assigned" });
            return;
        }

        // Generate new JWT for the target employee record
        const token = jwt.sign({ 
            id: targetEmployee.uuid,
            tenant_id: targetCompany.tenantId.toString(),
            company_ids: [targetEmployee.companyId.toString()],
            role: targetEmployee.role,
            sub: targetEmployee.uuid,
            device_id: ''
        }, JWT_SECRET);

        // Remove password from response
        const { 
            password: _p, 
            passwordResetToken: _prt, 
            passwordResetExpires: _pre,
            emailVerificationToken: _evt, 
            emailVerificationExpires: _eve,
            isEmailVerified: _iev,
            googleAuth: _ga,
            isDeleted: _isd,
            ...employeeWithoutPassword 
        } = targetEmployee;
        const permissions = await getUserPermissions(targetEmployee.role, targetEmployee.companyId);

        res.json({
            employee: { ...employeeWithoutPassword, permissions },
            company: targetCompany,
            token,
        });
    } catch (e) {
        console.error("Switch company error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Helper to get user permissions (same as in auth.ts)
async function getUserPermissions(role: string, companyId: number): Promise<string[]> {
    const { rolePermissions } = await import("../db/schema");
    const permissions = await db
        .select()
        .from(rolePermissions)
        .where(
            and(
                eq(rolePermissions.role, role),
                eq(rolePermissions.companyId, companyId)
            )
        );

    if (permissions.length === 0) {
        return getDefaultPermissions(role);
    }
    return permissions.map(p => p.permission);
}

export default companyRouter;
