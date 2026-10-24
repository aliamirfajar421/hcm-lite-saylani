import mongoose from "mongoose";
import dns from "dns";

const connectDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hcm-lite";
  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host} (${conn.connection.name})`);
    return conn;
  } catch (firstErr) {
    // Fallback for local ISPs that block/fail SRV lookups on default router DNS
    if (
      uri.startsWith("mongodb+srv://") &&
      /querySrv|EREFUSED|ESERVFAIL|ETIMEOUT|ENOTFOUND/i.test(String(firstErr.message))
    ) {
      try {
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        const conn = await mongoose.connect(uri);
        console.log(`MongoDB connected (public DNS fallback): ${conn.connection.host} (${conn.connection.name})`);
        return conn;
      } catch (retryErr) {
        console.error(`MongoDB connection error: ${retryErr.message}`);
        process.exit(1);
      }
    }
    console.error(`MongoDB connection error: ${firstErr.message}`);
    process.exit(1);
  }
};

export default connectDB;
