import User from "../models/UserAuth.model.js";
import UserMemory from "../models/UserMemory.model.js";
import { transporter } from "../utils/EmailTransporter.js";

// ================= SEND INVITE =================
export const SendInvite = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { email, role = "Viewer" } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
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

    const inviteLink = `${process.env.BACKEND_URL}/auth/google?familyId=${familyOwnerId}&role=${role}`;

    await transporter.sendMail({
      from: `"Family Circle" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "You're Invited to Join My Family Circle 🎉",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Hello 👋</h2>
          <p>You have been invited to join my <strong>Family Circle</strong> as <strong>${role}</strong>.</p>
          <p>Click below to join securely using Google:</p>
          
          <a href="${inviteLink}" 
             style="
               display: inline-block;
               padding: 12px 20px;
               background-color: #4285F4;
               color: white;
               text-decoration: none;
               border-radius: 6px;
               font-weight: bold;">
             Join with Google
          </a>

          <p style="margin-top: 20px; font-size: 12px; color: gray;">
            If you didn’t expect this invitation, ignore this email.
          </p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Invitation email sent successfully",
    });

  } catch (error) {
    console.error("❌ SendInvite Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
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

    const owner = await User.findById(req.user._id);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

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

    // If owner
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

    const owner = await User.findById(ownerId).select("familyCircle");

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

    const member = owner.familyCircle?.find(
      (m) => m.userId.toString() === currentUserId.toString()
    );

    if (!member || member.role === "Viewer") {
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
      message: error.message,
    });
  }
};
