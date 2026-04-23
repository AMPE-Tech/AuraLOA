import multer from "multer";
import { createHash } from "crypto";
import { mkdirSync, existsSync, renameSync } from "fs";
import { resolve } from "path";
import { platform } from "os";

const DEFAULT_WIN = "C:/Temp/auraloa-saida/uploads_v2";
const DEFAULT_LINUX = "/var/www/auraloa/uploads_v2";

export const UPLOADS_DIR_V2 =
  process.env.UPLOADS_DIR_V2 || (platform() === "win32" ? DEFAULT_WIN : DEFAULT_LINUX);

if (!existsSync(UPLOADS_DIR_V2)) {
  mkdirSync(UPLOADS_DIR_V2, { recursive: true });
  console.log(`[V2] Pasta de uploads criada: ${UPLOADS_DIR_V2}`);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR_V2),
  filename: (_req, file, cb) => {
    const tmp = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    cb(null, tmp);
  },
});

export const uploadPdfV2 = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são aceitos"));
    }
  },
});

import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";

export function renameToContentHash(tmpPath: string): { finalPath: string; sha256: string } {
  const buffer = readFileSync(tmpPath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const finalName = `${sha256}.pdf`;
  const finalPath = join(UPLOADS_DIR_V2, finalName);

  if (existsSync(finalPath)) {
    unlinkSync(tmpPath);
  } else {
    renameSync(tmpPath, finalPath);
  }

  return { finalPath: resolve(finalPath), sha256 };
}
