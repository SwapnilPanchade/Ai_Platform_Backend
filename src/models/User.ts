import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcrypt";

export type UserRole = "free" | "pro" | "admin";
const userRoles: UserRole[] = ["free", "pro", "admin"];

export interface IUser extends Document {
  email: string;
  password?: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: userRoles,
      default: "free",
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  const user = await mongoose
    .model<IUser>("User")
    .findById(this._id)
    .select("+password")
    .exec();
  if (!user || !user.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, user.password);
};

const User = mongoose.model<IUser>("User", UserSchema);
export default User;
