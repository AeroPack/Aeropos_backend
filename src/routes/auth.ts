import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import { companies, employees, tenants, NewCompany, NewEmployee, NewTenant } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { auth, AuthRequest } from "../middleware/auth";
import { rolePermissions } from "../db/schema";
import { and } from "drizzle-orm";
import { getDefaultPermissions } from "../config/rbac";
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';
import { syncEmployeeAuthFields } from '../services/auth-sync';
import { gt } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();
const authRouter = Router();

// JWT Secret - using environment variable with fallback
const JWT_SECRET = process.env.JWT_SECRET || "passwordKey";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const getUserPermissions = async (role: string, companyId: number): Promise<string[]> => {
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
};

// Signup endpoint - creates company + owner employee
authRouter.post("/signup", async (req, res) => {
    try {
        const {
            name,
            password,
            phone,
            businessName,
            businessAddress,
            taxId,
            companyPhone,
            companyEmail
        } = req.body;
        const email = req.body.email?.toLowerCase();

        // Validate required fields
        if (!name || !email || !password || !businessName) {
            res.status(400).json({ error: "Name, email, password, and business name are required" });
            return;
        }

        // Validate email format
        if (!isValidEmail(email)) {
            res.status(400).json({ error: "Invalid email format" });
            return;
        }

        // Validate password length (minimum 6 characters)
        if (password.length < 6) {
            res.status(400).json({ error: "Password must be at least 6 characters long" });
            return;
        }

        // Check if employee with email already exists
        const [existingEmployee] = await db
            .select()
            .from(employees)
            .where(eq(employees.email, email));

        if (existingEmployee) {
            res.status(400).json({ error: "User with this email already exists" });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new company 1
        const newCompany: NewCompany = {
            businessName,
            businessAddress: businessAddress || null,
            taxId: taxId || null,
            phone: companyPhone || null,
            email: companyEmail || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const [createdCompany] = await db
            .insert(companies)
            .values(newCompany)
            .returning();

        // Create a tenant for this new company
        const tenantSlug = businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
            .substring(0, 90) + '-' + Date.now();

        const newTenant: NewTenant = {
            externalKey: `tenant_${createdCompany.uuid}`,
            name: businessName,
            slug: tenantSlug,
            status: 'active',
            plan: 'free',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const [createdTenant] = await db
            .insert(tenants)
            .values(newTenant)
            .returning();

        // Link tenant to company
        await db
            .update(companies)
            .set({ tenantId: createdTenant.id })
            .where(eq(companies.id, createdCompany.id));

        const companyWithTenant = { ...createdCompany, tenantId: createdTenant.id };

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create owner employee
        const newEmployee: NewEmployee = {
            name,
            email,
            password: hashedPassword,
            phone: phone || null,
            companyId: createdCompany.id,
            role: "admin",
            isOwner: true,
            isEmailVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const [createdEmployee] = await db
            .insert(employees)
            .values(newEmployee)
            .returning();

        // Send verification email
        await sendVerificationEmail(email, verificationToken);

        // Set company ownership
        await db
            .update(companies)
            .set({ createdByEmployeeId: createdEmployee.id })
            .where(eq(companies.id, createdCompany.id));

        // Generate JWT token
        const token = jwt.sign({ 
            id: createdEmployee.uuid,
            tenant_id: createdTenant.id.toString(),
            company_ids: [createdEmployee.companyId.toString()],
            role: createdEmployee.role,
            sub: createdEmployee.uuid,
            device_id: ''
        }, JWT_SECRET);

        // Remove sensitive fields from response
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
        } = createdEmployee;

        const permissions = getDefaultPermissions("admin"); // Owner is admin

        res.status(201).json({
            employee: { ...employeeWithoutPassword, permissions },
            company: companyWithTenant,
            token,
        });
    } catch (e) {
        console.error("Signup error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Login endpoint - handles multi-company
authRouter.post("/login", async (req, res) => {
    console.log("--- LOGIN ATTEMPT ---");
    try {
        console.log("Request body:", JSON.stringify(req.body));
        const { password, companyId } = req.body;
        const email = req.body.email?.toLowerCase();

        // Validate required fields
        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required" });
            return;
        }

        console.log(`Searching for employees with email: ${email}`);
        // Find ALL non-deleted employees with this email
        const matchingEmployees = await db
            .select()
            .from(employees)
            .where(
                and(
                    eq(employees.email, email),
                    eq(employees.isDeleted, false)
                )
            );
        console.log(`Found ${matchingEmployees.length} matching employees`);

        if (matchingEmployees.length === 0) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }

        // Verify password against EACH employee individually (handles temporary desync)
        const validEmployees = [];
        for (const emp of matchingEmployees) {
            if (!emp.password) continue;
            const isValid = await bcrypt.compare(password, emp.password);
            if (isValid) {
                validEmployees.push(emp);
            }
        }

        if (validEmployees.length === 0) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }

        // If companyId is specified, select that company directly
        if (companyId) {
            const targetEmployee = validEmployees.find(e => e.companyId === companyId);
            if (!targetEmployee) {
                res.status(403).json({ error: "You do not have access to this company" });
                return;
            }
            return await respondWithEmployeeLogin(targetEmployee, res);
        }

        // Single company — login directly
        if (validEmployees.length === 1) {
            return await respondWithEmployeeLogin(validEmployees[0], res);
        }

        // Multiple companies — return company list for selection
        const companyList = [];
        for (const emp of validEmployees) {
            const [company] = await db
                .select()
                .from(companies)
                .where(eq(companies.id, emp.companyId));
            if (company && !company.isDeleted) {
                companyList.push({
                    id: company.id,
                    uuid: company.uuid,
                    businessName: company.businessName,
                    logoUrl: company.logoUrl,
                    role: emp.role,
                    isOwner: emp.isOwner,
                });
            }
        }

        res.status(200).json({
            requiresCompanySelection: true,
            companies: companyList,
        });
    } catch (e) {
        console.error("Login error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Helper: respond with full login payload for a specific employee
async function respondWithEmployeeLogin(employee: any, res: any) {
    const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, employee.companyId));

    if (!company) {
        res.status(500).json({ error: "Company not found" });
        return;
    }

    if (!company.tenantId) {
        res.status(500).json({ error: "Company has no tenant assigned" });
        return;
    }

        const token = jwt.sign({ 
            id: employee.uuid,
            tenant_id: company.tenantId.toString(),
            company_ids: [employee.companyId.toString()],
            role: employee.role,
            sub: employee.uuid,
            device_id: ''
        }, JWT_SECRET);
    const { 
        password: _p, 
        passwordResetToken: _prt, 
        passwordResetExpires: _pre,
        emailVerificationToken: _evt, 
        emailVerificationExpires: _eve,
        googleAuth: _ga,
        isDeleted: _isd,
        ...employeeWithoutPassword 
    } = employee;
    const permissions = await getUserPermissions(employee.role, employee.companyId);

    res.status(200).json({
        employee: { 
            ...employeeWithoutPassword, 
            permissions,
            isEmailVerified: employee.isEmailVerified 
        },
        company: company,
        token,
    });
}

// Get current employee endpoint (protected)
authRouter.get("/me", auth, async (req: AuthRequest, res) => {
    try {
        if (!req.employeeId || !req.companyId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Get employee from database
        const [employee] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, Number(req.employeeId)));

        if (!employee) {
            res.status(404).json({ error: "Employee not found" });
            return;
        }

        // Get company details
        const [company] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, req.companyId));

        if (!company) {
            res.status(404).json({ error: "Company not found" });
            return;
        }

        // Remove only truly sensitive fields
        const { 
            password: _p, 
            passwordResetToken: _prt, 
            passwordResetExpires: _pre,
            emailVerificationToken: _evt, 
            emailVerificationExpires: _eve,
            googleAuth: _ga,
            isDeleted: _isd,
            ...employeeWithoutPassword 
        } = employee;

        const permissions = await getUserPermissions(employee.role, employee.companyId);

        res.status(200).json({
            employee: { 
                ...employeeWithoutPassword, 
                permissions,
                isEmailVerified: employee.isEmailVerified 
            },
            company: company,
        });
    } catch (e) {
        console.error("Get employee error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Google Auth endpoint
authRouter.post("/google", async (req, res) => {
    console.log("Google Auth request received body:", JSON.stringify(req.body));
    try {
        const { idToken, accessToken } = req.body;

        if (!idToken && !accessToken) {
            console.warn("Google Auth attempt without idToken or accessToken");
            res.status(400).json({
                error: "Authentication failed",
                details: "idToken or accessToken is required"
            });
            return;
        }

        console.log(`Google Auth: testing ${idToken ? 'idToken' : 'accessToken'}`);

        let payload: any;

        // Try ID Token first if available
        if (idToken) {
            try {
                const ticket = await client.verifyIdToken({
                    idToken,
                    audience: GOOGLE_CLIENT_ID,
                });
                payload = ticket.getPayload();
            } catch (error) {
                console.error("Google verify ID token error:", error);

                // If ID token fails and no access token, fail
                if (!accessToken) {
                    res.status(401).json({
                        error: "Authentication failed",
                        details: "Invalid Google ID Token"
                    });
                    return;
                }
            }
        }

        // Try Access Token if payload is still null and we have access token
        if (!payload && accessToken) {
            try {
                // Using global fetch (Node 18+)
                const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch user info: ${response.statusText}`);
                }

                payload = await response.json();
            } catch (error: any) {
                console.error("Google verify Access token error:", error);
                res.status(401).json({
                    error: "Authentication failed",
                    details: error.message || "Invalid Google Access Token"
                });
                return;
            }
        }

        if (!payload || !payload.email) {
            console.error("Invalid Google Token payload:", JSON.stringify(payload));
            res.status(400).json({
                error: "Authentication failed",
                details: "No email found in Google profile"
            });
            return;
        }

        const { name: payloadName, sub } = payload;
        const email = payload.email?.toLowerCase();
        // Use provided name or split email
        const name = payloadName || email.split('@')[0];
        const { companyId: requestedCompanyId } = req.body;

        // Check if any employees exist with this email
        const existingEmployees = await db
            .select()
            .from(employees)
            .where(
                and(
                    eq(employees.email, email),
                    eq(employees.isDeleted, false)
                )
            );

        if (existingEmployees.length > 0) {
            // Login flow — existing user

            // Ensure email is verified for all matching records
            for (const emp of existingEmployees) {
                if (!emp.isEmailVerified) {
                    await db
                        .update(employees)
                        .set({ isEmailVerified: true })
                        .where(eq(employees.id, emp.id));
                }
            }

            // If companyId specified, select that company directly
            if (requestedCompanyId) {
                const targetEmployee = existingEmployees.find(e => e.companyId === requestedCompanyId);
                if (!targetEmployee) {
                    res.status(403).json({ error: "You do not have access to this company" });
                    return;
                }
                return await respondWithEmployeeLogin(targetEmployee, res);
            }

            // Single company — login directly
            if (existingEmployees.length === 1) {
                return await respondWithEmployeeLogin(existingEmployees[0], res);
            }

            // Multiple companies — return company list for selection
            const companyList = [];
            for (const emp of existingEmployees) {
                const [company] = await db
                    .select()
                    .from(companies)
                    .where(eq(companies.id, emp.companyId));
                if (company && !company.isDeleted) {
                    companyList.push({
                        id: company.id,
                        uuid: company.uuid,
                        businessName: company.businessName,
                        logoUrl: company.logoUrl,
                        role: emp.role,
                        isOwner: emp.isOwner,
                    });
                }
            }

            res.status(200).json({
                requiresCompanySelection: true,
                companies: companyList,
            });
        } else {
            // Signup flow (New User)
            const businessName = `${name}'s Company`;

            const newCompany: NewCompany = {
                businessName,
                businessAddress: null,
                taxId: null,
                phone: null,
                email: email,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const [createdCompany] = await db
                .insert(companies)
                .values(newCompany)
                .returning();

            // Create a tenant for this new company (Google signup)
            const tenantSlug = businessName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
                .substring(0, 90) + '-' + Date.now();

            const newTenant: NewTenant = {
                externalKey: `tenant_${createdCompany.uuid}`,
                name: businessName,
                slug: tenantSlug,
                status: 'active',
                plan: 'free',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const [createdTenant] = await db
                .insert(tenants)
                .values(newTenant)
                .returning();

            // Link tenant to company
            await db
                .update(companies)
                .set({ tenantId: createdTenant.id })
                .where(eq(companies.id, createdCompany.id));

            const companyWithTenant = { ...createdCompany, tenantId: createdTenant.id };

            const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const newEmployee: NewEmployee = {
                name: name || "User",
                email,
                password: hashedPassword,
                phone: null,
                companyId: createdCompany.id,
                role: "admin",
                isOwner: true,
                isEmailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const [createdEmployee] = await db
                .insert(employees)
                .values(newEmployee)
                .returning();

            // Set company ownership
            await db
                .update(companies)
                .set({ createdByEmployeeId: createdEmployee.id })
                .where(eq(companies.id, createdCompany.id));

            const token = jwt.sign({ 
                id: createdEmployee.uuid,
                tenant_id: createdTenant.id.toString(),
                company_ids: [createdEmployee.companyId.toString()],
                role: createdEmployee.role,
                sub: createdEmployee.uuid,
                device_id: ''
            }, JWT_SECRET);
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
            } = createdEmployee;
            const permissions = getDefaultPermissions("admin");

            res.status(201).json({
                employee: { ...employeeWithoutPassword, permissions },
                company: companyWithTenant,
                token,
            });
        }

    } catch (e: any) {
        console.error("Google Auth error:", e);
        res.status(500).json({
            error: "Internal server error",
            details: e.message
        });
    }
});

// Verify Email Endpoint
authRouter.get("/verify-email", async (req, res) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            res.status(400).json({ error: "Invalid token" });
            return;
        }

        const [employee] = await db
            .select()
            .from(employees)
            .where(
                and(
                    eq(employees.emailVerificationToken, token),
                    gt(employees.emailVerificationExpires, new Date())
                )
            );

        if (!employee) {
            res.status(400).json({ error: "Invalid or expired verification token" });
            return;
        }

        await db
            .update(employees)
            .set({
                isEmailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
            })
            .where(eq(employees.id, employee.id));

        res.status(200).json({ message: "Email verified successfully" });

    } catch (e) {
        console.error("Verify email error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Resend Verification Email Endpoint
authRouter.post("/resend-verification", async (req, res) => {
    try {
        const email = req.body.email?.toLowerCase();

        if (!email) {
            res.status(400).json({ error: "Email is required" });
            return;
        }

        const [employee] = await db
            .select()
            .from(employees)
            .where(eq(employees.email, email));

        if (!employee) {
            // Don't reveal if user exists
            res.status(200).json({ message: "If an unverified account exists, a verification link has been sent." });
            return;
        }

        if (employee.isEmailVerified) {
            res.status(200).json({ message: "Email is already verified. Please log in." });
            return;
        }

        // Generate a fresh verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await db
            .update(employees)
            .set({
                emailVerificationToken: verificationToken,
                emailVerificationExpires: verificationExpires,
            })
            .where(eq(employees.id, employee.id));

        await sendVerificationEmail(email, verificationToken);

        res.status(200).json({ message: "Verification email resent. Please check your inbox." });

    } catch (e) {
        console.error("Resend verification error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Forgot Password Endpoint

authRouter.post("/forgot-password", async (req, res) => {
    try {
        console.log("--- FORGOT PASSWORD REQUEST ---");
        console.log("Raw body:", req.body);

        const email = req.body.email?.toLowerCase();
        console.log("Processed email (lowercase):", email);

        if (!email) {
            console.log("Error: Email is missing or empty");
            res.status(400).json({ error: "Email is required" });
            return;
        }

        console.log(`Querying database for employee with email: '${email}'`);
        const [employee] = await db
            .select()
            .from(employees)
            .where(eq(employees.email, email));

        if (!employee) {
            console.log(`Result: No employee found with email '${email}'`);
            // Don't reveal if user exists
            res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
            return;
        }

        console.log(`Result: Employee found. ID: ${employee.id}, isDeleted: ${employee.isDeleted}`);

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        console.log("Updating database with reset token...");
        await db
            .update(employees)
            .set({
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires,
            })
            .where(eq(employees.id, employee.id));
        console.log("Database updated successfully.");

        console.log("Attempting to send password reset email...");
        await sendPasswordResetEmail(email, resetToken);
        console.log("Password reset email sent successfully via nodemailer.");

        res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });

    } catch (e) {
        console.error("Forgot password error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Reset Password Endpoint
authRouter.post("/reset-password", async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            res.status(400).json({ error: "Token and new password are required" });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ error: "Password must be at least 6 characters long" });
            return;
        }

        const [employee] = await db
            .select()
            .from(employees)
            .where(
                and(
                    eq(employees.passwordResetToken, token),
                    gt(employees.passwordResetExpires, new Date())
                )
            );

        if (!employee) {
            res.status(400).json({ error: "Invalid or expired reset token" });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db
            .update(employees)
            .set({
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
            })
            .where(eq(employees.id, employee.id));

        // Sync password to all mirror employee records
        await syncEmployeeAuthFields(employee.id, employee.email, {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
        });

        res.status(200).json({ message: "Password reset successfully" });

    } catch (e) {
        console.error("Reset password error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default authRouter;
