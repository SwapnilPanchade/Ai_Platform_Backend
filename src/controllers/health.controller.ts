import mongoose, { mongo } from "mongoose";
import { Request, Response } from "express";

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
