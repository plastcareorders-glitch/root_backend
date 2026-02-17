import express from "express";
import dotenv from "dotenv";
import connectDb from "./db/mongoose.js";
import Authrouter from "./routes/Auth.routes.js";
import cookieParser from "cookie-parser";
import { checkAuth } from "./middlewares/checkAuth.js";
import { UserRouter } from "./routes/User.routes.js";
import { memoryRouter } from "./routes/Memory.routes.js";
import { v2 as cloudinary } from "cloudinary";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import cors from "cors";
import User from "./models/UserAuth.model.js";

dotenv.config();
const app = express();

/* -------------------- DB -------------------- */
connectDb();

/* -------------------- CLOUDINARY -------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

/* -------------------- MIDDLEWARES -------------------- */
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

/* -------------------- SESSION (with production‑ready cookie) -------------------- */
const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,          // true on HTTPS
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax", // allow cross‑site in production
      maxAge: 24 * 60 * 60 * 1000,   // 1 day (adjust as needed)
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* -------------------- PASSPORT CONFIG -------------------- */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

/* -------------------- GOOGLE STRATEGY -------------------- */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (_, __, profile, done) => {
      try {
        let user = await User.findOne({
          email: profile.emails[0].value,
        });

        if (!user) {
          user = await User.create({
            username:
              profile.displayName.replace(/\s+/g, "").toLowerCase() +
              Math.floor(Math.random() * 1000),
            email: profile.emails[0].value,
            password: Math.random().toString(36).slice(-8),
            profileImage: {
              public_id: "",
              url: profile.photos[0]?.value || "",
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

/* -------------------- GOOGLE ROUTES -------------------- */

// Initiate Google OAuth – optionally accept ?familyId=xxx
app.get("/auth/google", (req, res, next) => {
  const state = req.query.familyId
    ? JSON.stringify({ familyId: req.query.familyId })
    : undefined;
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: state,
  })(req, res, next);
});

// Callback after Google authentication
app.get(
  "https://root-backend-bmfx.onrender.com/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async (req, res) => {
    try {
      // 1. Generate JWT token
      const token = jwt.sign(
        { id: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // 2. Set HTTP‑only cookie (production‑ready)
      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,          // true on HTTPS
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // 3. Extract familyId from state (if any)
      let familyId = null;
      if (req.query.state) {
        try {
          const state = JSON.parse(req.query.state);
          familyId = state.familyId;
        } catch (err) {
          console.error("Failed to parse OAuth state:", err);
        }
      }

      // 4. If familyId is present and valid, add to user's familyCircle
      if (familyId) {
        const inviter = await User.findById(familyId);
        if (inviter) {
          // Add inviter to the new user's familyCircle (if not already there)
          const alreadyInCircle = req.user.familyCircle.some(
            (entry) => entry.userId.toString() === familyId
          );
          if (!alreadyInCircle) {
            req.user.familyCircle.push({
              userId: familyId,
              role: "Viewer",
            });
            await req.user.save();
          }

          // OPTIONAL: Also add the new user to the inviter's familyCircle
          const userInInviterCircle = inviter.familyCircle.some(
            (entry) => entry.userId.toString() === req.user._id.toString()
          );
          if (!userInInviterCircle) {
            inviter.familyCircle.push({
              userId: req.user._id,
              role: "Viewer",
            });
            await inviter.save();
          }
        }
      }

      // 5. Redirect to frontend with token and user info
      const email = encodeURIComponent(req.user.email);
      const name = encodeURIComponent(req.user.username || req.user.displayName || "");
      res.redirect(`${process.env.FRONTEND_URL}/login?token=${token}&email=${email}&name=${name}`);
    } catch (error) {
      console.error("Error in Google callback:", error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
    }
  }
);

/* -------------------- OTHER ROUTES -------------------- */
app.get("/", (req, res) => {
  res.send("🚀 Server running");
});

app.use(Authrouter);
app.use("/user", checkAuth, UserRouter);
app.use("/memory", memoryRouter);

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});