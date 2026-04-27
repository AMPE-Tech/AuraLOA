import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // ── Fase 3 G10/G2 — standalone EvidencePack para drivers .cjs ──
  // Emite um bundle CJS independente de evidence_pack.ts para que os
  // scripts CommonJS (server/scripts/robo_pje/drivers/trf1.cjs e
  // enriquecer_precatorio_cnpj.cjs) possam fazer `require('./dist/lib/evidence_pack.cjs')`
  // sem depender de tsx em runtime.
  // Ref: contrato_tecnico/aditivos/aditivo_2026-04-24_fase2.md achados G10 + G2.
  console.log("building dist/lib/evidence_pack.cjs (standalone for .cjs drivers)...");
  await esbuild({
    entryPoints: ["server/services/evidence_pack.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/lib/evidence_pack.cjs",
    sourcemap: true,
    minify: false,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
