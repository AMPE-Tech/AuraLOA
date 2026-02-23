import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { computeSHA256 } from "./evidence_pack";

const DPO_LOCK_DIR = path.resolve("./Saida/dpo_locks");
const DPO_AUDIT_LOG = path.resolve("./Saida/dpo_audit.jsonl");

export interface DPOLockEntry {
  lock_id: string;
  resource: string;
  locked_at_iso: string;
  locked_by: string;
  reason: string;
  sha256_at_lock: string;
  status: "LOCKED" | "UNLOCKED";
  unlock_token: string | null;
  unlock_at_iso: string | null;
  unlock_by: string | null;
}

export interface DPOAuditEntry {
  timestamp_iso: string;
  action: "LOCK" | "UNLOCK" | "MODIFICATION_BLOCKED" | "MODIFICATION_AUTHORIZED" | "INTEGRITY_CHECK";
  resource: string;
  actor: string;
  details: string;
  sha256_before: string | null;
  sha256_after: string | null;
  authorization_token: string | null;
}

export interface DPOAuthorizationResult {
  authorized: boolean;
  reason: string;
  lock_id: string | null;
  resource: string;
  sha256_current: string | null;
}

const PROTECTED_RESOURCES = [
  "pipeline/dotacao",
  "pipeline/execucao",
  "pipeline/estoque",
  "pipeline/gap_analysis",
  "pipeline/valores_pdf",
  "catalog/acoes_precatorios",
  "output/evidence_pack",
  "output/contrato_tecnico",
  "config/data_sources",
  "config/tribunal_urls",
];

function ensureDirs() {
  if (!fs.existsSync(DPO_LOCK_DIR)) fs.mkdirSync(DPO_LOCK_DIR, { recursive: true });
  const auditDir = path.dirname(DPO_AUDIT_LOG);
  if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
}

function appendAuditLog(entry: DPOAuditEntry) {
  ensureDirs();
  fs.appendFileSync(DPO_AUDIT_LOG, JSON.stringify(entry) + "\n", "utf-8");
}

function getLockPath(resource: string): string {
  const safeName = resource.replace(/\//g, "__");
  return path.join(DPO_LOCK_DIR, `${safeName}.lock.json`);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function lockResource(resource: string, lockedBy: string, reason: string, contentHash: string): DPOLockEntry {
  ensureDirs();
  const lockPath = getLockPath(resource);
  const lockId = crypto.randomUUID();
  const unlockToken = generateToken();

  const entry: DPOLockEntry = {
    lock_id: lockId,
    resource,
    locked_at_iso: new Date().toISOString(),
    locked_by: lockedBy,
    reason,
    sha256_at_lock: contentHash,
    status: "LOCKED",
    unlock_token: computeSHA256(unlockToken),
    unlock_at_iso: null,
    unlock_by: null,
  };

  fs.writeFileSync(lockPath, JSON.stringify(entry, null, 2), "utf-8");

  appendAuditLog({
    timestamp_iso: new Date().toISOString(),
    action: "LOCK",
    resource,
    actor: lockedBy,
    details: reason,
    sha256_before: null,
    sha256_after: contentHash,
    authorization_token: null,
  });

  return { ...entry, unlock_token: unlockToken };
}

export function checkResourceLock(resource: string): DPOLockEntry | null {
  const lockPath = getLockPath(resource);
  if (!fs.existsSync(lockPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    return data as DPOLockEntry;
  } catch {
    return null;
  }
}

export function isResourceLocked(resource: string): boolean {
  const lock = checkResourceLock(resource);
  return lock !== null && lock.status === "LOCKED";
}

export function authorizeModification(
  resource: string,
  token: string,
  authorizedBy: string,
  currentHash: string,
): DPOAuthorizationResult {
  const lock = checkResourceLock(resource);

  if (!lock || lock.status !== "LOCKED") {
    return {
      authorized: true,
      reason: "Recurso nao esta protegido por lock DPO",
      lock_id: null,
      resource,
      sha256_current: currentHash,
    };
  }

  const tokenHash = computeSHA256(token);
  if (tokenHash !== lock.unlock_token) {
    appendAuditLog({
      timestamp_iso: new Date().toISOString(),
      action: "MODIFICATION_BLOCKED",
      resource,
      actor: authorizedBy,
      details: "Token de autorizacao DPO invalido",
      sha256_before: lock.sha256_at_lock,
      sha256_after: currentHash,
      authorization_token: tokenHash.slice(0, 16) + "...",
    });

    return {
      authorized: false,
      reason: "BLOQUEADO: Token de autorizacao DPO invalido. Alteracao requer autorizacao expressa do DPO.",
      lock_id: lock.lock_id,
      resource,
      sha256_current: currentHash,
    };
  }

  appendAuditLog({
    timestamp_iso: new Date().toISOString(),
    action: "MODIFICATION_AUTHORIZED",
    resource,
    actor: authorizedBy,
    details: "Modificacao autorizada com token DPO valido",
    sha256_before: lock.sha256_at_lock,
    sha256_after: currentHash,
    authorization_token: tokenHash.slice(0, 16) + "...",
  });

  return {
    authorized: true,
    reason: "Modificacao autorizada pelo DPO",
    lock_id: lock.lock_id,
    resource,
    sha256_current: currentHash,
  };
}

export function unlockResource(resource: string, token: string, unlockedBy: string): { success: boolean; message: string } {
  const lock = checkResourceLock(resource);
  if (!lock || lock.status !== "LOCKED") {
    return { success: false, message: "Recurso nao esta travado" };
  }

  const tokenHash = computeSHA256(token);
  if (tokenHash !== lock.unlock_token) {
    appendAuditLog({
      timestamp_iso: new Date().toISOString(),
      action: "MODIFICATION_BLOCKED",
      resource,
      actor: unlockedBy,
      details: "Tentativa de unlock com token invalido",
      sha256_before: lock.sha256_at_lock,
      sha256_after: null,
      authorization_token: null,
    });
    return { success: false, message: "Token de autorizacao DPO invalido" };
  }

  lock.status = "UNLOCKED";
  lock.unlock_at_iso = new Date().toISOString();
  lock.unlock_by = unlockedBy;
  const lockPath = getLockPath(resource);
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2), "utf-8");

  appendAuditLog({
    timestamp_iso: new Date().toISOString(),
    action: "UNLOCK",
    resource,
    actor: unlockedBy,
    details: "Lock DPO removido com autorizacao",
    sha256_before: lock.sha256_at_lock,
    sha256_after: null,
    authorization_token: tokenHash.slice(0, 16) + "...",
  });

  return { success: true, message: "Recurso destravado com sucesso" };
}

export function checkIntegrity(resource: string, currentHash: string): {
  intact: boolean;
  lock: DPOLockEntry | null;
  message: string;
} {
  const lock = checkResourceLock(resource);
  if (!lock || lock.status !== "LOCKED") {
    return { intact: true, lock: null, message: "Sem lock DPO ativo" };
  }

  const intact = lock.sha256_at_lock === currentHash;

  appendAuditLog({
    timestamp_iso: new Date().toISOString(),
    action: "INTEGRITY_CHECK",
    resource,
    actor: "system",
    details: intact ? "Integridade OK" : `VIOLACAO: hash mudou de ${lock.sha256_at_lock} para ${currentHash}`,
    sha256_before: lock.sha256_at_lock,
    sha256_after: currentHash,
    authorization_token: null,
  });

  return {
    intact,
    lock,
    message: intact
      ? "Integridade verificada - conteudo nao foi alterado desde o lock"
      : `ALERTA: Conteudo foi alterado sem autorizacao DPO. Hash original: ${lock.sha256_at_lock.slice(0, 16)}... Hash atual: ${currentHash.slice(0, 16)}...`,
  };
}

export function listAllLocks(): DPOLockEntry[] {
  ensureDirs();
  const files = fs.readdirSync(DPO_LOCK_DIR).filter(f => f.endsWith(".lock.json"));
  return files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DPO_LOCK_DIR, f), "utf-8"));
      return { ...data, unlock_token: data.status === "LOCKED" ? "[REDACTED]" : null };
    } catch {
      return null;
    }
  }).filter(Boolean) as DPOLockEntry[];
}

export function getAuditLog(limit: number = 100): DPOAuditEntry[] {
  ensureDirs();
  if (!fs.existsSync(DPO_AUDIT_LOG)) return [];
  const lines = fs.readFileSync(DPO_AUDIT_LOG, "utf-8").trim().split("\n").filter(Boolean);
  return lines.slice(-limit).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean).reverse();
}

export function getProtectedResources(): string[] {
  return [...PROTECTED_RESOURCES];
}

export function lockAllPipelineResources(lockedBy: string, reason: string): {
  locked: string[];
  tokens: Record<string, string>;
} {
  const locked: string[] = [];
  const tokens: Record<string, string> = {};

  for (const resource of PROTECTED_RESOURCES) {
    if (!isResourceLocked(resource)) {
      const contentHash = computeSHA256(resource + ":" + new Date().toISOString());
      const entry = lockResource(resource, lockedBy, reason, contentHash);
      locked.push(resource);
      if (entry.unlock_token) tokens[resource] = entry.unlock_token;
    }
  }

  return { locked, tokens };
}
