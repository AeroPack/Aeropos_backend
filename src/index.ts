import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import categoryRouter from "./routes/categories";
import unitRouter from "./routes/units";
import productRouter from "./routes/products";
import brandRouter from "./routes/brands";
import invoiceRouter from "./routes/invoices";
import { syncRouter } from "./routes/sync";
import authRouter from "./routes/auth";
import customerRouter from "./routes/customers";
import supplierRouter from "./routes/suppliers";
import employeeRouter from "./routes/employees";
import profileRouter from "./routes/profile";
import companyRouter from "./routes/companies";
import { initializeDatabase } from "./db/seed";

import path from "path";

import roleRouter from "./routes/roles";
import stockSyncRouter from "./routes/stock";
import healthRouter from "./routes/health";

const app = express();

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Handle preflight requests for ALL routes before CORS middleware
app.options('*', cors());

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);

    const allowedPatterns = [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^https:\/\/main\.aeropackpos\.in$/,
      /^https:\/\/aeropackpos\.in$/
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
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Requested-With",
    "x-auth-token",
    "x-company-id"   // ← ADDED: required for Flutter sync requests
  ]
}));

app.use(compression({
  threshold: 10240, // 10KB - only compress if larger
  level: 6, // good balance of speed and compression
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/health", healthRouter);
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
app.use("/api/sync/stock", stockSyncRouter);
app.use("/api/profile", profileRouter);
app.use("/api/roles", roleRouter);
app.use("/api/companies", companyRouter);

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