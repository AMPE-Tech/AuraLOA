import { Router, Request, Response } from "express";
import crypto from "crypto";

const router = Router();

const SESSION_SECRET = process.env.SESSION_SECRET || "aura-loa-default-secret-key";

interface AdminUser {
  email: string;
  passwordHash: string;
  role: "admin";
  name: string;
}

const ADMIN_USERS: AdminUser[] = [
  {
    email: "marcos@auradue.com",
    passwordHash: "8b2fbcc9e81edb71958e1b965f626452f2733e105a5b67b5a016200bf0162001",
    role: "admin",
    name: "Marcos",
  },
];

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function findAdmin(email: string): AdminUser | undefined {
  return ADMIN_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function generateToken(email: string, role: string): string {
  const payload = `${email}:${role}:${Date.now()}`;
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  return Buffer.from(`${payload}:${hmac.digest("hex")}`).toString("base64");
}

function validateToken(token: string): { valid: boolean; email?: string; role?: string } {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 4) return { valid: false };
    const hash = parts.pop()!;
    const payload = parts.join(":");
    const hmac = crypto.createHmac("sha256", SESSION_SECRET);
    hmac.update(payload);
    const expected = hmac.digest("hex");
    if (hash === expected) {
      return { valid: true, email: parts[0], role: parts[1] };
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

  const admin = findAdmin(email);
  if (!admin) {
    return res.status(401).json({ message: "Credenciais invalidas" });
  }

  const inputHash = hashPassword(password);
  if (inputHash !== admin.passwordHash) {
    return res.status(401).json({ message: "Credenciais invalidas" });
  }

  const token = generateToken(admin.email, admin.role);
  return res.json({ token, email: admin.email, role: admin.role, name: admin.name });
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
  const admin = findAdmin(result.email!);
  return res.json({ email: result.email, role: result.role, name: admin?.name });
});

router.post("/api/auth/logout", (_req: Request, res: Response) => {
  return res.json({ ok: true });
});

export default router;
