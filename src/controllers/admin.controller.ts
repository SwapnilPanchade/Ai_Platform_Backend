import { Request, Response } from "express";
import User, { UserRole, SubscriptionStatus } from "../models/User";
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

interface UpdateUserInput {
  role?: UserRole;
  firstName?: string;
  lastName?: string;
}

export const updateUserByAdmin = async (
  req: Request<{ userId: string }, {}, UpdateUserInput>,
  res: Response
): Promise<void> => {
  const targetUserId = req.params.userId;
  const updateData = req.body;
  const adminUserId = (req as any).user?.id;
  logger.info(
    { adminUserId, targetUserId, updateData },
    "Admin request to update user"
  );

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    logger.warn({ adminUserId, targetUserId }, "Invalid target user ID format");
    res.status(400).json({ message: "Invalid user ID format" });
    return;
  }
  if (
    adminUserId === targetUserId &&
    updateData.role &&
    updateData.role !== "admin"
  ) {
    logger.warn({ adminUserId }, "Admin attempted to downgrade their own role");
    res.status(403).json({
      message:
        "Administrators cannot downgrade their own role via this endpoint.",
    });
    return;
  }

  try {
    const userToUpdate = await User.findById(targetUserId);

    if (!userToUpdate) {
      logger.warn(
        { adminUserId, targetUserId },
        "Target user not found for update"
      );
      res.status(404).json({ message: "User not found" });
      return;
    }

    const changes: Partial<UpdateUserInput> = {};

    if (updateData.role && ["free", "pro", "admin"].includes(updateData.role)) {
      if (userToUpdate.role !== updateData.role) {
        changes.role = updateData.role;
        userToUpdate.role = updateData.role;
        // TODO: If downgrading role from 'pro', consider potential interaction
        // with Stripe subscription (e.g., should admin cancel it too?) - complex!
        // For now, just update the role in our DB. Stripe status might override access later.
      }
    }
    // Update other allowed fields
    if (
      updateData.firstName !== undefined &&
      userToUpdate.firstName !== updateData.firstName
    ) {
      changes.firstName = updateData.firstName;
      userToUpdate.firstName = updateData.firstName;
    }
    if (
      updateData.lastName !== undefined &&
      userToUpdate.lastName !== updateData.lastName
    ) {
      changes.lastName = updateData.lastName;
      userToUpdate.lastName = updateData.lastName;
    }

    if (Object.keys(changes).length > 0) {
      await userToUpdate.save();
      logger.info(
        { adminUserId, targetUserId, changes },
        "User successfully updated by admin"
      );

      saveLogToDb({
        level: "info",
        message: `Admin updated user details. TargetUserID: ${targetUserId}`,
        userId: adminUserId,
        meta: { targetUserId, changesMade: changes },
      });

      const responseUser = userToUpdate.toObject();
      delete responseUser.password;
      res.status(200).json(responseUser);
    } else {
      logger.info(
        { adminUserId, targetUserId },
        "No changes detected for user update"
      );
      res.status(200).json(userToUpdate.toObject({ versionKey: false }));
    }
  } catch (error: any) {
    logger.error(
      { err: error, adminUserId, targetUserId },
      "Failed to update user by admin"
    );
    saveLogToDb({
      level: "error",
      message: `Admin user update failed: ${error.message}`,
      error: error,
      userId: adminUserId,
      meta: { targetUserId },
    });
    res.status(500).json({ message: "Error updating user" });
  }
};

//gettign user by userId

export const getUserByIdAdmin = async (
  req: Request<{ userId: string }>,
  res: Response
): Promise<void> => {
  const targetUserId = req.params.userId;
  const adminUserId = (req as any).user?.id;
  logger.info(
    { adminUserId, targetUserId },
    "Admin request to fetch user by Id"
  );

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    logger.warn(
      { adminUserId, targetUserId },
      "Invalid target userID format for fetch"
    );
    res.status(400).json({ message: "Invalid User id format" });
    return;
  }

  try {
    const user = await User.findById(targetUserId).select("-password").lean();

    if (!user) {
      logger.warn(
        { adminUserId, targetUserId },
        "Target user not found from fetch by ID"
      );
      res.status(404).json({ message: "User not found" });
      return;
    }
    saveLogToDb({
      level: "info",
      message: `Admin viewed user details. TargetUserID: ${targetUserId}`,
      userId: adminUserId,
    });

    res.status(200).json(user);
  } catch (error: any) {
    logger.error(
      { err: error, adminUserId, targetUserId },
      "Failed to fetch user by Id for admin"
    );
    saveLogToDb({
      level: "error",
      message: `Admin fetch user by Id failed: ${error.message}`,
      error: error,
      userId: adminUserId,
      meta: { targetUserId },
    });
    res.status(500).json({ message: "Error whiel fetching the user details" });
  }
};
