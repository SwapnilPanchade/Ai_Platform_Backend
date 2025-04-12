import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

const emailConfig = {
  production: {
    host: process.env.EMAIL_HOST || "",
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    auth: {
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASS || "",
    },
  },

  test: {
    host: process.env.EMAIL_HOST_TEST || "smtp.ethereal.email",
    port: parseInt(process.env.EMAIL_PORT_TEST || "587", 10),
    secure: process.env.EMAIL_SECURE_TEST === "true",
    auth: {
      user: "",
      pass: "",
    },
  },
  defaultFrom: process.env.EMAIL_FROM || "AI Platform <noreply@example.com>",
};

let transporter: Mail | null = null;

const getTransporter = async (): Promise<Mail> => {
  if (transporter) {
    return transporter;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("📧 Using Ethereal for email testing.");
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(" ethereal user:", testAccount.user);
      console.log(" ethereal password:", testAccount.pass);
      transporter = nodemailer.createTransport({
        host: emailConfig.test.host,
        port: emailConfig.test.port,
        secure: emailConfig.test.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log("📧 Ethereal transporter created.");
    } catch (error) {
      console.error(" Failed to create Ethereal test account:", error);
      throw new Error("Could not initialize test email transporter.");
    }
  } else {
    console.log("📧 Using Production SMTP configuration.");
    if (
      !emailConfig.production.host ||
      !emailConfig.production.auth.user ||
      !emailConfig.production.auth.pass
    ) {
      console.error(
        "Production email configuration (host, user, pass) is incomplete in .env"
      );
      throw new Error("Production email server not configured.");
    }

    const productionOptions: SMTPTransport.Options = {
      host: emailConfig.production.host,
      port: emailConfig.production.port,
      secure: emailConfig.production.port === 465,
      auth: {
        user: emailConfig.production.auth.user,
        pass: emailConfig.production.auth.pass,
      },
    };

    transporter = nodemailer.createTransport(productionOptions);

    try {
      await transporter.verify();
      console.log("Production SMTP transporter verified successfully.");
    } catch (error) {
      console.error(" Production SMTP transporter verification failed:", error);
      throw new Error("Failed to verify production email transporter.");
    }
  }

  return transporter;
};

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const mailer = await getTransporter();

    const mailOptions = {
      from: emailConfig.defaultFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const info = await mailer.sendMail(mailOptions);

    console.log(`📧 Email sent: ${info.messageId}`);

    if (
      process.env.NODE_ENV !== "production" &&
      nodemailer.getTestMessageUrl(info)
    ) {
      console.log(`✉️ Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (error: any) {
    console.error(` Error sending email to ${options.to}:`, error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};
