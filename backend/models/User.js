import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: String,
  name: String,
  accessToken: String,
  refreshToken: String,
});

const User = mongoose.model("User", userSchema);
export default User;
