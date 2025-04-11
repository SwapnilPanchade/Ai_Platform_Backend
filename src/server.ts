import express, { Express, Request, Response } from "express";
import cors from "cors";
import connectDB from "./db";
import authRoutes from "./routes/auth.routes";
import mongoose from "mongoose";
import dotenv from "dotenv";
import healthRoutes from "./routes/health.routes";
import paymentRoutes from "./routes/payment.routes";
import { metricsMiddleware } from "./controllers/health.controller";

dotenv.config();
const app: Express = express();
const PORT: number = parseInt(process.env.PORT || "5001", 10);

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/payments", paymentRoutes);
app.use(metricsMiddleware);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World! API is running ");
});

mongoose.connection.once("open", () => {
  console.log("MongoDB connection open. Starting server...");
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});
