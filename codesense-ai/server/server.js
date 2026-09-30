import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

dotenv.config();

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows cross-origin API calls & SSE
  })
);

// Rate limiter: max 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: "Too many requests from this IP, please try again later." },
});
app.use("/api/", apiLimiter);

// Dynamic CORS configuration
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

app.get("/", (req, res) => res.json({ status: "ok", message: "CodeSense AI API is live" }));
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/chat", chatRoutes);

// Central error handler
app.use((err, req, res, next) => {
  console.error("[ServerError]", err);
  res.status(500).json({ message: "Unexpected server error", error: process.env.NODE_ENV === "development" ? err.message : undefined });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`CodeSense AI API running on port ${PORT}`));
}).catch((err) => {
  console.error("[StartupError]", err);
  app.listen(PORT, () => console.log(`CodeSense AI API fallback running on port ${PORT}`));
});

