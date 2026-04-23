import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

const require = createRequire(resolve(process.cwd(), "package.json"));
const _pdfParseModule = require("pdf-parse");
const pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number; info: any; metadata: any }> =
  typeof _pdfParseModule === "function" ? _pdfParseModule : _pdfParseModule?.default ?? _pdfParseModule;

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Uso: tsx dev_dump_pdf.ts <caminho_pdf>");
  process.exit(1);
}

const buffer = readFileSync(pdfPath);
const parsed = await pdfParse(buffer);

console.log("══════════════════════════════════════════════════════════════════════");
console.log(`📄 ARQUIVO: ${pdfPath}`);
console.log(`📊 Páginas: ${parsed.numpages}`);
console.log(`📊 Chars extraídos: ${parsed.text.length}`);
console.log(`📊 Bytes do arquivo: ${buffer.length.toLocaleString("pt-BR")}`);
console.log(`📋 Info PDF:`, JSON.stringify(parsed.info, null, 2));
console.log("══════════════════════════════════════════════════════════════════════");
console.log();
console.log("═══════════════════════ TEXTO BRUTO 100% ═══════════════════════");
console.log();
console.log(parsed.text);
console.log();
console.log("═══════════════════════ FIM DO TEXTO ═══════════════════════");
process.exit(0);
