import mongoose from "mongoose";
import dns from "dns";

export const dbState = {
  connected: false,
  lastError: null,
};

function sanitizeMongoUri(rawUri) {
  let uri = String(rawUri || "").trim();
  // Strip accidental key prefix if pasted into cloud dashboard value box
  uri = uri.replace(/^MONGO_URI\s*=\s*/i, "");
  // Strip surrounding single or double quotes
  uri = uri.replace(/^["']+|["']+$/g, "").trim();
  return uri || "mongodb://127.0.0.1:27017/hcm-lite";
}

const connectDB = async () => {
  const uri = sanitizeMongoUri(process.env.MONGO_URI);
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });
    dbState.connected = true;
    dbState.lastError = null;
    console.log(`MongoDB connected: ${conn.connection.host} (${conn.connection.name})`);
    return conn;
  } catch (firstErr) {
    // Fallback for ISPs or environments where default DNS fails SRV resolution
    if (
      uri.startsWith("mongodb+srv://") &&
      /querySrv|EREFUSED|ESERVFAIL|ETIMEOUT|ENOTFOUND/i.test(String(firstErr.message))
    ) {
      try {
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000 });
        dbState.connected = true;
        dbState.lastError = null;
        console.log(
          `MongoDB connected (public DNS fallback): ${conn.connection.host} (${conn.connection.name})`
        );
        return conn;
      } catch (retryErr) {
        dbState.connected = false;
        dbState.lastError = retryErr.message;
        console.error(`MongoDB connection error: ${retryErr.message}`);
        return null;
      }
    }
    dbState.connected = false;
    dbState.lastError = firstErr.message;
    console.error(`MongoDB connection error: ${firstErr.message}`);
    return null;
  }
};

export async function connectDBWithRetry() {
  const conn = await connectDB();
  if (conn) return conn;

  // Retry every 10s so cloud containers stay online while IP whitelist or URI is updated
  const timer = setInterval(async () => {
    if (mongoose.connection.readyState === 1) {
      dbState.connected = true;
      dbState.lastError = null;
      clearInterval(timer);
      return;
    }
    console.log("Retrying MongoDB connection...");
    const ok = await connectDB();
    if (ok) clearInterval(timer);
  }, 10000);

  return null;
}

export default connectDB;
