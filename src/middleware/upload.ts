const multer = require("multer");
import path from "path";
import fs from "fs";
import { Request } from "express";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads/profiles");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req: Request, file: any, cb: (error: Error | null, destination: string) => void) => {
        cb(null, uploadsDir);
    },
    filename: (req: Request, file: any, cb: (error: Error | null, filename: string) => void) => {
        // Generate unique filename: timestamp-randomstring.ext
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `profile-${uniqueSuffix}${ext}`);
    },
});

// File filter to accept only images
const fileFilter = (req: Request, file: any, cb: any) => {
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."));
    }
};

// Create multer instance
export const uploadProfileImage = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});
