// controllers/googleController.js
import { google } from "googleapis";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// --------------------- GOOGLE LOGIN ---------------------
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

  res.redirect(url);
};

// ---------------- GOOGLE CALLBACK ----------------------
const googleCallback = async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2",
    });

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
      if (tokens.refresh_token) {
        user.refreshToken = tokens.refresh_token;
      }
      await user.save();
    }

    req.session.userId = user._id;

    res.redirect("http://localhost:3000/dashboard");
  } catch (err) {
    console.error("Auth Error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
};

// ---------------- FETCH CALENDAR EVENTS ----------------
const getCalendarEvents = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
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

    authClient.on("tokens", async (tokens) => {
      if (tokens.access_token) user.accessToken = tokens.access_token;
      if (tokens.refresh_token) user.refreshToken = tokens.refresh_token;
      await user.save();
    });

    const calendar = google.calendar({ version: "v3", auth: authClient });

    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + 1);

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: lastWeek.toISOString(),
      timeMax: nextMonth.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    return res.json({ events: response.data.items || [] });
  } catch (err) {
    console.error("Calendar Error:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

export { googleAuth, googleCallback, getCalendarEvents };
