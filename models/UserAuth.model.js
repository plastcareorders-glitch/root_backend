import mongoose from "mongoose";

const familyCircleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: {
      type: String,
      enum: ["Viewer", "Commenter", "Contributor"],
      default: "Viewer"
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    profileImage: {
      public_id: {
        type: String,
        default: ""
      },
      url: {
        type: String,
        default: ""
      }
    },

    familyCircle: [familyCircleSchema]
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;
