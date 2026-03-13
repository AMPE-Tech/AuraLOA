import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";

const router = Router();

const SESSION_SECRET = process.env.SESSION_SECRET || "aura-loa-default-secret-key";

export interface ManagedUser {
  email: string;
  passwordHash: string;
  role: "admin" | "user";
  name: string;
  createdAt: string;
  active: boolean;
  expiresAt?: string;
  lastLoginAt?: string;
}

// Mutable in-memory store — resets on restart, persist via DB quando necessário
export const USERS: ManagedUser[] = [
  {
    email: "marcos@auradue.com",
    passwordHash: "8b2fbcc9e81edb71958e1b965f626452f2733e105a5b67b5a016200bf0162001",
    role: "admin",
    name: "Marcos",
    createdAt: "2025-01-01T00:00:00.000Z",
    active: true,
  },
];

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function findUser(email: string): ManagedUser | undefined {
  return USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function generateToken(email: string, role: string): string {
  const payload = `${email}:${role}:${Date.now()}`;
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  return Buffer.from(`${payload}:${hmac.digest("hex")}`).toString("base64");
}

export function validateToken(token: string): { valid: boolean; email?: string; role?: string } {
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

// Middleware — requer autenticação válida
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Nao autenticado" });
  }
  const result = validateToken(authHeader.slice(7));
  if (!result.valid) return res.status(401).json({ message: "Token invalido" });
  (req as any).authUser = result;
  next();
}

// Middleware — requer role admin
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if ((req as any).authUser?.role !== "admin") {
      return res.status(403).json({ message: "Acesso restrito a administradores" });
    }
    next();
  });
}

// ── Auth endpoints ──────────────────────────────────────────────────────────

router.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email e senha sao obrigatorios" });
  }
  const user = findUser(email);
  if (!user || !user.active) {
    return res.status(401).json({ message: "Credenciais invalidas" });
  }
  if (hashPassword(password) !== user.passwordHash) {
    return res.status(401).json({ message: "Credenciais invalidas" });
  }
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    return res.status(403).json({ message: "Acesso expirado. Entre em contato com o administrador." });
  }
  user.lastLoginAt = new Date().toISOString();
  const token = generateToken(user.email, user.role);
  return res.json({ token, email: user.email, role: user.role, name: user.name });
});

router.get("/api/auth/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Nao autenticado" });
  }
  const result = validateToken(authHeader.slice(7));
  if (!result.valid) return res.status(401).json({ message: "Token invalido" });
  const user = findUser(result.email!);
  if (!user || !user.active) return res.status(401).json({ message: "Usuario inativo" });
  return res.json({ email: user.email, role: user.role, name: user.name });
});

router.post("/api/auth/logout", (_req: Request, res: Response) => {
  return res.json({ ok: true });
});

// ── Admin endpoints ─────────────────────────────────────────────────────────

// Listar usuários
router.get("/api/admin/users", requireAdmin, (_req: Request, res: Response) => {
  const sanitized = USERS.map(({ passwordHash: _h, ...u }) => u);
  return res.json(sanitized);
});

// Criar usuário
router.post("/api/admin/users", requireAdmin, (req: Request, res: Response) => {
  const { email, name, password, role, expiresAt } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ message: "email, name e password sao obrigatorios" });
  }
  if (findUser(email)) {
    return res.status(409).json({ message: "Email ja cadastrado" });
  }
  const newUser: ManagedUser = {
    email: email.toLowerCase().trim(),
    name: name.trim(),
    passwordHash: hashPassword(password),
    role: role === "admin" ? "admin" : "user",
    createdAt: new Date().toISOString(),
    active: true,
    expiresAt: expiresAt || undefined,
  };
  USERS.push(newUser);
  const { passwordHash: _h, ...safe } = newUser;
  return res.status(201).json(safe);
});

// Atualizar usuário (nome, role, active)
router.put("/api/admin/users/:email", requireAdmin, (req: Request, res: Response) => {
  const user = findUser(req.params.email);
  if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });

  const { name, role, active, password, expiresAt } = req.body;
  if (name !== undefined) user.name = name.trim();
  if (role !== undefined) user.role = role === "admin" ? "admin" : "user";
  if (active !== undefined) user.active = Boolean(active);
  if (password && password.length >= 6) user.passwordHash = hashPassword(password);
  if (expiresAt !== undefined) user.expiresAt = expiresAt || undefined;

  const { passwordHash: _h, ...safe } = user;
  return res.json(safe);
});

// Remover usuário
router.delete("/api/admin/users/:email", requireAdmin, (req: Request, res: Response) => {
  const authUser = (req as any).authUser;
  if (authUser.email.toLowerCase() === req.params.email.toLowerCase()) {
    return res.status(400).json({ message: "Nao e possivel remover seu proprio usuario" });
  }
  const idx = USERS.findIndex((u) => u.email.toLowerCase() === req.params.email.toLowerCase());
  if (idx === -1) return res.status(404).json({ message: "Usuario nao encontrado" });
  USERS.splice(idx, 1);
  return res.json({ ok: true });
});

export default router;
