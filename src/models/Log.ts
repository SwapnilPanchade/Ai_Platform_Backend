
import mongoose, { Schema, Document } from "mongoose";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export interface ILog extends Document {
  timestamp: Date;
  level: LogLevel;
  message: string;
  userId?: string; 
  ipAddress?: string; 
  method?: string; 
  url?: string; 
  status?: number; 
  responseTime?: number; 
  errorStack?: string; 
  meta?: Record<string, any>; 
}

const LogSchema: Schema<ILog> = new Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true }, 
    level: {
      type: String,
      enum: ["fatal", "error", "warn", "info", "debug", "trace"],
      required: true,
      index: true, // Index for filtering by level
    },
    message: { type: String, required: true },
    userId: { type: String, index: true }, // Index for finding user-specific logs
    ipAddress: { type: String },
    method: { type: String },
    url: { type: String },
    status: { type: Number },
    responseTime: { type: Number },
    errorStack: { type: String },
    meta: { type: Schema.Types.Mixed }, // Store arbitrary JSON data
  },
  {
    // Optional: Cap the collection size to prevent it growing indefinitely
    // capped: { size: 1024 * 1024 * 100, max: 100000 }, // Example: 100MB or 100k documents
    timestamps: false, // Use our own 'timestamp' field
  }
);

// Optional: Create TTL index to automatically delete old logs (e.g., after 90 days)
// LogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 days

const Log = mongoose.model<ILog>("Log", LogSchema);
export default Log;
