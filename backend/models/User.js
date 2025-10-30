// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String },
    name: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
  },
  { timestamps: true }
);

// avoid model overwrite in watch mode
const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
