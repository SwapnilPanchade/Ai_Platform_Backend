import { Agenda } from "agenda";
import dotenv from "dotenv";

dotenv.config();

const mongoConnectionString =
  process.env.MONGO_URI || "mongodb://mongodb:27017/ai_platform";

if (!mongoConnectionString) {
  console.error(
    "!!! MONGO_URI environment variable is not set. Agenda cannot connect. !!!"
  );
  throw new Error("MongoDB connection string not found for Agenda");
}

const agenda = new Agenda({
  db: {
    address: mongoConnectionString,
    collection: "agendaJobs",
  },
  processEvery: "10 seconds",
});

agenda.on("ready", () => {
  console.log(" Agenda connected to MongoDB and ready.");
  agenda.start();
});

agenda.on("error", (error) => {
  console.error(" Agenda connection error:", error);

  process.exit(1);
});

agenda.on("start", (job) => {
  console.log(` Job [${job.attrs.name}] starting. ID: ${job.attrs._id}`);
});

agenda.on("complete", (job) => {
  console.log(
    `Job [${job.attrs.name}] finished successfully. ID: ${job.attrs._id}`
  );
});

agenda.on("fail", (err, job) => {
  console.error(
    ` Job [${job.attrs.name}] failed with error: ${err.message}. ID: ${job.attrs._id}`
  );
});

// --- Graceful Shutdown ---
async function graceful() {
  console.log(" Shutting down Agenda gracefully...");
  await agenda.stop();
  console.log(" Agenda stopped.");
  process.exit(0);
}

process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);

export default agenda;
