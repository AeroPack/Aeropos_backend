import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5004", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  
  database: {
    url: process.env.DATABASE_URL || "postgresql://postgres:test123@localhost:5435/mydb",
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || "10", 10),
    ssl: process.env.DATABASE_SSL === "true",
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || "passwordKey",
  },
  
  sync: {
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || "500", 10),
    maxStockBatch: parseInt(process.env.MAX_STOCK_BATCH || "200", 10),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "5000", 10),
    compressionThreshold: parseInt(process.env.COMPRESSION_THRESHOLD || "10240", 10),
  },
};