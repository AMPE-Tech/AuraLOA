import type { Express } from "express";
import multer from "multer";
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";
const _currentFile = import.meta.url || pathToFileURL(__filename).href;
const require = createRequire(_currentFile);
const _pdfParseModule = require("pdf-parse");
const pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }> =
  typeof _pdfParseModule === "function" ? _pdfParseModule : _pdfParseModule.default ?? _pdfParseModule;
import { runBRAnalysis } from "../services/analysis-engine-br";
import { query } from "../db";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são aceitos"));
    }
  },
});

export function registerAnaliseDocumentoRoutes(app: Express) {
  // Rota nova: recebe PDF binário
  app.post("/api/analise/documento-pdf", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      // Extrai texto com pdf-parse (robusto, todas as páginas)
      const data = await pdfParse(req.file.buffer);
      const fullText = data.text;

      // Roda análise heurística BR
      const result = runBRAnalysis(fullText);

      // Persiste no banco
      const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || null;
      const ua = req.headers["user-agent"] || null;

      const inserted = await query(`
        INSERT INTO document_validations (
          file_hash_sha256, score, status,
          numero_cnj, numero_oficio, tribunal,
          juiz_assinante, credor_nome, credor_cpf_cnpj,
          devedor, valor_rs, data_transito,
          url_verificacao, codigo_verificador,
          tem_qrcode, tem_assinatura_digital,
          findings_json, ip_origem, user_agent
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
        ) RETURNING id
      `, [
        result.sha256, result.score, result.status,
        result.extracted.numero_cnj, result.extracted.numero_oficio, result.extracted.tribunal,
        result.extracted.juiz_assinante, result.extracted.credor_nome, result.extracted.credor_cpf_cnpj,
        result.extracted.devedor, result.extracted.valor_rs, result.extracted.data_transito,
        result.extracted.url_verificacao, result.extracted.codigo_verificador,
        result.extracted.tem_qrcode, result.extracted.tem_assinatura_digital,
        JSON.stringify(result.findings), ip, ua
      ]);

      // Se suspeito, grava também na tabela de suspeitos
      if (result.status === "SUSPEITO" && inserted[0]?.id) {
        const motivos = result.findings
          .filter(f => !f.found && (f.severity === "high" || f.severity === "critical"))
          .map(f => `${f.ruleId}: ${f.detail}`)
          .join(" | ");

        await query(`
          INSERT INTO document_suspects (
            validation_id, motivo_reprovacao, alertas_json,
            ip_origem, file_hash_sha256
          ) VALUES ($1,$2,$3,$4,$5)
        `, [
          inserted[0].id,
          motivos || "Score abaixo de 50",
          JSON.stringify(result.findings.filter(f => !f.found)),
          ip,
          result.sha256
        ]);
      }

      return res.json({
        ...result,
        paginas: data.numpages,
        chars_extraidos: fullText.length,
      });

    } catch (err: any) {
      console.error("[analise-documento-pdf] erro:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Mantém rota antiga por compatibilidade
  app.post("/api/analise/documento", async (req, res) => {
    try {
      const { texto } = req.body;
      if (!texto || typeof texto !== "string") {
        return res.status(400).json({ error: "Campo 'texto' obrigatório" });
      }
      const result = runBRAnalysis(texto);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
}
