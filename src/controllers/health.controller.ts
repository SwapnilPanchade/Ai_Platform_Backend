import mongoose, { mongo } from "mongoose";
import { Request, Response } from "express";
import client, {
  collectDefaultMetrics,
  register,
  Histogram,
} from "prom-client";

interface HealthStatus {
  status: "UP" | "DOWN";
  components: {
    [key: string]: {
      status: "UP" | "DOWN" | "UNKNOWN";
      details?: string;
    };
  };
  timestamp: string;
}
export const getHealthStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const health: HealthStatus = {
    status: "UP",
    components: {
      api: { status: "UP" },
      database: { status: "UNKNOWN" },
      websocket: { status: "UNKNOWN" },
    },
    timestamp: new Date().toISOString(),
  };

  let httpStatus = 200; //def http 200
  try {
    const dbState = mongoose.connection.readyState;
    if (dbState === 1) {
      health.components.database.status = "UP";
      try {
        await mongoose.connection.db?.admin().ping();
        health.components.database.status = "UP";
      } catch (pingError: any) {
        health.components.database.status = "DOWN";
        health.components.database.details =
          pingError.message || "Failed to ping database";
        health.status = "DOWN";
        httpStatus = 503;
      }
    } else {
      health.components.database.status = "DOWN";
      health.components.database.details = `Mongoose readyState: ${dbState}`;
      health.status = "DOWN";
      httpStatus = 503;
    }
  } catch (error: any) {
    health.components.database.status = "DOWN";
    health.components.database.details =
      error.message || "Error checking database status";
    health.status = "DOWN";
    httpStatus = 503;
  }
  res.status(httpStatus).json(health);
};

collectDefaultMetrics({ prefix: "ai_platform_" });

const httpRequestDurationMicroseconds = new Histogram({
  name: "ai_platform_http_request_duration",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const getMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    res.set("Content-type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error("Error getting Prometheus Metrics reading : ", error);
    res
      .status(500)
      .end(error instanceof Error ? error.message : "Error fetching metrics");
  }
};

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: Function
) => {
  const route = req.path;
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on("finish", () => {
    end({
      method: req.method,
      route: route,
      status_code: res.statusCode,
    });
  });
  next();
};
