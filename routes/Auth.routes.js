import express from "express";
import { registerUser, loginUser, logoutUser } from "../controllers/authController.js";
import { loginInviteUser, registerInviteUser } from "../controllers/invite.controller.js";
import { getAllBlogs } from "../controllers/admin/admin.controller.js";

const Authrouter = express.Router();

// ✅ Register
Authrouter.post("/register", registerUser);

// ✅ Login
Authrouter.post("/login", loginUser);
Authrouter.post('/logout',logoutUser)
Authrouter.post('/register/:role/:userId',registerInviteUser)
Authrouter.post('/login/:role/:userId',loginInviteUser)
Authrouter.get('/blog',getAllBlogs)
export default Authrouter;
