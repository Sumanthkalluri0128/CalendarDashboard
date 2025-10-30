// backend/controllers/googleController.js
import { google } from "googleapis";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

console.log("Loading Google Controller. ENV check:");
console.log({
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "Loaded" : "MISSING",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "Loaded" : "MISSING",
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ? "Loaded" : "MISSING",
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// initiate login
const googleAuth = (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "email",
    "profile",
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  console.log("Redirecting to Google OAuth:", url);
  res.redirect(url);
};

// callback
const googleCallback = async (req, res) => {
  console.log("Google callback hit");
  const { code } = req.query;
  if (!code) {
    console.error("Callback missing code", req.query);
    return res.status(400).json({ error: "Authorization code missing" });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
    const userInfo = await oauth2.userinfo.get();
    const { id, email, name } = userInfo.data;

    let user = await User.findOne({ googleId: id });

    if (!user) {
      user = await User.create({
        googleId: id,
        email,
        name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
    } else {
      user.accessToken = tokens.access_token;
      // update refresh token only if provided
      if (tokens.refresh_token) user.refreshToken = tokens.refresh_token;
      await user.save();
    }

    req.session.userId = user._id;

    const FRONTEND = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
    res.redirect(`${FRONTEND}/dashboard`);
  } catch (err) {
    console.error("googleCallback error:", err);
    res.status(500).json({
      error: "Authentication failed",
      message: err.message,
      response: err.response?.data,
    });
  }
};

// fetch events
const getCalendarEvents = async (req, res) => {
  console.log("getCalendarEvents called");
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      console.warn("No user in session");
      return res.status(401).json({ error: "User not authenticated" });
    }

    const authClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    authClient.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
    });

    // persist refreshed tokens
    authClient.on("tokens", async (tokens) => {
      try {
        if (tokens.access_token) user.accessToken = tokens.access_token;
        if (tokens.refresh_token) user.refreshToken = tokens.refresh_token;
        await user.save();
        console.log("Persisted refreshed tokens for:", user.email);
      } catch (err) {
        console.error("Failed to save refreshed tokens:", err);
      }
    });

    // If we lack a refresh token, require re-login (safer)
    if (!user.refreshToken) {
      // allow access_token to work for a short time if present, but prefer re-login
      return res.status(401).json({ error: "Re-login required" });
    }

    const calendar = google.calendar({ version: "v3", auth: authClient });

    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + 1);

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: lastWeek.toISOString(),
      timeMax: nextMonth.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    return res.json({ events: response.data.items || [] });
  } catch (err) {
    console.error("getCalendarEvents error:", err);
    res.status(500).json({
      error: "Failed to fetch events",
      message: err.message,
      response: err.response?.data,
    });
  }
};

export { googleAuth, googleCallback, getCalendarEvents };
