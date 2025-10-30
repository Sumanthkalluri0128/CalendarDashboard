import express from "express";
import {
  googleAuth,
  googleCallback,
  getCalendarEvents,
} from "../controllers/googleController.js";

const router = express.Router();

router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);
router.get("/events", getCalendarEvents);

export default router;
