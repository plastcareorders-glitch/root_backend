import jwt from "jsonwebtoken";
import User from "../models/UserAuth.model.js";

/**
 * ✅ Protect routes - requires valid JWT (from cookie)
 * Attaches the logged-in user to req.user
 */
export const checkAuth = async (req, res, next) => {
    try {
        // 1. Get token from cookie
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Not authorized - No token provided",
            });
        }

        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Find user (exclude password)
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Not authorized - User not found",
            });
        }

        // 4. Attach user to request
        req.user = user;

        next(); // proceed to the next middleware/controller
    } catch (error) {
        console.error("Auth middleware error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Not authorized - Token failed",
        });
    }
};