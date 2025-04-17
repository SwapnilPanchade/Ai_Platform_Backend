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
