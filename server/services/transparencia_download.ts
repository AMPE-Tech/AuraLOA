import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { EvidenciaItem } from "../../shared/loa_types";

export function buildDespesasZipUrl(ano: number, mes: number): string {
  const mm = String(mes).padStart(2, "0");
  return `https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/despesas/${ano}${mm}01_Despesas.zip`;
}

export interface ZipDownloadResult {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  filePath: string;
  sha256: string;
  bytes: number;
  captured_at_iso: string;
  contentType: string | null;
}

export async function downloadZipToEvidencePack(params: {
  processId: string;
  url: string;
  outBaseDir?: string;
}): Promise<ZipDownloadResult> {
  const outBaseDir = params.outBaseDir ?? path.join(".", "Saida", "evidence");
  const captured_at_iso = new Date().toISOString();

  const rawDir = path.join(outBaseDir, params.processId, "raw");
  fs.mkdirSync(rawDir, { recursive: true });

  const filename = path.basename(new URL(params.url).pathname) || "download.zip";
  const filePath = path.join(rawDir, filename);

  const res = await fetch(params.url, { redirect: "follow" });

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    url: params.url,
    filePath,
    sha256,
    bytes: buf.length,
    captured_at_iso,
    contentType: res.headers.get("content-type"),
  };
}

export function buildZipEvidencia(dl: ZipDownloadResult): EvidenciaItem {
  return {
    source_name: "PortalTransparencia.DownloadDespesas",
    source_url: dl.url,
    captured_at_iso: dl.captured_at_iso,
    raw_payload_sha256: dl.sha256,
    raw_payload_path: dl.filePath,
  };
}
