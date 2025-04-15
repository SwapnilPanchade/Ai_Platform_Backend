import { Router } from "express";
import {
  getAllUsers,
  getLogs,
  updateUserByAdmin,
  getUserByIdAdmin,
} from "../controllers/admin.controller";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router();

// GET /api/admin/users
router.get("/users", authenticateToken, authorizeRoles("admin"), getAllUsers);

// GET /api/admin/users/:userId - Fetch a single user by ID
router.get(
  "/users/:userId",
  authenticateToken,
  authorizeRoles("admin"),
  getUserByIdAdmin
);

//GET /api/admin/logs
router.get("/logs", authenticateToken, authorizeRoles("admin"), getLogs);

// PUT /api/admin/users/:userId
router.put(
  "/users/:userId",
  authenticateToken,
  authorizeRoles("admin"),
  updateUserByAdmin
);

export default router;
