import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken"; // Import SignOptions
import mongoose, { Types } from "mongoose"; // Import mongoose to use Types.ObjectId
import User from "../models/User";
import { RegisterInput, LoginInput } from "../validators/user.validator";

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
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ message: "User already exists with this email" });
      return;
    }

    const newUser = new User({ email, password });

    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;

    const userIdString = (newUser._id as mongoose.Types.ObjectId).toString();
    const token = generateToken(userIdString, newUser.role);

    res.status(201).json({
      message: "User registered successfully",
      user: userResponse,
      token: token,
    });
  } catch (error: any) {
    console.error("Registration Error:", error);
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
        id: user._id, // Sending the ID itself is fine here
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal Server Error during login" });
  }
};
