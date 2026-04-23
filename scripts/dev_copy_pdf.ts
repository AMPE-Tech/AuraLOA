import { readdirSync, copyFileSync, statSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const srcDir = resolve(
  "Precatórios Ricardo",
);
const pattern = process.argv[2] ?? "188MM";
const dstDir = "C:\\Temp";
if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });

const files = readdirSync(srcDir).filter(
  (f) => f.toLowerCase().endsWith(".pdf") && f.includes(pattern),
);

console.log(`Achados ${files.length} PDFs com "${pattern}":\n`);
for (const f of files) {
  const src = join(srcDir, f);
  const size = statSync(src).size;
  const safeName = f.replace(/[^a-zA-Z0-9.\-_()]/g, "_").slice(0, 120);
  const dst = join(dstDir, safeName);
  copyFileSync(src, dst);
  console.log(`✓ ${f}`);
  console.log(`  ${size.toLocaleString("pt-BR")} bytes`);
  console.log(`  → ${dst}\n`);
}
process.exit(0);
