import mongoose from "mongoose";

export default async function connectDb() {
    try {

        if(!process.env.MONGODB_URL){
            throw new Error("MONGODB_URL is missing in .env");
        }

         await mongoose.connect(process.env.MONGODB_URL);

        console.log(`✅ MongoDB Connected`);

    } catch (error) {

        console.error("❌ MongoDB connection error:", error.message);

        process.exit(1); // stop server immediately
    }
}
