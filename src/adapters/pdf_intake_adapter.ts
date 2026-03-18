import crypto from "crypto";
import type { EvidencePack } from "../../server/services/evidence_pack";

export type PdfIntakeMode = "reference_only" | "content_partial" | "content_full";

export interface PdfIntakeInput {
  tribunal?: string;
  ano?: number;
  url_referencia?: string;
  file_name?: string;
  evidencePack: EvidencePack;
  metadados?: Record<string, unknown>;
}

export interface PdfIntakeResult {
  source_name: string;
  source_kind: "pdf_oficial";
  intake_mode: PdfIntakeMode;
  reference_name: string;
  reference_url: string | null;
  file_name: string;
  reference_sha256: string;
  metadata: Record<string, unknown>;
  raw_text_excerpt: string | null;
  note: string;
  collected_at: string;
}

// Derivação do nome de arquivo a partir da URL quando não fornecido explicitamente.
function deriveFileName(url: string | undefined, tribunal: string | undefined, ano: number | undefined): string {
  if (url) {
    const parts = url.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last.includes(".")) return last;
  }
  const t = tribunal ?? "tribunal";
  const a = ano ?? "s-d";
  return `precatorios-${t}-${a}.pdf`;
}

// SHA-256 estável sobre a referência controlada (tribunal:ano:url).
// NÃO é hash de conteúdo do PDF — registrado explicitamente em metadata.
function hashReference(tribunal: string, ano: string, url: string): string {
  return crypto.createHash("sha256").update(`${tribunal}:${ano}:${url}`).digest("hex");
}

export async function runPdfIntakeAdapter(input: PdfIntakeInput): Promise<PdfIntakeResult> {
  const { tribunal, ano, url_referencia, evidencePack, metadados } = input;
  const collected_at = new Date().toISOString();

  const tribunalStr = tribunal ?? "desconhecido";
  const anoStr = ano?.toString() ?? "s-d";
  const urlStr = url_referencia ?? "";

  const file_name = input.file_name ?? deriveFileName(urlStr, tribunal, ano);

  // Hash sobre a referência, não sobre o conteúdo do PDF.
  const reference_sha256 = hashReference(tribunalStr, anoStr, urlStr || file_name);

  evidencePack.log(
    `[pdf_intake_adapter] intake_mode=reference_only tribunal=${tribunalStr} ` +
    `ano=${anoStr} file=${file_name} sha256=${reference_sha256.slice(0, 16)}...`,
  );

  const metadata: Record<string, unknown> = {
    tribunal,
    ano,
    file_name,
    reference_url: urlStr || null,
    hash_subject: "referencia_controlada",
    hash_input: `${tribunalStr}:${anoStr}:${urlStr || file_name}`,
    intake_mode: "reference_only",
    ...metadados,
  };

  return {
    source_name: "PDF Oficial de Precatórios (Tribunais)",
    source_kind: "pdf_oficial",
    intake_mode: "reference_only",
    reference_name: file_name,
    reference_url: urlStr || null,
    file_name,
    reference_sha256,
    metadata,
    raw_text_excerpt: null,
    note: "Intake por referência controlada — sem leitura de conteúdo nesta etapa. " +
          "SHA-256 calculado sobre identificador de referência (tribunal:ano:url), não sobre bytes do PDF.",
    collected_at,
  };
}
