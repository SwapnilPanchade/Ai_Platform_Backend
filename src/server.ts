import express, { Express, Request, Response } from "express";
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

connectDB()
  .then(() => {
    defineEmailJob(agenda);
  })
  .catch((err) => {
    console.error(
      "Error while connecting the DB and deifining mail job 'Agenda' n server.ts"
    );
    process.exit(1);
  });

app.use(cors());
app.use("/webhooks", webhookRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/payments", paymentRoutes);
app.use(metricsMiddleware);

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
