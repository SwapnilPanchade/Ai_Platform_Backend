import mongoose, { Schema, Document } from "mongoose";
export type VidoeAccessLevel = "public" | "free" | "pro" | "admin";

export interface IVideo extends Document {
  title: string;
  description?: string;
  duration?: number;
  order?: number;
  accessLevel: VidoeAccessLevel;
  muxAssetId?: string;
  muxPlaybackId?: string;
  muxProcessingStatus?: "preparing" | "ready" | "errored";
  thumbnailUrl?: string;
  isPublished?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
