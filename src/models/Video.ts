import mongoose, { Schema, Document } from "mongoose";
import { number, string } from "zod";
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

const VideoSchema: Schema<IVideo> = new Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, trim: true },
    duration: { type: Number }, //In seconds
    order: { type: Number, default: 0 },
    accessLevel: {
      type: String,
      enum: ["public", "free", "pro", "admin"],
      default: "free",
      required: true,
      index: true,
    },
    muxAssetId: { type: String, unique: true, sparse: true, index: true }, // Asset ID is unique if present
    muxPlaybackId: { type: String, index: true }, // Playback ID associated with the asset
    muxProcessingStatus: {
      type: String,
      enum: ["preparing", "ready", "errored"],
      default: "preparing",
    },
    thumbnailUrl: { type: String },
    isPublished: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

const Video = mongoose.model<IVideo>("Video", VideoSchema);

export default Video;
