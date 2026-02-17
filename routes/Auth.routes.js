import express from "express";
import { registerUser, loginUser } from "../controllers/authController.js";

const Authrouter = express.Router();

// ✅ Register
Authrouter.post("/register", registerUser);

// ✅ Login
Authrouter.post("/login", loginUser);

export default Authrouter;
