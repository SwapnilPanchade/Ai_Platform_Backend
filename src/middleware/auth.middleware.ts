import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User, { IUser, UserRole } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("JWT_SECRET not set in environment variables.");

    res
      .status(500)
      .json({ message: "Internal Server Error: JWT configuration missing" });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload & {
      userId: string;
      role: UserRole;
    };
    req.user = { id: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err);
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: "Unauthorized: Token expired" });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ message: "Forbidden: Invalid token" });
    } else {
      res.status(403).json({ message: "Forbidden: Token verification failed" });
    }
  }
};

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.role) {
      res
        .status(401)
        .json({ message: "Unauthorized: User role not available" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource`,
      });
      return;
    }
    next();
  };
};
