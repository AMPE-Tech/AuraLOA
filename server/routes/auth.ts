import { Router, Request, Response } from "express";
import crypto from "crypto";

const router = Router();

const SESSION_SECRET = process.env.SESSION_SECRET || "aura-loa-default-secret-key";

function generateToken(email: string): string {
  const payload = `${email}:${Date.now()}`;
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  return Buffer.from(`${payload}:${hmac.digest("hex")}`).toString("base64");
}

function validateToken(token: string): { valid: boolean; email?: string } {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 3) return { valid: false };
    const hash = parts.pop()!;
    const payload = parts.join(":");
    const hmac = crypto.createHmac("sha256", SESSION_SECRET);
    hmac.update(payload);
    const expected = hmac.digest("hex");
    if (hash === expected) {
      return { valid: true, email: parts[0] };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

router.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email e senha sao obrigatorios" });
  }
  const token = generateToken(email);
  return res.json({ token, email });
});

router.get("/api/auth/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Nao autenticado" });
  }
  const token = authHeader.slice(7);
  const result = validateToken(token);
  if (!result.valid) {
    return res.status(401).json({ message: "Token invalido" });
  }
  return res.json({ email: result.email });
});

router.post("/api/auth/logout", (_req: Request, res: Response) => {
  return res.json({ ok: true });
});

export default router;
