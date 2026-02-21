import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from "cloudinary";

import connectDb from "./db/mongoose.js";
import Authrouter from "./routes/Auth.routes.js";
import { checkAuth } from "./middlewares/checkAuth.js";
import { UserRouter } from "./routes/User.routes.js";
import { memoryRouter } from "./routes/Memory.routes.js";
import { adminRouter } from "./routes/admin.routes.js";

dotenv.config();
const app = express();

/* -------------------- CREATE UPLOADS FOLDER IF NOT EXISTS -------------------- */
const uploadsDir = path.resolve("./uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Uploads folder created.");
}

/* -------------------- DATABASE -------------------- */
connectDb();

/* -------------------- CLOUDINARY CONFIG -------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

/* -------------------- MIDDLEWARES -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

/* -------------------- ROUTES -------------------- */

app.get("/", (req, res) => {
  res.send("🚀 Server running successfully");
});

app.use(Authrouter);
app.use("/user", checkAuth, UserRouter);
app.use("/memory", checkAuth, memoryRouter);
app.use('/admin',adminRouter)

/* -------------------- GLOBAL ERROR HANDLER -------------------- */
app.use((err, req, res, next) => {
  console.error("🔥 GLOBAL ERROR:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
