import { Router } from "express";
import { getAllUsers, getLogs } from "../controllers/admin.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router();

// GET /api/admin/users
router.get("/users", authenticateToken, authorizeRoles("admin"), getAllUsers);

//GET /api/admin/logs
router.get("/logs", authenticateToken, authorizeRoles("admin"), getLogs);

export default router;
