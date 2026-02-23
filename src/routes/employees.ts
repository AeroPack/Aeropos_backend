import { Router } from "express";
import { db } from "../db";
import { employees, NewEmployee } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";
import { checkPermission } from "../middleware/checkPermission";
import bcrypt from "bcryptjs";

const employeeRouter = Router();

// All employee routes require authentication
employeeRouter.use(auth);

// Get all employees for the authenticated company
employeeRouter.get("/", checkPermission('VIEW_EMPLOYEES'), async (req: AuthRequest, res) => {
    try {
        const { updatedSince } = req.query;

        let query = db.select().from(employees).where(
            and(
                eq(employees.companyId, req.companyId!),
                eq(employees.isDeleted, false)
            )
        );

        if (updatedSince) {
            query = db.select().from(employees).where(
                and(
                    eq(employees.companyId, req.companyId!),
                    eq(employees.isDeleted, false),
                    gt(employees.updatedAt, new Date(updatedSince as string))
                )
            );
        }

        const allEmployees = await query;

        // Remove passwords from response
        const employeesWithoutPasswords = allEmployees.map(({ password, ...employee }) => employee);

        res.json(employeesWithoutPasswords);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Get specific employee by UUID
employeeRouter.get("/:uuid", checkPermission('VIEW_EMPLOYEES'), async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [employee] = await db
            .select()
            .from(employees)
            .where(
                and(
                    eq(employees.uuid, uuid),
                    eq(employees.companyId, req.companyId!)
                )
            );

        if (!employee) {
            res.status(404).json({ error: "Employee not found" });
            return;
        }

        // Remove password from response
        const { password, ...employeeWithoutPassword } = employee;
        res.json(employeeWithoutPassword);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Create new employee (admin/manager with permission)
// Supports upsert by UUID for sync compatibility: if the same UUID is re-sent
// (e.g. from a client sync), we update the existing record instead of failing.
employeeRouter.post("/", checkPermission('MANAGE_EMPLOYEES'), async (req: AuthRequest, res) => {
    try {
        const { uuid, name, email, password, phone, address, position, salary, role, authMethod } = req.body;

        if (role === 'admin' && req.role !== 'admin') {
            res.status(403).json({ error: "Only admins can promote users to admin role" });
            return;
        }

        const isGoogleAuth = authMethod === 'google';

        // Email is always required
        if (!email) {
            res.status(400).json({ error: "Email is required" });
            return;
        }

        if (!isGoogleAuth) {
            // Manual auth: name and password are required
            if (!name) {
                res.status(400).json({ error: "Name is required for manual employee creation" });
                return;
            }
            if (!password) {
                res.status(400).json({ error: "Password is required for manual employee creation" });
                return;
            }
            if (password.length < 6) {
                res.status(400).json({ error: "Password must be at least 6 characters long" });
                return;
            }
        }

        // Check if an employee with this UUID already exists (sync upsert scenario)
        if (uuid) {
            const [existingByUuid] = await db
                .select()
                .from(employees)
                .where(and(eq(employees.uuid, uuid), eq(employees.companyId, req.companyId!)));

            if (existingByUuid) {
                // Upsert: update the existing record instead of creating a duplicate
                const updateData: Partial<NewEmployee> = {
                    name: name || existingByUuid.name,
                    email: email || existingByUuid.email,
                    phone: phone ?? existingByUuid.phone,
                    address: address ?? existingByUuid.address,
                    position: position ?? existingByUuid.position,
                    salary: salary ?? existingByUuid.salary,
                    role: role || existingByUuid.role,
                    updatedAt: new Date(),
                };

                const [updated] = await db
                    .update(employees)
                    .set(updateData)
                    .where(and(eq(employees.uuid, uuid), eq(employees.companyId, req.companyId!)))
                    .returning();

                const { password: _, ...updatedWithoutPassword } = updated;
                res.status(200).json(updatedWithoutPassword);
                return;
            }
        }

        // Check if email already exists (different UUID = different person = conflict)
        const [existingByEmail] = await db
            .select()
            .from(employees)
            .where(and(eq(employees.email, email), eq(employees.companyId, req.companyId!)));

        if (existingByEmail) {
            res.status(400).json({ error: "Employee with this email already exists" });
            return;
        }

        // Hash password only for manual auth; Google Auth employees have no password
        const hashedPassword = isGoogleAuth ? null : await bcrypt.hash(password, 10);

        const newEmployee: NewEmployee = {
            ...(uuid ? { uuid } : {}),
            name: name || email.split('@')[0], // Derive name from email prefix if not provided (Google Auth)
            email,
            password: hashedPassword,
            phone: phone || null,
            address: address || null,
            position: position || null,
            salary: salary || null,
            role: role || "employee",
            googleAuth: isGoogleAuth,
            isOwner: false,
            companyId: req.companyId!,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const [createdEmployee] = await db
            .insert(employees)
            .values(newEmployee)
            .returning();

        // Remove password from response
        const { password: _, ...employeeWithoutPassword } = createdEmployee;
        res.status(201).json(employeeWithoutPassword);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Update employee
employeeRouter.put("/:uuid", checkPermission('MANAGE_EMPLOYEES'), async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const updatedEmployee: Partial<NewEmployee> = {
            ...req.body,
            updatedAt: new Date(),
        };

        const [result] = await db
            .update(employees)
            .set(updatedEmployee)
            .where(
                and(
                    eq(employees.uuid, uuid),
                    eq(employees.companyId, req.companyId!)
                )
            )
            .returning();

        if (!result) {
            res.status(404).json({ error: "Employee not found" });
            return;
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

// Soft delete employee
employeeRouter.delete("/:uuid", checkPermission('MANAGE_EMPLOYEES'), async (req: AuthRequest, res) => {
    try {
        const { uuid } = req.params;
        const [deletedEmployee] = await db
            .update(employees)
            .set({ isDeleted: true, updatedAt: new Date() })
            .where(
                and(
                    eq(employees.uuid, uuid),
                    eq(employees.companyId, req.companyId!)
                )
            )
            .returning();

        if (!deletedEmployee) {
            res.status(404).json({ error: "Employee not found" });
            return;
        }

        res.json(deletedEmployee);
    } catch (e) {
        res.status(500).json({ error: e });
    }
});

export default employeeRouter;
