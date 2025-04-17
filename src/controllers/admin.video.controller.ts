import { Request, Response } from "express";
import mongoose from "mongoose";
import { muxClient } from "../config/mux";
import Video, { IVideo } from "../models/Video";
import logger from "../utils/logger";
import { saveLogToDb } from "../services/log.service";

export const createUpdateUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  const adminUserId = (req as any).user?.id;
  logger.info({ adminUserId }, "Admin request to create MUX direct upload url");
  console.log("Admin req to create video at admin.video.controller.ts");

  try {
    const upload = await muxClient.video.uploads.create({
      timeout: 3600,
      cors_origin: process.env.FRONTEND_URL || "http://localhost:3000",
      new_asset_settings: {
        playback_policies: ["public"], //? make it ['signed'] for private videos
        // mp4_support: 'standard', // Optional: if mp4 download needed
        // encoding_tier: 'baseline' // or 'smart' (smart requires payment)
      },
    });
    logger.info(
      { adminUserId, upload: upload.id },
      "MUX direct upload url created"
    );
    res.status(201).json({
      uploadURL: upload.url,
      uploadID: upload.id,
    });
  } catch (error: any) {
    logger.error(
      { err: error, adminUserId },
      "Failed to create Mux upload URL"
    );
    saveLogToDb({
      level: "error",
      message: `Mux upload URL creation failed: ${error.message}`,
      error,
      userId: adminUserId,
    });
    res.status(500).json({ message: "Error creating video upload session" });
  }
};

interface CreateVideoMetadataInput {
  title: string;
  description?: string;
  accessLevel: "public" | "free" | "pro" | "admin";
  isPublished?: boolean;
  muxAssetId: string;
  order?: number;
}

export const createVideoMetadata = async (
  req: Request<{}, {}, CreateVideoMetadataInput>,
  res: Response
): Promise<void> => {
  const adminUserId = (req as any).user?.id;
  const { title, description, accessLevel, isPublished, muxAssetId, order } =
    req.body;

  logger.info(
    { adminUserId, muxAssetId, title },
    "Admin request to save video metadata"
  );

  // Basic validation
  if (!title || !accessLevel || !muxAssetId) {
    logger.warn(
      { adminUserId, body: req.body },
      "Missing required fields for saving video metadata"
    );
    res.status(400).json({
      message: "Missing required fields (title, accessLevel, muxAssetId)",
    });
    return;
  }

  try {
    const existingVideo = await Video.findOne({ muxAssetId });
    if (existingVideo) {
      logger.warn(
        { adminUserId, muxAssetId },
        "Attempted to create metadata for existing Mux Asset ID"
      );
      res
        .status(409)
        .json({ message: "Video metadata for this asset already exists." });
    }

    let playbackId: string | undefined;
    let duration: number | undefined;
    let processingStatus: IVideo["muxProcessingStatus"] = "preparing";

    try {
      const asset = await muxClient.video.assets.retrieve(muxAssetId);

      playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
      duration = asset.duration;
      if (asset.status === "ready") {
        processingStatus = "ready";
      } else if (asset.status === "errored") {
        processingStatus = "errored";
      }
      logger.info(
        { adminUserId, muxAssetId, playbackId, duration, status: asset.status },
        "Fetched Mux asset details"
      );
    } catch (muxError: any) {
      logger.error(
        { err: muxError, adminUserId, muxAssetId },
        "Failed to fetch asset details from Mux during metadata creation, proceeding without playbackId/duration."
      );
    }

    const newVideo = new Video({
      title,
      description,
      accessLevel,
      isPublished: isPublished !== undefined ? isPublished : false,
      muxAssetId,
      muxPlaybackId: playbackId,
      duration: duration,
      muxProcessingStatus: processingStatus,
      order: order,
    });

    await newVideo.save();
    logger.info(
      { adminUserId, videoId: newVideo._id, muxAssetId },
      "Video metadata saved successfully"
    );

    saveLogToDb({
      level: "info",
      message: `Admin created video metadata: ${title}`,
      userId: adminUserId,
      meta: { videoId: (newVideo._id as any).toString(), muxAssetId },
    });

    res.status(201).json(newVideo);
  } catch (error: any) {
    logger.error(
      { err: error, adminUserId, muxAssetId },
      "Failed to save video metadata"
    );
    saveLogToDb({
      level: "error",
      message: `Video metadata save failed: ${error.message}`,
      error,
      userId: adminUserId,
      meta: { muxAssetId },
    });

    if (error.code === 11000) {
      res.status(409).json({ message: "Duplicate Mux Asset ID detected." });
    }
    res.status(500).json({ message: "Error saving video metadata" });
  }
};

// TODO: Implement updateVideoMetadata, deleteVideo controllers later
// updateVideoMetadata would likely take PUT /api/admin/videos/:videoId
// deleteVideo would likely take DELETE /api/admin/videos/:videoId (and optionally delete Mux asset)
