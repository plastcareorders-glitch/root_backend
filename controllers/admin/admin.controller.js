import { Blog } from "../../models/Blog.model.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import UserMemory from "../../models/UserMemory.model.js";
import User from "../../models/UserAuth.model.js";

// ================= CREATE BLOG =================
export const createBlog = async (req, res) => {
  try {
    // ✅ Auth Check
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { title, description, tags } = req.body;

    // ✅ Required Fields
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    // ✅ Images Required
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Images are required",
      });
    }

    if (req.files.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Maximum 10 images allowed",
      });
    }

    let images = [];

    // ✅ Upload to Cloudinary
    for (const file of req.files) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "blogs",
      });

      images.push({
        public_id: result.public_id,
        url: result.secure_url,
      });

      // ✅ Delete local file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    // ✅ Convert tags (if sent as string)
    let formattedTags = [];
    if (tags) {
      if (typeof tags === "string") {
        formattedTags = tags.split(",").map((tag) => tag.trim());
      } else {
        formattedTags = tags;
      }
    }

    // ✅ Create Blog
    const blog = await Blog.create({
      userId: req.user._id, // make sure your schema has this field
      title,
      description,
      images,
      tags: formattedTags,
    });

    return res.status(201).json({
      success: true,
      blog,
    });

  } catch (error) {
    console.error("❌ Create Blog Error:", error);

    // Cleanup local files if error
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

// ================= UPDATE BLOG =================

export const updateBlog = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;
    const { title, description, tags } = req.body;

    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // ✅ Ownership Check
    if (blog.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this blog",
      });
    }

    let isUpdated = false;

    // ================= UPDATE TEXT FIELDS =================

    if (title !== undefined) {
      blog.title = title.trim();
      isUpdated = true;
    }

    if (description !== undefined) {
      blog.description = description.trim();
      isUpdated = true;
    }

    if (tags !== undefined) {
      if (typeof tags === "string") {
        blog.tags = tags.split(",").map((tag) => tag.trim());
      } else if (Array.isArray(tags)) {
        blog.tags = tags;
      }
      isUpdated = true;
    }

    // ================= UPDATE IMAGES =================

    if (req.files && req.files.length > 0) {
      if (req.files.length > 10) {
        return res.status(400).json({
          success: false,
          message: "Maximum 10 images allowed",
        });
      }

      // ✅ Delete old images from Cloudinary
      await Promise.all(
        blog.images.map((image) =>
          cloudinary.uploader.destroy(image.public_id)
        )
      );

      // ✅ Upload new images (parallel upload)
      const uploadPromises = req.files.map((file) =>
        cloudinary.uploader.upload(file.path, { folder: "blogs" })
      );

      const results = await Promise.all(uploadPromises);

      blog.images = results.map((result) => ({
        public_id: result.public_id,
        url: result.secure_url,
      }));

      // ✅ Cleanup local files
      req.files.forEach((file) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });

      isUpdated = true;
    }

    // ================= CHECK IF NOTHING UPDATED =================

    if (!isUpdated) {
      return res.status(400).json({
        success: false,
        message: "No fields provided to update",
      });
    }

    await blog.save();

    return res.status(200).json({
      success: true,
      blog,
    });

  } catch (error) {
    console.error("❌ Update Blog Error:", error);

    // Cleanup local files on error
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


// ================= DELETE BLOG =================
export const deleteBlog = async (req, res) => {
  try {
    // ✅ Auth Check
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    // ✅ Find Blog
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // ✅ Ownership Check
    if (blog.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this blog",
      });
    }

    // ✅ Delete images from Cloudinary
    for (const image of blog.images) {
      await cloudinary.uploader.destroy(image.public_id);
    }

    // ✅ Delete Blog
    await Blog.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });

  } catch (error) {
    console.error("❌ Delete Blog Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= FETCH ALL BLOGS =================
export const getAllBlogs = async (req, res) => {
  try {
    // ✅ Fetch All Blogs (Sorted by createdAt descending)
    const blogs = await Blog.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      blogs,
    });

  } catch (error) {
    console.error("❌ Get All Blogs Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= FETCH SINGLE BLOG =================
export const getSingleBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Find Blog by ID
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.status(200).json({
      success: true,
      blog,
    });

  } catch (error) {
    console.error("❌ Get Single Blog Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const fetchAllUserAndMemory = async (req, res) => {
  try {
    const memories = await UserMemory.find()
      .populate("userId", "username email") // only fetch needed fields
      .sort({ createdAt: -1 }); // newest first (recommended)

    if (memories.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No memories found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Memories fetched successfully",
      count: memories.length,
      memories,
    });

  } catch (error) {
    console.error("❌ fetchAllUserAndMemory error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const fetchAllUser = async (req, res) => {
  try {
    const users = await User.find();

    // If no users found
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      count: users.length,
      data: users,
    });

  } catch (error) {
    console.error("fetchAllUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const fetchUserStatics = async (req, res) => {
  try {
    // Fetch documents
    const users = await User.find().select("-password");
    const memories = await UserMemory.find();
    const blogs = await Blog.find();

    // Count
    const userCount = users.length;
    const memoryCount = memories.length;
    const blogCount = blogs.length;

    return res.status(200).json({
      success: true,
      message: "Statistics fetched successfully",
      stats: {
        totalUsers: userCount,
        totalMemories: memoryCount,
        totalBlogs: blogCount,
      },
      data: {
        users,
        memories,
        blogs,
      },
    });

  } catch (error) {
    console.error("fetchUserStatics error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};