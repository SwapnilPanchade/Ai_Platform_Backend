import { Router } from "express";
import { getHealthStatus, getMetrics } from "../controllers/health.controller";

const healthRouter = Router();
healthRouter.get("/", getHealthStatus);
healthRouter.get("/metrics", getMetrics);

export default healthRouter;
