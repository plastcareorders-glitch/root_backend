
import User from "../models/UserAuth.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { transporter } from "../utils/EmailTransporter.js";
import UserMemory from "../models/UserMemory.model.js";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// ================= TOKEN GENERATOR =================
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// ================= COOKIE OPTIONS =================
const cookieOptions = {
  httpOnly: true,
  secure: true,        // true in production (HTTPS)
  sameSite: "none",    // required for cross-origin (Vercel → Render)
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const registerInviteUser = async (req, res) => {
  try {
    const { role, userId } = req.params;
    const allowedRoles = ["Viewer", "Commenter", "Contributor"];

    // ✅ Validate params
    if (!role || !userId) {
      return res.status(400).json({
        success: false,
        message: "Role and userId are required",
      });
    }

    // ✅ Validate role
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
      });
    }

    const { username, email, password } = req.body;

    // ✅ Validate body
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email and password are required",
      });
    }

    // ✅ Check email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    // ✅ Check inviter exists
    const inviterUser = await User.findById(userId);
    if (!inviterUser) {
      return res.status(404).json({
        success: false,
        message: "Inviter user not found",
      });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create invited user
    const savedUser = await User.create({
      username,
      email,
      password: hashedPassword,
      familyCircle: [
        {
          userId,
          role : "Viewer",
        },
      ],
    });

    // ✅ Add invited user to inviter's familyCircle
    inviterUser.familyCircle.push({
      userId: savedUser._id,
      role,
    });

    await inviterUser.save();

    // ✅ Generate token
    const token = generateToken(savedUser._id);

    // ✅ Set cookie
    res.cookie("token", token, cookieOptions);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
      },
    });

  } catch (error) {
    console.error("❌ registerInviteUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const loginInviteUser = async (req, res) => {
  try {
    const { role, userId } = req.params;
    const allowedRoles = ["Viewer", "Commenter", "Contributor"];

    // ✅ Validate params
    if (!role || !userId) {
      return res.status(400).json({
        success: false,
        message: "Role and userId are required",
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
      });
    }

    // ✅ Check inviter exists
    const inviterUser = await User.findById(userId);
    if (!inviterUser) {
      return res.status(404).json({
        success: false,
        message: "Inviter user not found",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // ✅ Find invited user
    const findUser = await User.findOne({ email });
    if (!findUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Compare password
    const comparePassword = await bcrypt.compare(
      password,
      findUser.password
    );

    if (!comparePassword) {
      return res.status(400).json({
        success: false,
        message: "Incorrect password",
      });
    }

    // ✅ Prevent duplicate familyCircle relation
    const alreadyLinked = findUser.familyCircle.some(
      (member) => member.userId.toString() === userId
    );

    if (!alreadyLinked) {
      findUser.familyCircle.push({
        userId: userId,
        role: "Viewer",
      });

      await findUser.save();
    }

    const inviterAlreadyLinked = inviterUser.familyCircle.some(
      (member) => member.userId.toString() === findUser._id.toString()
    );

    if (!inviterAlreadyLinked) {
      inviterUser.familyCircle.push({
        userId: findUser._id,
        role: role,
      });

      await inviterUser.save();
    }

    // ✅ Generate token
    const token = generateToken(findUser._id);

    // ✅ Set cookie
    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        _id: findUser._id,
        username: findUser.username,
        email: findUser.email,
      },
    });

  } catch (error) {
    console.error("❌ loginInviteUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
export const InviteUser = async (req, res) => {
  try {
    // ✅ Check authentication
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { email, role } = req.body;

    // ✅ Validate input
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        message: "Email and role are required",
      });
    }

    const validRoles = ["Viewer", "Commenter", "Contributor"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const familyOwnerId = req.user._id;

    // ✅ Generate links dynamically
    const registerInviteLink = `${process.env.FRONTEND_URL}/register/${role}/${familyOwnerId}`;
    const loginInviteLink = `${process.env.FRONTEND_URL}/login/${role}/${familyOwnerId}`;

    const findUser = await User.findOne({ email });

    const inviteLink = findUser ? loginInviteLink : registerInviteLink;

    // ✅ Send Email
    await transporter.sendMail({
      from: `"Family Circle" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "You're Invited to Join My Family Circle 🎉",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Hello 👋</h2>
          <p>You have been invited to join my <strong>Family Circle</strong> as <strong>${role}</strong>.</p>
          <p>Click below to continue:</p>
          
          <a href="${inviteLink}" 
             style="
               display: inline-block;
               padding: 12px 20px;
               background-color: #4285F4;
               color: white;
               text-decoration: none;
               border-radius: 6px;
               font-weight: bold;">
             ${findUser ? "Login & Join" : "Register & Join"}
          </a>

          <p style="margin-top: 20px; font-size: 12px; color: gray;">
            If you didn’t expect this invitation, ignore this email.
          </p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Invitation sent successfully",
    });

  } catch (error) {
    console.log("InviteUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ================= FETCH FAMILY =================
export const fetchFamilyCircle = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(req.user._id)
      .select("familyCircle")
      .populate("familyCircle.userId", "username email profileImage");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      count: user.familyCircle?.length || 0,
      data: user.familyCircle || [],
    });

  } catch (error) {
    console.error("❌ fetchFamilyCircle Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE FAMILY ROLE =================
export const updateFamilyRole = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { memberId, role } = req.body;
    const validRoles = ["Viewer", "Commenter", "Contributor"];

    if (!memberId || !role) {
      return res.status(400).json({
        success: false,
        message: "memberId and role are required",
      });
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role type",
      });
    }

    // ✅ Owner is logged-in user
    const owner = await User.findById(req.user._id);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

    // ✅ Find the family member inside owner's familyCircle
    const member = owner.familyCircle?.find(
      (m) => m.userId.toString() === memberId
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Family member not found",
      });
    }

    member.role = role;
    await owner.save();

    return res.status(200).json({
      success: true,
      message: "Family role updated successfully",
      data: owner.familyCircle,
    });

  } catch (error) {
    console.error("❌ updateFamilyRole Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// ================= FETCH FAMILY MEMORIES =================
export const fetchFamilyCircleMemory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(req.user._id).select("familyCircle");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const familyIds = user.familyCircle?.map(
      (member) => member.userId
    ) || [];

    const allowedUserIds = [req.user._id, ...familyIds];

    const memories = await UserMemory.find({
      userId: { $in: allowedUserIds },
      $or: [
        { isPrivate: false },
        { userId: req.user._id },
      ],
    })
      .populate("userId", "username profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: memories.length,
      data: memories,
    });

  } catch (error) {
    console.error("❌ fetchFamilyCircleMemory Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= COMMENT ON MEMORY =================
export const DoCommitFamilyCircleMemory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { comment } = req.body;
    const { memoryId } = req.params;
    const currentUserId = req.user._id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment is required",
      });
    }

    const memory = await UserMemory.findById(memoryId);

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    const ownerId = memory.userId;

    // ✅ If owner
    if (ownerId.toString() === currentUserId.toString()) {
      memory.comments.push({
        userId: currentUserId,
        text: comment.trim(),
      });

      await memory.save();

      return res.status(200).json({
        success: true,
        message: "Comment added successfully",
      });
    }

    // ✅ Check membership directly in DB
    const owner = await User.findOne({
      _id: ownerId,
      familyCircle: {
        $elemMatch: {
          userId: currentUserId,
          role: { $ne: "Viewer" }, // Not viewer
        },
      },
    });

    if (!owner) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to comment",
      });
    }

    memory.comments.push({
      userId: currentUserId,
      text: comment.trim(),
    });

    await memory.save();

    return res.status(200).json({
      success: true,
      message: "Comment added successfully",
    });

  } catch (error) {
    console.error("❌ DoCommitFamilyCircleMemory Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const updateFamilyCircleMemory = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { memoryId } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(memoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid memory ID",
      });
    }

    const memory = await UserMemory.findById(memoryId);

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found",
      });
    }

    const ownerId = memory.userId;

    // ================= PERMISSION CHECK =================
    let isAllowed = false;

    if (ownerId.equals(currentUserId)) {
      isAllowed = true;
    } else {
      const owner = await User.findById(ownerId).select("familyCircle");

      const member = owner?.familyCircle?.find((m) =>
        m.userId.equals(currentUserId)
      );

      if (member && member.role === "Contributor") {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "Not allowed to edit memory",
      });
    }

    // 🔥 IMPORTANT FIX
    const body = req.body || {};

    // ================= UPDATE NORMAL FIELDS (OPTIONAL) =================
    if (body.title !== undefined) memory.title = body.title;
    if (body.lifeStage !== undefined) memory.lifeStage = body.lifeStage;
    if (body.description !== undefined) memory.description = body.description;
    if (body.date !== undefined) memory.date = body.date;
    if (body.isPrivate !== undefined) {
      memory.isPrivate =
        body.isPrivate === "true" || body.isPrivate === true;
    }

    // ================= IMAGE DELETE =================
    if (body.removedImages) {
      const removedImages = JSON.parse(body.removedImages);

      for (const publicId of removedImages) {
        await cloudinary.uploader.destroy(publicId);

        memory.images = memory.images.filter(
          (img) => img.publicId !== publicId
        );
      }
    }

    // ================= IMAGE UPLOAD =================
    if (req.files?.length > 0) {
      if (memory.images.length + req.files.length > 10) {
        return res.status(400).json({
          success: false,
          message: "Max 10 images allowed",
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
    console.error("❌ updateFamilyCircleMemory Error:", error);

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
