import UserMemory from "../models/UserMemory.model.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// ================= CREATE MEMORY =================
export const createMemory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { title, lifeStage, description, date, isPrivate } = req.body;

    if (!title || !lifeStage || !description || !date) {
      return res.status(400).json({
        success: false,
        message: "title, lifeStage, description and date are required",
      });
    }

    // ✅ Make images required
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Images are required",
      });
    }

    if (req.files.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Max 10 images allowed",
      });
    }

    let images = [];

    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "memories",
      });

      images.push({
        publicId: result.public_id,
        url: result.secure_url,
      });

      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    const memory = await UserMemory.create({
      userId: req.user._id,
      title,
      lifeStage,
      description,
      date,
      images,
      isPrivate: isPrivate === "true" || isPrivate === true,
    });

    return res.status(201).json({
      success: true,
      memory,
    });

  } catch (error) {
    console.error("❌ Create Memory Error:", error);

    if (req.files?.length > 0) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// ================= FETCH ALL MEMORIES =================
export const fetchMemories = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const memories = await UserMemory.find({
      userId: req.user._id,
    })
      .populate([
        { path: "userId", select: "username profileImage" },
        { path: "reactions.userId", select: "username profileImage" },
        { path: "comments.userId", select: "username profileImage" },
      ])
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: memories.length,
      memories,
    });

  } catch (error) {
    console.error("❌ fetchMemories Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= TOGGLE REACTION =================
export const toggleReaction = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { type } = req.body;

    if (!["like", "heart", "smile"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reaction type",
      });
    }

    const memory = await UserMemory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    const userId = req.user._id.toString();

    memory.reactions = (memory.reactions || []).filter(
      (r) => r && r.userId
    );

    const existingIndex = memory.reactions.findIndex(
      (r) => r.userId.toString() === userId
    );

    if (existingIndex !== -1) {
      if (memory.reactions[existingIndex].type === type) {
        memory.reactions.splice(existingIndex, 1);
      } else {
        memory.reactions[existingIndex].type = type;
      }
    } else {
      memory.reactions.push({
        userId: req.user._id,
        type,
      });
    }

    await memory.save();

    const counts = { like: 0, heart: 0, smile: 0 };

    memory.reactions.forEach((r) => {
      if (counts[r.type] !== undefined) {
        counts[r.type]++;
      }
    });

    return res.status(200).json({
      success: true,
      reactionCounts: counts,
      userReaction:
        memory.reactions.find(
          (r) => r.userId.toString() === userId
        )?.type || null,
    });

  } catch (error) {
    console.error("❌ toggleReaction Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= FETCH SINGLE MEMORY =================
export const fetchSingleMemory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const memory = await UserMemory.findById(req.params.id)
      .populate("userId", "username profileImage");

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    if (
      memory.isPrivate &&
      memory.userId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    return res.status(200).json({
      success: true,
      memory,
    });

  } catch (error) {
    console.error("❌ fetchSingleMemory Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= EDIT MEMORY =================
export const editMemory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const memory = await UserMemory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    if (memory.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { title, lifeStage, description, date, isPrivate } = req.body;

    if (title) memory.title = title;
    if (lifeStage) memory.lifeStage = lifeStage;
    if (description) memory.description = description;
    if (date) memory.date = date;
    if (isPrivate !== undefined)
      memory.isPrivate = isPrivate === "true" || isPrivate === true;

    if (req.files?.length > 0) {
      const totalImages = memory.images.length + req.files.length;

      if (totalImages > 100) {
        return res.status(400).json({
          success: false,
          message: "Max 100 images allowed",
        });
      }

      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "memories",
        });

        memory.images.push({
          publicId: result.public_id,
          url: result.secure_url,
        });

        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    await memory.save();

    return res.status(200).json({
      success: true,
      message: "Memory updated successfully",
      memory,
    });

  } catch (error) {
    console.error("❌ editMemory Error:", error);

    if (req.files?.length > 0) {
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= DELETE MEMORY =================
export const deleteMemory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const memory = await UserMemory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    if (memory.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    for (const img of memory.images || []) {
      if (img.publicId) {
        await cloudinary.uploader.destroy(img.publicId);
      }
    }

    await memory.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Memory deleted successfully",
    });

  } catch (error) {
    console.error("❌ deleteMemory Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
