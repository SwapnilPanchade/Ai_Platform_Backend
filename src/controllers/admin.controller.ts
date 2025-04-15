import { Request, Response } from "express";
import User from "../models/User";
import { saveLogToDb } from "../services/log.service";
import logger from "../utils/logger";

//user response the things admin will see of user
interface UserListResponse {
  _id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
}

export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const requestingUserId = (req as any).user?.id;
  logger.info(
    { adminUserId: requestingUserId },
    "Admin requests to fetch all users"
  );

  try {
    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const responseUsers: UserListResponse[] = users.map((user) => ({
      _id: user._id.toString(),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    res.status(200).json(responseUsers);
  } catch (error: any) {
    console.log("error at admin.controller.ts " + error);
    logger.error(
      { err: error, adminUserId: requestingUserId },
      "Failed to fetch users for admin"
    );
    saveLogToDb({
      level: "error",
      message: `Admin user fetch failed: ${error.message}`,
      error: error,
      userId: requestingUserId,
    });
    res.status(500).json({ message: "Error fetching users" });
  }
};
