import { randomUUID } from "crypto";
import { buildDespesasZipUrl, downloadZipToEvidencePack } from "./transparencia_download";
import { EvidencePack } from "./evidence_pack";

export interface BatchDownloadResult {
  mes: number;
  url: string;
  ok: boolean;
  status: number;
  sha256: string;
  bytes: number;
  filePath: string;
  captured_at_iso: string;
}

export async function downloadAllMonths(ano: number): Promise<{
  processId: string;
  results: BatchDownloadResult[];
}> {
  const processId = randomUUID();
  const evidencePack = new EvidencePack(processId);
  evidencePack.log(`batch download start year=${ano}`);

  const results: BatchDownloadResult[] = [];

  for (let mes = 1; mes <= 12; mes++) {
    const url = buildDespesasZipUrl(ano, mes);
    evidencePack.log(`downloading mes=${mes} url=${url}`);
    try {
      const dl = await downloadZipToEvidencePack({ processId, url });
      evidencePack.log(`mes=${mes} status=${dl.status} bytes=${dl.bytes} sha256=${dl.sha256}`);
      results.push({
        mes,
        url: dl.url,
        ok: dl.ok,
        status: dl.status,
        sha256: dl.sha256,
        bytes: dl.bytes,
        filePath: dl.filePath,
        captured_at_iso: dl.captured_at_iso,
      });
    } catch (err: any) {
      evidencePack.log(`mes=${mes} error: ${err.message}`);
      results.push({
        mes,
        url,
        ok: false,
        status: 0,
        sha256: "",
        bytes: 0,
        filePath: "",
        captured_at_iso: new Date().toISOString(),
      });
    }
  }

  const summary = results.filter(r => r.ok).length;
  evidencePack.log(`batch download end: ${summary}/12 successful`);
  evidencePack.saveLog();

  return { processId, results };
}

let cronInterval: ReturnType<typeof setInterval> | null = null;
let lastCronRun: string | null = null;
let cronEnabled = false;

export function startMonthlyCron(ano?: number) {
  if (cronInterval) {
    clearInterval(cronInterval);
  }

  cronEnabled = true;
  console.log("[CRON] Monthly ZIP download scheduler started");

  cronInterval = setInterval(() => {
    const now = new Date();
    const day = now.getDate();
    const hour = now.getHours();

    if (day === 1 && hour === 3) {
      const targetYear = ano ?? now.getFullYear();
      const currentRunKey = `${targetYear}-${now.getMonth() + 1}`;

      if (lastCronRun === currentRunKey) return;
      lastCronRun = currentRunKey;

      console.log(`[CRON] Triggering batch download for year=${targetYear}`);
      downloadAllMonths(targetYear)
        .then(result => {
          const ok = result.results.filter(r => r.ok).length;
          console.log(`[CRON] Batch download complete: ${ok}/12 ZIPs downloaded, processId=${result.processId}`);
        })
        .catch(err => {
          console.error(`[CRON] Batch download error: ${err.message}`);
        });
    }
  }, 60 * 60 * 1000);
}

export function stopMonthlyCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
  }
  cronEnabled = false;
  console.log("[CRON] Monthly ZIP download scheduler stopped");
}

export function getCronStatus() {
  return {
    enabled: cronEnabled,
    lastRun: lastCronRun,
  };
}
