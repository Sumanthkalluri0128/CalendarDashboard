// backend/routes/googleRoutes.js
import express from "express";
import {
  googleAuth,
  googleCallback,
  getCalendarEvents,
} from "../controllers/googleController.js";
import User from "../models/User.js";

const router = express.Router();

// Start OAuth flow
router.get("/google", googleAuth);

// OAuth callback
router.get("/google/callback", googleCallback);

// Get currently logged in user (session check)
router.get("/me", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const user = await User.findById(req.session.userId).select("name email");
    if (!user) {
      // invalid session
      req.session.destroy?.(() => {});
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ name: user.name, email: user.email });
  } catch (err) {
    console.error("/me error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Fetch calendar events
router.get("/events", getCalendarEvents);

// Logout (destroy session + clear cookie)
router.post("/logout", (req, res) => {
  try {
    req.session.destroy(() => {
      res.clearCookie("connect.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
      });
      res.json({ message: "Logged out" });
    });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Failed to logout" });
  }
});

export default router;
