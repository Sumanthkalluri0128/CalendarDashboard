import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import googleRoutes from "./routes/googleRoutes.js";
import session from "express-session";
import MongoStore from "connect-mongo";

dotenv.config();
connectDB();

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

// ✅ Session Middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),
    cookie: {
      httpOnly: true,
      secure: false, // set to true in production with HTTPS
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

app.use("/api/auth", googleRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
