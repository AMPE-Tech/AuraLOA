import * as fs from "fs";
import * as path from "path";
import { computeSHA256 } from "./evidence_pack";
import type { A2Response } from "../../shared/loa_types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateOutput(response: A2Response): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!response.process_id_uuid) {
    errors.push("process_id_uuid ausente");
  }

  if (!response.schema_version) {
    errors.push("schema_version ausente");
  }

  if (!response.sources || response.sources.length === 0) {
    errors.push("sources ausente ou vazio");
  }

  if (!response.data) {
    errors.push("data ausente");
  }

  if (response.data?.execucao) {
    for (const item of response.data.execucao) {
      if (
        item.status === "OK" &&
        (item.empenhado !== null || item.liquidado !== null || item.pago !== null)
      ) {
        if (!item.evidencias || item.evidencias.length === 0) {
          errors.push(
            `Execucao acao ${item.codigo_acao}: valor numerico presente sem evidencias`
          );
        }
      }
    }
  }

  if (response.data?.dotacao) {
    for (const item of response.data.dotacao) {
      if (
        item.status === "OK" &&
        (item.dotacao_inicial !== null || item.dotacao_atual !== null)
      ) {
        if (!item.evidencias || item.evidencias.length === 0) {
          errors.push(
            `Dotacao acao ${item.codigo_acao}: valor numerico presente sem evidencias`
          );
        }
      }
    }
  }

  if (!response.hashes?.output_sha256) {
    errors.push("hashes.output_sha256 ausente");
  }

  if (!response.evidence_pack_path) {
    errors.push("evidence_pack_path ausente");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateEvidenceFiles(response: A2Response): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const packPath = response.evidence_pack_path;
  if (!packPath || !fs.existsSync(packPath)) {
    errors.push(`Evidence pack directory not found: ${packPath}`);
    return { valid: false, errors, warnings };
  }

  const responsePath = path.join(packPath, "response.json");
  if (!fs.existsSync(responsePath)) {
    errors.push("response.json not found in evidence pack");
  }

  const requestPath = path.join(packPath, "request.json");
  if (!fs.existsSync(requestPath)) {
    warnings.push("request.json not found in evidence pack");
  }

  const allEvidencias = [
    ...(response.data?.execucao?.flatMap((e) => e.evidencias) || []),
    ...(response.data?.dotacao?.flatMap((d) => d.evidencias) || []),
  ];

  for (const ev of allEvidencias) {
    if (ev.raw_payload_path && ev.raw_payload_sha256) {
      const fullPath = path.join(packPath, ev.raw_payload_path);
      if (!fs.existsSync(fullPath)) {
        errors.push(`Raw payload file not found: ${ev.raw_payload_path}`);
      } else {
        const content = fs.readFileSync(fullPath);
        const actualHash = computeSHA256(content);
        if (actualHash !== ev.raw_payload_sha256) {
          errors.push(
            `SHA256 mismatch for ${ev.raw_payload_path}: expected=${ev.raw_payload_sha256} actual=${actualHash}`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
