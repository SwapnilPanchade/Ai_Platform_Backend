import express, { Express, Request, Response } from "express";
import pinoHttp from "pino-http";
import logger from "./utils/logger";
import { saveLogToDb } from "./services/log.service";
import cors from "cors";
import connectDB from "./db";
import agenda from "./config/agenda";
import defineEmailJob from "./jobs/email.jobs";
import authRoutes from "./routes/auth.routes";
import mongoose from "mongoose";
import dotenv from "dotenv";
import healthRoutes from "./routes/health.routes";
import paymentRoutes from "./routes/payment.routes";
import webhookRoutes from "./routes/webhook.routes";
import { metricsMiddleware } from "./controllers/health.controller";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { setupWebSocket } from "./websocket";
import rateLimit from "express-rate-limit";
import defineCleanupJobs from "./jobs/cleanup.jobs";

dotenv.config();
const app: Express = express();
const PORT: number = parseInt(process.env.PORT || "5001", 10);
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const httpLogger = pinoHttp({
  logger: logger,

  customSuccessMessage: function (req, res) {
    if (res.statusCode >= 400)
      return `${req.method} ${req.url} completed with status ${res.statusCode}`;
    return `${req.method} ${req.url} completed successfully`;
  },
  customErrorMessage: function (req, res, err) {
    return `Request ${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
  },
  wrapSerializers: true,
  autoLogging: {
    ignore: (req) => {
      return req.url === "/health" || req.url === "/health/metrics";
    },
  },
});

connectDB()
  .then(async () => {
    defineEmailJob(agenda);
    defineCleanupJobs(agenda);
    try {
      await agenda.start();
      await agenda.every(
        "0 3 * * *",
        "cleanup-old-logs",
        {},
        { timezone: "Etc/UTC" }
      );

      logger.info(" Recurring jobs scheduled successfully.");
    } catch (scheduleError) {
      logger.error(
        { err: scheduleError },
        " Failed to schedule recurring jobs. Early exit"
      );
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(
      "Error while connecting the DB and deifining mail job 'Agenda' n server.ts"
    );
    process.exit(1);
  });

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Limiting each IP to 100 genral api calls
  message:
    "Too many requests created from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5, // Limit each IP to 5 login/register attempts per window
  message:
    "Too many login/registration attempts from this IP, please try again after 5 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use("/webhooks", webhookRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/payments", paymentRoutes);
app.use(metricsMiddleware);
app.use((err: any, req: Request, res: Response, next: Function) => {
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
      },
      req: { method: req.method, url: req.url, ip: req.ip },
      userId: (req as any).user?.id,
    },
    `Unhandled error occurred processing ${req.method} ${req.url}`
  );

  saveLogToDb({
    level: "error",
    message: `Unhandled error: ${err.message}`,
    error: err,
    userId: (req as any).user?.id,
    ipAddress: req.ip,
    method: req.method,
    url: req.url,
    status: err.status || 500,
  });

  if (!res.headersSent) {
    res.status(err.status || 500).json({
      message: err.message || "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }
});

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World! API is running ");
});

setupWebSocket(io);

mongoose.connection.once("open", () => {
  console.log("MongoDB connection open. Starting server...");
  httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});

mongoose.connection.on("error", (err) => {
  console.log(`MongoDB connection error : ${err}`);
});
