import jwt from "jsonwebtoken";

export const generateAccessToken = (userId, role) => {
  return jwt.sign(
    { userId: String(userId), role },
    process.env.JWT_SECRET || "default_jwt_secret",
    { expiresIn: "2h" }
  );
};

export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId: String(userId) },
    process.env.JWT_REFRESH_SECRET || "default_jwt_refresh_secret",
    { expiresIn: "7d" }
  );
};
