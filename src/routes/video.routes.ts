import { Router } from "express";
import {
  listAvailableVideos,
  getVideoDetails,
} from "../controllers/video.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// GET /api/videos - List videos accessible to the logged-in user
// Requires authentication based on current setup in video.controller.ts
router.get("/", authenticateToken, listAvailableVideos);

// GET /api/videos/:videoId - Get details for a specific video
// Requires authentication based on current setup in video.controller.ts
router.get("/:videoId", authenticateToken, getVideoDetails);

// --- Admin video routes are separate in admin.video.routes.ts ---

export default router;
