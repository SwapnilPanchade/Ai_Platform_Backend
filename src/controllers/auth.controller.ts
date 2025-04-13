import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import logger from "../utils/logger";
import { saveLogToDb } from "../services/log.service";
import mongoose, { Types } from "mongoose";
import User from "../models/User";
import { sendEmail } from "../services/email.service";
import agenda from "../config/agenda";
import { RegisterInput, LoginInput } from "../validators/user.validator";
import { UserRole } from "../models/User";

const generateToken = (userId: string, role: string): string => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = Number(process.env.JWT_EXPIRES_IN) || "1h";

  if (!secret) {
    console.error(
      "JWT_SECRET is not defined in environment variables. Cannot sign token."
    );

    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  const options: SignOptions = {
    expiresIn: expiresIn,
  };

  return jwt.sign({ userId, role }, secret, options);
};

export const registerUser = async (
  req: Request<{}, {}, RegisterInput>,
  res: Response
): Promise<void> => {
  // console.log("Received the registeration data ", req.body);
  logger.info({ email: req.body.email }, "Registration Attempt Started");

  try {
    const { email, password, firstName, lastName, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn({ email }, "Registration failed: User already exists");
      res.status(409).json({ message: "User already exists with this email" });
      return;
    }

    const newUser = new User({
      email,
      password,
      firstName,
      lastName,
      role,
    });

    await newUser.save();
    logger.info({ userId: newUser._id, email }, "User registered successfully");

    // Saving registration event to DB Log
    saveLogToDb({
      level: "info",
      message: "User registered",
      userId: (newUser._id as any).toString(),
      ipAddress: req.ip,
    });

    const userResponse = newUser.toObject();
    delete userResponse.password;

    const userIdString = (newUser._id as mongoose.Types.ObjectId).toString();
    const token = generateToken(userIdString, newUser.role);
    //* Sending/Scheduling welcome email *//
    try {
      const jobData = {
        // Prepare data for the job
        to: newUser.email,
        subject: "Welcome to the AI Platform!",
        text: `Hi ${
          firstName || "there"
        },\n\nWelcome! We're excited to have you.\n\nBest regards,\nThe AI Platform Team`,
        html: `<p>Hi ${
          firstName || "there"
        },</p><p>Welcome! We're excited to have you.</p><p>Best regards,<br/>The AI Platform Team</p>`,
      };
      await agenda.now("send-email", jobData);

      // console.log(`Welcome email job scheduled for ${newUser.email}`);
      logger.info(
        { email: newUser.email },
        `Welcome email job scheduled for user ${newUser.email}`
      );
    } catch (scheduleError) {
      console.error(
        `Failed to schedule welcome email job for ${newUser.email}:`,
        scheduleError
      );
      logger.error(
        { err: scheduleError, email: req.body.email },
        `Failed to schedule welcome email job for ${newUser.email}:`
      );
    }

    res.status(201).json({
      message: "User registered successfully",
      user: userResponse,
      token: token,
    });
  } catch (error: any) {
    logger.error({ err: error, email: req.body.email }, "Registration failed");

    saveLogToDb({
      level: "error",
      message: `Registration failed: ${error.message}`,
      error: error,
      ipAddress: req.ip,
      meta: { emailAttempted: req.body.email },
    });
    if (error.name === "ValidationError") {
      res
        .status(400)
        .json({ message: "Validation failed", errors: error.errors });
    } else {
      res
        .status(500)
        .json({ message: "Internal Server Error during registration" });
    }
  }
};

export const loginUser = async (
  req: Request<{}, {}, LoginInput>,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const userIdString = (user._id as mongoose.Types.ObjectId).toString();
    const token = generateToken(userIdString, user.role);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal Server Error during login" });
  }
};
