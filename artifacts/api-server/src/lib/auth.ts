import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const SECRET = process.env.SESSION_SECRET ?? "billsmart-dev-secret-change-in-prod";
const EXPIRE = "7d";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(plain: string, hashed: string): boolean {
  return bcrypt.compareSync(plain, hashed);
}

export function createToken(userId: number, email: string): string {
  return jwt.sign({ sub: String(userId), email }, SECRET, { expiresIn: EXPIRE });
}

export function decodeToken(token: string): { userId: number; email: string } {
  const payload = jwt.verify(token, SECRET) as { sub: string; email: string };
  return { userId: parseInt(payload.sub, 10), email: payload.email };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const decoded = decodeToken(header.slice(7));
    (req as Request & { userId: number }).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function getAuthUserId(req: Request): number {
  return (req as Request & { userId: number }).userId;
}
