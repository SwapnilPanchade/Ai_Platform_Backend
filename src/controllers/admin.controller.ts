import { Request, Response } from "express";
import User from "../models/User";
import { ParsedQs } from "qs";
import logger from "../utils/logger";
import mongoose from "mongoose";
import Log, { LogLevel } from "../models/Log";
import { saveLogToDb } from "../services/log.service";

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

interface LogQuery extends ParsedQs {
  page?: string;
  limit?: string;
  level?: LogLevel;
  userId?: string;
  sort?: string;
}

export const getLogs = async (
  req: Request<{}, {}, {}, LogQuery>,
  res: Response
): Promise<void> => {
  const requestingUserId = (req as any).user?.id;
  logger.info(
    { adminUserId: requestingUserId, query: req.query },
    "Admin request to fetch logs"
  );

  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "25", 10);
    const skip = (page - 1) * limit;

    const filter: mongoose.FilterQuery<typeof Log.schema.obj> = {};
    if (req.query.level) {
      filter.level = req.query.level;
    }
    if (req.query.userId) {
      filter.userId = req.query.userId;
    }

    const sortOptions: { [key: string]: mongoose.SortOrder } = {};
    const sortQuery = req.query.sort || "-timestamp";
    if (sortQuery) {
      const sortField = sortQuery.startsWith("-")
        ? sortQuery.substring(1)
        : sortQuery;
      const sortOrder = sortQuery.startsWith("-") ? -1 : 1;
      if (["timestamp", "level", "userId"].includes(sortField)) {
        sortOptions[sortField] = sortOrder;
      } else {
        sortOptions["timestamp"] = -1;
      }
    }

    const logs = await Log.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();
    const totalLogs = await Log.countDocuments(filter);
    const totalPages = Math.ceil(totalLogs / limit);

    res.status(200).json({
      data: logs,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalLogs: totalLogs,
        limit: limit,
      },
    });
  } catch (error: any) {
    logger.error(
      { err: error, adminUserId: requestingUserId, query: req.query },
      "Failed to fetch logs for admin"
    );
    saveLogToDb({
      level: "error",
      message: `Admin log fetch failed: ${error.message}`,
      error: error,
      userId: requestingUserId,
    });
    res.status(500).json({ message: "Error fetching logs" });
  }
};
