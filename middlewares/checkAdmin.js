import jwt from "jsonwebtoken";
import User from "../models/UserAuth.model.js";

// ================= ADMIN MIDDLEWARE =================
export const checkAdmin = (req, res, next) => {
  try {
    // Make sure user is already authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Please login first",
      });
    }

    // Only allow this email as admin
    if (req.user.email !== "arsh@gmail.com") {
      return res.status(403).json({
        success: false,
        message: "Access denied - Admin only",
      });
    }

    next(); // Allow access
  } catch (error) {
    console.error("Admin middleware error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
