import { Router } from "express";
import { getAllUsers } from "../controllers/admin.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router();

// GET /api/admin/users
router.get("/users", authenticateToken, authorizeRoles("admin"), getAllUsers);

export default router;
