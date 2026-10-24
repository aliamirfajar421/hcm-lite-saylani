import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import apiRoutes from "./routes/apiRoutes.js";
import { ensureEnvBootstrapIfConfigured } from "./controllers/authController.js";

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.use("/api", apiRoutes);

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "HCM Lite Backend API",
    healthEndpoint: "/api/health",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "HCM Lite Backend API",
    aiConfigured: Boolean(
      process.env.AI_API_KEY &&
      process.env.AI_API_KEY !== "your-gemini-or-groq-or-openai-api-key"
    ),
  });
});

export { app };

if (process.env.NODE_ENV !== "test") {
  connectDB().then(async () => {
    await ensureEnvBootstrapIfConfigured();
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`HCM Lite Backend running on port ${PORT}`);
    });
  });
}
