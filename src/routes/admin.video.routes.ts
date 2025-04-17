import { Router } from "express";
import {
  createUpdateUrl,
  createVideoMetadata,
} from "../controllers/admin.video.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router();

// POST /api/admin/videos/upload-url - Get a direct upload URL from Mux
router.post(
  "/upload-url",
  authenticateToken,
  authorizeRoles("admin"),
  createUpdateUrl
);

// POST /api/admin/videos - Save video metadata after successful Mux upload
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  createVideoMetadata
);

// Add PUT /videos/:videoId and DELETE /videos/:videoId later

export default router;
