import express from "express";
import {
    createMemory,
    fetchMemories,
    fetchSingleMemory,
    editMemory,
    deleteMemory,
    toggleReaction
} from "../controllers/userMemory.controller.js";

import upload from "../middlewares/uploadMiddleware.js";
import { checkAuth } from "../middlewares/checkAuth.js";
import { createBlog, deleteBlog, updateBlog } from "../controllers/admin/admin.controller.js";
import { checkAdmin } from "../middlewares/checkAdmin.js";
// 👆 assumes your JWT middleware is named "protect"

export const memoryRouter = express.Router();


// ✅ Test Route
memoryRouter.get("/test", (req, res) => {
    res.send("Memory route working 🚀");
});


// ================= MEMORY ROUTES =================

// CREATE MEMORY (max 10 images)
memoryRouter.post(
    "/create",
    checkAuth,
    upload.array("images", 10),
    createMemory
);


// FETCH ALL MEMORIES (timeline)
memoryRouter.get(
    "/",
    checkAuth,
    fetchMemories
);
memoryRouter.put("/react/:id", checkAuth, toggleReaction);


// FETCH SINGLE MEMORY
memoryRouter.get(
    "/:id",
    checkAuth,
    fetchSingleMemory
);


// EDIT MEMORY
memoryRouter.put(
    "/:id",
    checkAuth,
    upload.array("images", 10),
    editMemory
);


// DELETE MEMORY
memoryRouter.delete(
    "/:id",
    checkAuth,
    deleteMemory
);

memoryRouter.post(
    "/create-blog",
    checkAdmin,
    upload.array("images", 10),
    createBlog
);
memoryRouter.put('/update-blog/:id',checkAdmin,upload.array("images", 10),updateBlog)
memoryRouter.delete('/delete-blog/:id',checkAdmin,deleteBlog)
