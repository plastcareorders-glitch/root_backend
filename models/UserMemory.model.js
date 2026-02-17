import mongoose from "mongoose";

// ================= IMAGE =================
const imageSchema = new mongoose.Schema({
    publicId: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    }
}, { _id: false });


// ================= COMMENT =================
const commentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    }
}, { timestamps: true });


// ================= REACTION =================
const reactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: ["like", "heart", "smile"],
        required: true
    }
}, { _id: false });


// ================= MEMORY =================
const userMemorySchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },

    lifeStage: {
        type: String,
        enum: [
            "Early Years",
            "School Years",
            "College",
            "Marriage & Relationships",
            "Career",
            "Retirement & Reflections"
        ],
        default : "Early Years",
        required: true
    },

    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },

    images: {
        type: [imageSchema],
        default: [],
        validate: {
            validator: val => val.length <= 100,
            message: "Maximum 100 images allowed"
        }
    },

    date: {
        type: Date,
        default: Date.now
    },

    reactions: {
        type: [reactionSchema],
        default: []
    },

    comments: {
        type: [commentSchema],
        default: []
    },

    isPrivate: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });


// ================= INDEXES =================
userMemorySchema.index({ userId: 1, createdAt: -1 });
userMemorySchema.index({ userId: 1, date: -1 });

const UserMemory = mongoose.model("UserMemory", userMemorySchema);

export default UserMemory;
