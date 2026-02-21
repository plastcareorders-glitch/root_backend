import mongoose from "mongoose";

const { Schema } = mongoose;

const blogSchema = new Schema(
  {
    userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
},

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },

    images: [
      {
        public_id: {
          type: String,
          required: true,
          trim: true,
        },
        url: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Prevent model overwrite error in development / serverless
export const Blog =
  mongoose.models.Blog || mongoose.model("Blog", blogSchema);
