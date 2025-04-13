// src/services/log.service.ts
import Log, { ILog, LogLevel } from "../models/Log"; // Import the Log model and types

interface LogEntry
  extends Partial<Omit<ILog, "timestamp" | "level" | "message">> {
  level: LogLevel;
  message: string;
  // Explicitly allow error object to extract stack
  error?: Error;
}

/**
 * Saves a structured log entry to the MongoDB database.
 * Fire-and-forget: doesn't wait for save and logs errors internally.
 * @param entry - The log entry details.
 */
export const saveLogToDb = (entry: LogEntry): void => {
  const logData: Partial<ILog> = {
    timestamp: new Date(),
    level: entry.level,
    message: entry.message,
    userId: entry.userId,
    ipAddress: entry.ipAddress,
    method: entry.method,
    url: entry.url,
    status: entry.status,
    responseTime: entry.responseTime,
    errorStack: entry.error?.stack, // Get stack trace if an error object is passed
    meta: entry.meta,
  };

  // Create instance but don't await save
  const log = new Log(logData);

  log.save().catch((err) => {
    // Log DB save error using the primary console logger (Pino)
    // Avoid infinite loop if Pino logs to DB itself! Ensure Pino logs to console.
    console.error("❌ Failed to save log entry to DB:", err);
  });
};
