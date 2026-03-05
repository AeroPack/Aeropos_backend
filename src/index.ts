import "dotenv/config";
import express from "express";
import cors from "cors";
import categoryRouter from "./routes/categories";
import unitRouter from "./routes/units";
import productRouter from "./routes/products";
import brandRouter from "./routes/brands";
import invoiceRouter from "./routes/invoices";
import syncRouter from "./routes/sync";
import authRouter from "./routes/auth";
import customerRouter from "./routes/customers";
import supplierRouter from "./routes/suppliers";
import employeeRouter from "./routes/employees";
import profileRouter from "./routes/profile";
import { initializeDatabase } from "./db/seed";

import path from "path";

import roleRouter from "./routes/roles";

const app = express();

// 1. Logging middleware (at the very top for debugging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 2. CORS configuration (must be before routes)
app.use(cors({
  origin: (origin, callback) => {
    // Allows requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);


    const allowedPatterns = [
      /localhost:\d+$/,
      /127\.0\.0\.1:\d+$/,
      /(^|\.)aeropackpos\.in$/  // This matches aeropackpos.in AND *.aeropackpos.in
    ];
    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"]
}));

// 3. Set security headers
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

// 4. Body parsing middleware
app.use(express.json());
// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/auth", authRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/units", unitRouter);
app.use("/api/products", productRouter);
app.use("/api/brands", brandRouter);
app.use("/api/customers", customerRouter);
app.use("/api/suppliers", supplierRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/invoices", invoiceRouter);
app.use("/api/sync", syncRouter);
app.use("/api/profile", profileRouter);
app.use("/api/roles", roleRouter);

app.get("/", (req, res) => {
  res.send("Welcome to Aeropack POS API!");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working", time: new Date().toISOString() });
});

// Initialize database and start server
const PORT = process.env.PORT || 5004;
initializeDatabase()
  .then(() => {
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server started on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
