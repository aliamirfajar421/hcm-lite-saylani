import jwt from "jsonwebtoken";
import User from "../models/User.js";

const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  // Also allow ?token= query param ONLY for direct PDF file download links if needed
  const queryToken = req.query?.token;

  const token =
    header && header.startsWith("Bearer ")
      ? header.split(" ")[1]
      : typeof queryToken === "string"
        ? queryToken
        : null;

  if (!token) {
    return res.status(401).json({ message: "No authentication token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_jwt_secret");
    const user = await User.findById(decoded.userId).select("-password -refreshToken");
    if (!user) {
      return res.status(401).json({ message: "User account not found" });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated by Admin" });
    }

    req.user = {
      _id: user._id,
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId ? String(user.employeeId) : null,
      mustChangePassword: Boolean(user.mustChangePassword),
    };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied: requires role [${allowedRoles.join(", ")}]`,
      });
    }
    next();
  };
};

export const requirePasswordChanged = (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      code: "PASSWORD_CHANGE_REQUIRED",
      message: "You must change your temporary password before accessing the system",
    });
  }
  next();
};

export default auth;
