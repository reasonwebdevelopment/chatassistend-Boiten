import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const MISTRAL_API_KEY =
  process.env.MISTRAL_API_KEY || "fallback-secret-for-dev";

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res
      .status(401)
      .json({ error: "Toegang geweigerd: Token ontbreekt." });
  }

  try {
    const decoded = jwt.verify(token, MISTRAL_API_KEY);
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Ongeldig of verlopen token." });
  }
};

export const signToken = (payload: object) => {
  return jwt.sign(payload, MISTRAL_API_KEY, { expiresIn: "24h" });
};
