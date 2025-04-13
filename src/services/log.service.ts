import Log, { ILog, LogLevel } from "../models/Log";

interface LogEntry
  extends Partial<Omit<ILog, "timestamp" | "level" | "message">> {
  level: LogLevel;
  message: string;
  error?: Error;
}

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
    errorStack: entry.error?.stack,
    meta: entry.meta,
  };

  const log = new Log(logData);

  log.save().catch((err) => {
    console.error("Failed to save log entry to DB:", err);
  });
};
