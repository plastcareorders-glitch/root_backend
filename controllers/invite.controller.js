import User from "../models/UserAuth.model.js";
import UserMemory from "../models/UserMemory.model.js";
import { transporter } from "../utils/EmailTransporter.js";

export const SendInvite = async (req, res) => {
  try {
    const { email, role = "Viewer" } = req.body; // default role

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Logged in user is the family owner
    const familyOwnerId = req.user._id;

    // ✅ Correct invite link: use query parameter ?familyId=
    const inviteLink = `${process.env.BACKEND_URL}/auth/google?familyId=${familyOwnerId}`;

    await transporter.sendMail({
      from: `"Your App Name" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "You're Invited to Join My Family Circle 🎉",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Hello 👋</h2>
          <p>You have been invited to join my <strong>Family Circle</strong> with the role <strong>${role}</strong>.</p>
          <p>Click the button below to join securely using Google:</p>
          
          <a href="${inviteLink}" 
             style="
               display: inline-block;
               padding: 12px 20px;
               background-color: #4285F4;
               color: white;
               text-decoration: none;
               border-radius: 6px;
               font-weight: bold;
             ">
             Join with Google
          </a>

          <p style="margin-top: 20px; font-size: 12px; color: gray;">
            If you didn’t expect this invitation, you can ignore this email.
          </p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Invitation email sent successfully",
    });

  } catch (error) {
    console.log("SendInvite error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const fetchFamilyCircle = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find current user
    const user = await User.findById(userId)
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
      count: user.familyCircle.length,
      data: user.familyCircle,
    });

  } catch (error) {
    console.log("fetchFamilyCircle error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



export const updateFamilyRole = async (req, res) => {
  try {
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

    const ownerId = req.user._id;

    // Find owner
    const owner = await User.findById(ownerId);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found",
      });
    }

    // Find family member inside array
    const member = owner.familyCircle.find(
      (m) => m.userId.toString() === memberId
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Family member not found",
      });
    }

    // Update role
    member.role = role;

    await owner.save();

    return res.status(200).json({
      success: true,
      message: "Family role updated successfully",
      data: owner.familyCircle,
    });

  } catch (error) {
    console.log("updateFamilyRole error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const fetchFamilyCircleMemory = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1️⃣ Get current user with family members
    const user = await User.findById(userId).select("familyCircle");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // 2️⃣ Extract family member IDs
    const familyIds = user.familyCircle.map(member => member.userId);

    // Include your own memories also
    const allowedUserIds = [userId, ...familyIds];

    // 3️⃣ Fetch memories
    const memories = await UserMemory.find({
      userId: { $in: allowedUserIds },
      $or: [
        { isPrivate: false },           // public memories
        { userId: userId }              // your own private memories
      ]
    })
      .populate("userId", "username profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: memories.length,
      data: memories
    });

  } catch (error) {
    console.log("fetchFamilyCircleMemory error", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const DoCommitFamilyCircleMemory = async (req, res) => {
  try {
    const { comment } = req.body;
    const { memoryId } = req.params;
    const currentUserId = req.user._id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment is required"
      });
    }

    // 1️⃣ Find memory
    const memory = await UserMemory.findById(memoryId);

    if (!memory) {
      return res.status(404).json({
        success: false,
        message: "Memory not found"
      });
    }

    const ownerId = memory.userId;

    // 2️⃣ If owner → allow directly
    if (ownerId.toString() === currentUserId.toString()) {
      memory.comments.push({
        userId: currentUserId,
        text: comment
      });

      await memory.save();

      return res.status(200).json({
        success: true,
        message: "Comment added successfully"
      });
    }

    // 3️⃣ Check family role
    const owner = await User.findById(ownerId).select("familyCircle");

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Owner not found"
      });
    }

    const member = owner.familyCircle.find(
      m => m.userId.toString() === currentUserId.toString()
    );

    if (!member || member.role === "Viewer") {
      return res.status(403).json({
        success: false,
        message: "Not allowed to comment"
      });
    }

    // 4️⃣ Add comment (Commenter or Contributor)
    memory.comments.push({
      userId: currentUserId,
      text: comment
    });

    await memory.save();

    return res.status(200).json({
      success: true,
      message: "Comment added successfully"
    });

  } catch (error) {
    console.log("DoCommitFamilyCircleMemory", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};