import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { query } from "../db";

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

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
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

// ── DB helpers ───────────────────────────────────────────────────────────────

interface DbUser {
  email: string;
  password_hash: string;
  role: "admin" | "user";
  name: string;
  created_at: string;
  active: boolean;
  expires_at?: string | null;
  last_login_at?: string | null;
}

function dbToManaged(u: DbUser): ManagedUser {
  return {
    email: u.email,
    passwordHash: u.password_hash,
    role: u.role,
    name: u.name,
    createdAt: u.created_at,
    active: u.active,
    expiresAt: u.expires_at ?? undefined,
    lastLoginAt: u.last_login_at ?? undefined,
  };
}

async function findUser(email: string): Promise<ManagedUser | undefined> {
  const rows = await query<DbUser>(
    "SELECT * FROM aura_users WHERE LOWER(email) = LOWER($1)",
    [email],
  );
  return rows[0] ? dbToManaged(rows[0]) : undefined;
}

// ── Auth middleware ──────────────────────────────────────────────────────────

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

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if ((req as any).authUser?.role !== "admin") {
      return res.status(403).json({ message: "Acesso restrito a administradores" });
    }
    next();
  });
}

// ── Auth endpoints ───────────────────────────────────────────────────────────

router.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email e senha sao obrigatorios" });
  }
  try {
    const user = await findUser(email);
    if (!user || !user.active) {
      return res.status(401).json({ message: "Credenciais invalidas" });
    }
    if (hashPassword(password) !== user.passwordHash) {
      return res.status(401).json({ message: "Credenciais invalidas" });
    }
    if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
      return res.status(403).json({ message: "Acesso expirado. Entre em contato com o administrador." });
    }
    await query(
      "UPDATE aura_users SET last_login_at = NOW() WHERE LOWER(email) = LOWER($1)",
      [email],
    );
    const token = generateToken(user.email, user.role);
    return res.json({ token, email: user.email, role: user.role, name: user.name });
  } catch (err: any) {
    return res.status(500).json({ message: "Erro interno no login", error: err.message });
  }
});

router.get("/api/auth/me", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Nao autenticado" });
  }
  const result = validateToken(authHeader.slice(7));
  if (!result.valid) return res.status(401).json({ message: "Token invalido" });
  try {
    const user = await findUser(result.email!);
    if (!user || !user.active) return res.status(401).json({ message: "Usuario inativo" });
    return res.json({ email: user.email, role: user.role, name: user.name });
  } catch (err: any) {
    return res.status(500).json({ message: "Erro interno", error: err.message });
  }
});

router.post("/api/auth/logout", (_req: Request, res: Response) => {
  return res.json({ ok: true });
});

// ── Admin endpoints ──────────────────────────────────────────────────────────

router.get("/api/admin/users", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await query<DbUser>("SELECT * FROM aura_users ORDER BY created_at ASC");
    const sanitized = rows.map((u) => {
      const { password_hash: _h, ...safe } = u;
      return {
        email: safe.email,
        name: safe.name,
        role: safe.role,
        createdAt: safe.created_at,
        active: safe.active,
        expiresAt: safe.expires_at ?? undefined,
        lastLoginAt: safe.last_login_at ?? undefined,
      };
    });
    return res.json(sanitized);
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao listar usuarios", error: err.message });
  }
});

router.post("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
  const { email, name, password, role, expiresAt } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ message: "email, name e password sao obrigatorios" });
  }
  try {
    const existing = await findUser(email);
    if (existing) return res.status(409).json({ message: "Email ja cadastrado" });

    await query(
      `INSERT INTO aura_users (email, password_hash, role, name, created_at, active, expires_at)
       VALUES ($1, $2, $3, $4, NOW(), TRUE, $5)`,
      [
        email.toLowerCase().trim(),
        hashPassword(password),
        role === "admin" ? "admin" : "user",
        name.trim(),
        expiresAt || null,
      ],
    );

    const created = await findUser(email);
    if (!created) return res.status(500).json({ message: "Erro ao criar usuario" });
    const { passwordHash: _h, ...safe } = created;
    return res.status(201).json(safe);
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao criar usuario", error: err.message });
  }
});

router.put("/api/admin/users/:email", requireAdmin, async (req: Request, res: Response) => {
  const { name, role, active, password, expiresAt } = req.body;
  const paramEmail = String(req.params.email);
  try {
    const user = await findUser(paramEmail);
    if (!user) return res.status(404).json({ message: "Usuario nao encontrado" });

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined)   { updates.push(`name = $${idx++}`);          values.push(name.trim()); }
    if (role !== undefined)   { updates.push(`role = $${idx++}`);          values.push(role === "admin" ? "admin" : "user"); }
    if (active !== undefined) { updates.push(`active = $${idx++}`);        values.push(Boolean(active)); }
    if (password && password.length >= 6) { updates.push(`password_hash = $${idx++}`); values.push(hashPassword(password)); }
    if (expiresAt !== undefined) { updates.push(`expires_at = $${idx++}`); values.push(expiresAt || null); }

    if (updates.length > 0) {
      values.push(paramEmail.toLowerCase());
      await query(
        `UPDATE aura_users SET ${updates.join(", ")} WHERE LOWER(email) = LOWER($${idx})`,
        values,
      );
    }

    const updated = await findUser(paramEmail);
    if (!updated) return res.status(404).json({ message: "Usuario nao encontrado" });
    const { passwordHash: _h, ...safe } = updated;
    return res.json(safe);
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao atualizar usuario", error: err.message });
  }
});

router.delete("/api/admin/users/:email", requireAdmin, async (req: Request, res: Response) => {
  const authUser = (req as any).authUser;
  const paramEmail = String(req.params.email);
  if (authUser.email.toLowerCase() === paramEmail.toLowerCase()) {
    return res.status(400).json({ message: "Nao e possivel remover seu proprio usuario" });
  }
  try {
    const result = await query<{ email: string }>(
      "DELETE FROM aura_users WHERE LOWER(email) = LOWER($1) RETURNING email",
      [paramEmail],
    );
    if (result.length === 0) return res.status(404).json({ message: "Usuario nao encontrado" });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ message: "Erro ao remover usuario", error: err.message });
  }
});

export default router;
