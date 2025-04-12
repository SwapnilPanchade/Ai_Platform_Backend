import { Job, Agenda } from "agenda";
import { sendEmail } from "../services/email.service";

interface EmailJobData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export default function defineEmailJob(agenda: Agenda) {
  const jobName = "send-email";

  agenda.define<EmailJobData>(jobName, async (job: Job<EmailJobData>) => {
    const { to, subject, text, html } = job.attrs.data;

    console.log(`Processing job '${jobName}' for recipient: ${to}`);
    try {
      await sendEmail({ to, subject, text, html });
      console.log(`Successfully processed job '${jobName}' for: ${to}`);
    } catch (error) {
      console.error(`Error processing job '${jobName}' for ${to}:`, error);

      throw error;
    }
  });

  console.log(`Job definition registered: ${jobName}`);
}
