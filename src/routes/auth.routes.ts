// src/routes/auth.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { registerUser, loginUser } from "../controllers/auth.controller";
import { registerSchema, loginSchema } from "../validators/user.validator";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware";

const router = Router();

const validateRegister = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    registerSchema.shape.body.parse(req.body);
    next();
  } catch (error: any) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));
      res.status(400).json({ status: "fail", errors });
    } else {
      console.error("Registration Validation Error:", error);
      res
        .status(500)
        .json({ status: "error", message: "Internal validation error" });
    }
  }
};
const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    loginSchema.shape.body.parse(req.body);
    next();
  } catch (error: any) {
    if (error instanceof ZodError) {
      const errors = error.errors.map((err) => ({
        path: err.path.join("."),
        message: err.message,
      }));
      res.status(400).json({ status: "fail", errors });
    } else {
      console.error("Login Validation Error:", error);
      res
        .status(500)
        .json({ status: "error", message: "Internal validation error" });
    }
  }
};

router.post("/register", validateRegister, registerUser);
router.post("/login", validateLogin, loginUser);


// GET /api/auth/profile - Example route to get logged-in user's profile
router.get("/profile", authenticateToken, (req, res) => {
  if (!req.user) {
   
    res.status(401).send({ message: "Not authenticated" });
    return; // Add simple return
  }
  res.status(200).json({
    message: "User profile data",
    user: req.user,
  });
});

// GET /api/auth/admin-test - Example Admin-Only Route

router.get(
  "/admin-test",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res) => {
    res.status(200).json({ message: "Welcome, Admin!", user: req.user });
  }
);

// GET /api/auth/pro-test - Example Pro or Admin Route

router.get(
  "/pro-test",
  authenticateToken,
  authorizeRoles("pro", "admin"),
  (req, res) => {
    res
      .status(200)
      .json({ message: "Welcome, Pro or Admin User!", user: req.user });
  }
);

export default router;
