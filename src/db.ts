import mongoose from "mongoose";

const mongoUrl = "mongodb://localhost:27017/ai_platform";

const connectDB = async () => {
  try {
    await mongoose.connect(mongoUrl);
    console.log("DB connected successfully");

    mongoose.connection.on("error", (err) => {
      console.error("error in connection after setup " + err);
    });

    mongoose.connection.on("dissconnected", () => {
      console.log("DB connection disconnected");
    });
  } catch (e) {
    console.log("initial mongoose connection error in db.ts");
    process.exit(1);
  }
};

export default connectDB;
