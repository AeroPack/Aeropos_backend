import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import { companies, employees, NewCompany, NewEmployee } from "../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { auth, AuthRequest } from "../middleware/auth";
import { rolePermissions } from "../db/schema";
import { and } from "drizzle-orm";
import { getDefaultPermissions } from "../config/rbac";
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';
import { gt } from "drizzle-orm";

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
            email,
            password,
            phone,
            businessName,
            businessAddress,
            taxId,
            companyPhone,
            companyEmail
        } = req.body;

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

        // Create new company
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

        // Generate JWT token
        const token = jwt.sign({ id: createdEmployee.uuid }, JWT_SECRET);

        // Remove password from response
        const { password: _, ...employeeWithoutPassword } = createdEmployee;

        const permissions = getDefaultPermissions("admin"); // Owner is admin

        res.status(201).json({
            employee: { ...employeeWithoutPassword, permissions },
            company: createdCompany,
            token,
        });
    } catch (e) {
        console.error("Signup error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Login endpoint
authRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required" });
            return;
        }

        // Find employee by email
        const [employee] = await db
            .select()
            .from(employees)
            .where(eq(employees.email, email));

        if (!employee) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }

        // Check if employee is deleted
        if (employee.isDeleted) {
            res.status(401).json({ error: "Account has been deleted" });
            return;
        }

        // Verify password
        if (!employee.password) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, employee.password);

        if (!isPasswordValid) {
            res.status(401).json({ error: "Invalid email or password" });
            return;
        }

        // Get company details
        const [company] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, employee.companyId));

        if (!company) {
            res.status(500).json({ error: "Company not found" });
            return;
        }

        // Generate JWT token
        const token = jwt.sign({ id: employee.uuid }, JWT_SECRET);

        // Remove password from response
        const { password: _, ...employeeWithoutPassword } = employee;

        const permissions = await getUserPermissions(employee.role, employee.companyId);

        res.status(200).json({
            employee: { ...employeeWithoutPassword, permissions },
            company: company,
            token,
        });
    } catch (e) {
        console.error("Login error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

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
            .where(eq(employees.id, req.employeeId));

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

        // Remove password from response
        const { password: _, ...employeeWithoutPassword } = employee;

        const permissions = await getUserPermissions(employee.role, employee.companyId);

        res.status(200).json({
            employee: { ...employeeWithoutPassword, permissions },
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
            res.status(400).json({ error: "idToken or accessToken is required" });
            return;
        }

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
                    res.status(401).json({ error: "Invalid Google ID Token" });
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
            } catch (error) {
                console.error("Google verify Access token error:", error);
                res.status(401).json({ error: "Invalid Google Access Token" });
                return;
            }
        }

        if (!payload || !payload.email) {
            res.status(400).json({ error: "Invalid Google Token payload" });
            return;
        }

        const { email, name: payloadName, sub } = payload;
        // Use provided name or split email
        const name = payloadName || email.split('@')[0];

        // Check if employee exists
        const [existingEmployee] = await db
            .select()
            .from(employees)
            .where(eq(employees.email, email));

        if (existingEmployee) {
            // Login flow
            if (existingEmployee.isDeleted) {
                res.status(401).json({ error: "Account has been deleted" });
                return;
            }

            // Ensure email is verified if logging in with Google
            if (!existingEmployee.isEmailVerified) {
                await db
                    .update(employees)
                    .set({ isEmailVerified: true })
                    .where(eq(employees.id, existingEmployee.id));
                existingEmployee.isEmailVerified = true;
            }

            const [company] = await db
                .select()
                .from(companies)
                .where(eq(companies.id, existingEmployee.companyId));

            if (!company) {
                res.status(500).json({ error: "Company not found" });
                return;
            }

            const token = jwt.sign({ id: existingEmployee.uuid }, JWT_SECRET);
            const { password: _, ...employeeWithoutPassword } = existingEmployee;
            const permissions = await getUserPermissions(existingEmployee.role, existingEmployee.companyId);

            res.status(200).json({
                employee: { ...employeeWithoutPassword, permissions },
                company,
                token,
            });
        } else {
            // Signup flow (New User)
            // Create a default company
            const businessName = `${name}'s Company`;

            const newCompany: NewCompany = {
                businessName,
                businessAddress: null,
                taxId: null,
                phone: null,
                email: email, // Use user email for company contact
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const [createdCompany] = await db
                .insert(companies)
                .values(newCompany)
                .returning();

            // Create owner employee with random password
            // Generate a random password since it's required but won't be used for Google Auth
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
                isEmailVerified: true, // Auto-verify email for Google Sign-In
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const [createdEmployee] = await db
                .insert(employees)
                .values(newEmployee)
                .returning();

            const token = jwt.sign({ id: createdEmployee.uuid }, JWT_SECRET);
            const { password: _, ...employeeWithoutPassword } = createdEmployee;
            const permissions = getDefaultPermissions("admin");

            res.status(201).json({
                employee: { ...employeeWithoutPassword, permissions },
                company: createdCompany,
                token,
            });
        }

    } catch (e) {
        console.error("Google Auth error:", e);
        res.status(500).json({ error: "Internal server error" });
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
        const { email } = req.body;

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
        const { email } = req.body;

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
            res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
            return;
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db
            .update(employees)
            .set({
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires,
            })
            .where(eq(employees.id, employee.id));

        await sendPasswordResetEmail(email, resetToken);

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

        res.status(200).json({ message: "Password reset successfully" });

    } catch (e) {
        console.error("Reset password error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default authRouter;
