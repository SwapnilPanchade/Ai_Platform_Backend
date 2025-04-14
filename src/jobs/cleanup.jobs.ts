import { Job, Agenda } from "agenda";
import Log from "../models/Log";
import logger from "../utils/logger";
import { saveLogToDb } from "../services/log.service";

export default function defineCleanupJobs(agenda: Agenda) {
  const jobName = "cleanup-old-logs";

  agenda.define(jobName, async (job: Job) => {
    logger.info(`Starting job: ${jobName}`);
    const daysToKeep = 90; // Keep logs for 90 days (configurable)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    logger.info(
      { cutoffDate },
      `Attempting to delete logs older than ${daysToKeep} days.`
    );

    try {
      const result = await Log.deleteMany({
        timestamp: { $lt: cutoffDate },
      });

      const deleteCount = result.deletedCount || 0;
      logger.info(
        { deleteCount },
        `Successfully completed job: ${jobName}. Deleted ${deleteCount} old log entries.`
      );

      if (deleteCount > 0) {
        saveLogToDb({
          level: "info",
          message: `Log cleanup job completed. Deleted ${deleteCount} entries older than ${daysToKeep} days.`,
          meta: { cutoffDate: cutoffDate.toISOString(), deleteCount },
        });
      }
    } catch (error: any) {
      console.log("Error at cleanup.jobs.ts", error);
      logger.error({ err: error }, `Error during job ${jobName}`);
      saveLogToDb({
        level: "error",
        message: `Log cleanup job failed: ${error.message}`,
        error: error,
      });
      throw error;
    }
  });

  logger.info(`Job definition registered: ${jobName}`);
}
