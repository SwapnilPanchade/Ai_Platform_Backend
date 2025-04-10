import { AnyZodObject, z } from "zod";
import { UserRole } from "../models/User";

export const registerSchema: AnyZodObject = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "email is required",
      })
      .email("Invalid email address"),
    password: z
      .string({
        required_error: "password is requried",
      })
      .min(8, "Password must be at least 8 characters long"),
    firstName: z
      .string({
        required_error: "First name is required",
      })
      .trim()
      .min(1, "first name cannot be empty"),
    lastName: z.string().trim().min(1, "Last name cannot be empty").optional(),
    role: z.enum(["free", "pro", "admin"]).optional(),
  }),
});

export const loginSchema: AnyZodObject = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "email is required",
      })
      .email("Invalid Email Address"),
    password: z
      .string({
        required_error: "password is required",
      })
      .min(1, "password cannot be empty"),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];

export type LoginInput = z.infer<typeof loginSchema>["body"];
