import { Router } from "express";
import { db } from "../db";
import { employees, companies } from "../db/schema";
import { eq, and, ne } from "drizzle-orm";
import { auth, AuthRequest } from "../middleware/auth";
import { uploadProfileImage } from "../middleware/upload";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

// Interface for requests with file uploads
interface AuthRequestWithFile extends AuthRequest {
    file?: any;
}

const profileRouter = Router();

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// GET /api/profile - Get current employee's profile and company info
profileRouter.get("/", auth, async (req: AuthRequest, res) => {
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

        // Get company from database
        const [company] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, req.companyId));

        if (!company) {
            res.status(404).json({ error: "Company not found" });
            return;
        }

        // Return flat structure combining employee and company data
        res.status(200).json({
            name: employee.name,
            email: employee.email,
            phone: employee.phone, // Employee phone
            address: employee.address,
            position: employee.position,
            userName: employee.email.split('@')[0], // Derive username from email

            // Company Data
            businessName: company.businessName,
            companyName: company.businessName, // Alias for compatibility
            businessAddress: company.businessAddress,
            taxId: company.taxId,
            companyPhone: company.phone, // Company phone
            companyEmail: company.email, // Company email

            profileImage: company.logoUrl, // Map company logo to profileImage
            imageUrl: company.logoUrl, // Alias for compatibility
        });
    } catch (e) {
        console.error("Get profile error:", e);
        res.status(500).json({ error: e });
    }
});

// PUT /api/profile - Update current employee's profile and company info
profileRouter.put("/", auth, async (req: AuthRequest, res) => {
    try {
        if (!req.employeeId || !req.companyId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const {
            name, email, phone, password, address, position, // Employee fields
            businessName, businessAddress, taxId, companyPhone, companyEmail // Company fields
        } = req.body;

        // Get current employee
        const [currentEmployee] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, req.employeeId));

        if (!currentEmployee) {
            res.status(404).json({ error: "Employee not found" });
            return;
        }

        // Validate email format if email is being updated
        if (email && email !== currentEmployee.email) {
            if (!isValidEmail(email)) {
                res.status(400).json({ error: "Invalid email format" });
                return;
            }

            // Check if email is already taken by another employee
            const [existingEmployee] = await db
                .select()
                .from(employees)
                .where(
                    and(
                        eq(employees.email, email),
                        ne(employees.id, req.employeeId)
                    )
                );

            if (existingEmployee) {
                res.status(400).json({ error: "Email already in use" });
                return;
            }
        }

        // Build employee update object with only provided fields
        const employeeUpdateData: any = {
            updatedAt: new Date(),
        };

        if (name !== undefined) employeeUpdateData.name = name;
        if (email !== undefined) employeeUpdateData.email = email;
        if (phone !== undefined) employeeUpdateData.phone = phone;
        if (address !== undefined) employeeUpdateData.address = address;
        if (position !== undefined) employeeUpdateData.position = position;

        // Hash password if being updated
        if (password !== undefined && password.length >= 6) {
            employeeUpdateData.password = await bcrypt.hash(password, 10);
        } else if (password !== undefined && password.length < 6) {
            res.status(400).json({ error: "Password must be at least 6 characters long" });
            return;
        }

        // Update employee if there are changes (more than just updatedAt)
        let updatedEmployee = currentEmployee;
        if (Object.keys(employeeUpdateData).length > 1) {
            [updatedEmployee] = await db
                .update(employees)
                .set(employeeUpdateData)
                .where(eq(employees.id, req.employeeId))
                .returning();
        }

        // Update company if any company field is provided
        let updatedCompany;
        const hasCompanyUpdates = businessName !== undefined ||
            businessAddress !== undefined ||
            taxId !== undefined ||
            companyPhone !== undefined ||
            companyEmail !== undefined;

        if (hasCompanyUpdates) {
            // Check if employee is admin or owner before allowing company updates
            if (currentEmployee.role !== "admin" && !currentEmployee.isOwner) {
                res.status(403).json({ error: "Only admins can update company information" });
                return;
            }

            const companyUpdateData: any = {
                updatedAt: new Date(),
            };

            if (businessName !== undefined) companyUpdateData.businessName = businessName;
            if (businessAddress !== undefined) companyUpdateData.businessAddress = businessAddress;
            if (taxId !== undefined) companyUpdateData.taxId = taxId;
            if (companyPhone !== undefined) companyUpdateData.phone = companyPhone;
            if (companyEmail !== undefined) companyUpdateData.email = companyEmail;

            [updatedCompany] = await db
                .update(companies)
                .set(companyUpdateData)
                .where(eq(companies.id, req.companyId))
                .returning();
        } else {
            // Get current company data
            [updatedCompany] = await db
                .select()
                .from(companies)
                .where(eq(companies.id, req.companyId));
        }

        // Return flat structure matching GET endpoint
        res.status(200).json({
            message: "Profile updated successfully",
            name: updatedEmployee.name,
            email: updatedEmployee.email,
            phone: updatedEmployee.phone,
            address: updatedEmployee.address,
            position: updatedEmployee.position,
            userName: updatedEmployee.email.split('@')[0],

            // Company Data
            businessName: updatedCompany.businessName,
            companyName: updatedCompany.businessName,
            businessAddress: updatedCompany.businessAddress,
            taxId: updatedCompany.taxId,
            companyPhone: updatedCompany.phone,
            companyEmail: updatedCompany.email,

            profileImage: updatedCompany.logoUrl,
            imageUrl: updatedCompany.logoUrl,
        });
    } catch (e) {
        console.error("Update profile error:", e);
        res.status(500).json({ error: e });
    }
});

// PUT /api/profile/company - Update company information (admin only)
profileRouter.put("/company", auth, async (req: AuthRequest, res) => {
    try {
        if (!req.employeeId || !req.companyId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Check if employee is admin or owner
        const [employee] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, req.employeeId));

        if (!employee || (employee.role !== "admin" && !employee.isOwner)) {
            res.status(403).json({ error: "Only admins can update company information" });
            return;
        }

        const { businessName, businessAddress, taxId, phone, email, logoUrl } = req.body;

        // Build update object with only provided fields
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (businessName !== undefined) updateData.businessName = businessName;
        if (businessAddress !== undefined) updateData.businessAddress = businessAddress;
        if (taxId !== undefined) updateData.taxId = taxId;
        if (phone !== undefined) updateData.phone = phone;
        if (email !== undefined) updateData.email = email;
        if (logoUrl !== undefined) updateData.logoUrl = logoUrl;

        // Update company
        const [updatedCompany] = await db
            .update(companies)
            .set(updateData)
            .where(eq(companies.id, req.companyId))
            .returning();

        res.status(200).json({
            message: "Company information updated successfully",
            company: updatedCompany,
        });
    } catch (e) {
        console.error("Update company error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/profile/upload-image - Upload company logo (admin only)
profileRouter.post("/upload-image", auth, uploadProfileImage.single("image"), async (req: AuthRequestWithFile, res) => {
    try {
        if (!req.employeeId || !req.companyId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        // Check if employee is admin or owner
        const [employee] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, req.employeeId));

        if (!employee || (employee.role !== "admin" && !employee.isOwner)) {
            res.status(403).json({ error: "Only admins can update company logo" });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        // Get current company to delete old logo if exists
        const [currentCompany] = await db
            .select()
            .from(companies)
            .where(eq(companies.id, req.companyId));

        if (!currentCompany) {
            res.status(404).json({ error: "Company not found" });
            return;
        }

        // Delete old logo if exists
        if (currentCompany.logoUrl) {
            const oldImagePath = path.join(process.cwd(), currentCompany.logoUrl);
            if (fs.existsSync(oldImagePath)) {
                try {
                    fs.unlinkSync(oldImagePath);
                } catch (err) {
                    console.error("Error deleting old image:", err);
                }
            }
        }

        // Save file path to database (relative path)
        const imagePath = `/uploads/profiles/${req.file.filename}`;

        const [updatedCompany] = await db
            .update(companies)
            .set({
                logoUrl: imagePath,
                updatedAt: new Date(),
            })
            .where(eq(companies.id, req.companyId))
            .returning();

        res.status(200).json({
            message: "Company logo uploaded successfully",
            company: updatedCompany,
            imageUrl: imagePath,
        });
    } catch (e) {
        console.error("Upload image error:", e);
        // Delete uploaded file if database update fails
        if (req.file) {
            const filePath = path.join(process.cwd(), "uploads/profiles", req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        res.status(500).json({ error: "Internal server error" });
    }
});

export default profileRouter;
