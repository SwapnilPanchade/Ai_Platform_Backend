import { Request, Response } from "express";
import mongoose from "mongoose";
import Video from "../models/Video";
import logger from "../utils/logger";
import { UserRole } from "../models/User";

export const listAvailableVideos = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = (req as any).user;
  const userRole: UserRole = user?.role || "free";
  logger.debug(
    { userId: user?.id, userRole },
    "Request to list available videos"
  );

  try {
    const filter: mongoose.FilterQuery<typeof Video.schema.obj> = {
      isPublished: true,
      muxProcessingStatus: "ready",
    };

    const allowedAccessLevels: string[] = ["public", "free"];
    if (userRole === "pro" || userRole === "admin")
      allowedAccessLevels.push("pro");
    if (userRole === "admin") allowedAccessLevels.push("admin");
    filter.accessLevel = { $in: allowedAccessLevels };

    const videos = await Video.find(filter)

      .select(
        "title description thumbnailUrl duration order accessLevel createdAt muxPlaybackId"
      )
      .sort({ order: 1, createdAt: -1 })
      .lean();

    res.status(200).json(videos);
  } catch (error: any) {
    logger.error({ err: error, userId: user?.id }, "Failed to list videos");
    res.status(500).json({ message: "Error fetching video list" });
  }
};

export const getVideoDetails = async (
  req: Request<{ videoId: string }>,
  res: Response
): Promise<void> => {
  const { videoId } = req.params;
  const user = (req as any).user;
  const userRole: UserRole = user?.role || "free";
  logger.debug(
    { userId: user?.id, userRole, videoId },
    "Request to get video details"
  );

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
  }

  try {
    const video = await Video.findById(videoId).lean();

    if (!video) {
      logger.warn({ videoId, userId: user?.id }, "Video not found");
      res.status(404).json({ message: "Video not found" });
      return;
    }

    let canAccess = false;
    if (video.accessLevel === "public" || video.accessLevel === "free")
      canAccess = true;
    else if (
      video.accessLevel === "pro" &&
      (userRole === "pro" || userRole === "admin")
    )
      canAccess = true;
    else if (video.accessLevel === "admin" && userRole === "admin")
      canAccess = true;
    // Unpublished check
    if (!video.isPublished && userRole !== "admin") canAccess = false;

    if (!canAccess) {
    }

    if (video.muxProcessingStatus !== "ready") {
      logger.warn(
        { videoId, userId: user?.id, status: video.muxProcessingStatus },
        "Video access denied because Mux asset is not ready or errored."
      );

      res
        .status(404)
        .json({ message: "Video is not available for playback yet." });
      return;
    }

    const responseData = {
      _id: video._id,
      title: video.title,
      description: video.description,
      duration: video.duration,
      accessLevel: video.accessLevel,

      muxPlaybackId: video.muxPlaybackId,
      thumbnailUrl: video.thumbnailUrl,
      createdAt: video.createdAt,
    };

    res.status(200).json(responseData);
  } catch (error: any) {
    /* ... error handling ... */
  }
};
