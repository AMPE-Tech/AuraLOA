import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export function computeSHA256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export class EvidencePack {
  private basePath: string;
  private processId: string;
  private logs: string[] = [];

  constructor(processId: string) {
    this.processId = processId;
    this.basePath = path.resolve("./Saida/evidence", processId);
    this.ensureDir(this.basePath);
    this.ensureDir(path.join(this.basePath, "raw"));
  }

  private ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  log(message: string) {
    const ts = new Date().toISOString();
    const line = `${ts} ${message}`;
    this.logs.push(line);
    console.log(`[A2] ${message}`);
  }

  saveRequest(data: any) {
    const filePath = path.join(this.basePath, "request.json");
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    this.log(`saved request.json`);
  }

  saveResponse(data: any): string {
    const filePath = path.join(this.basePath, "response.json");
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, "utf-8");
    const hash = computeSHA256(content);
    this.log(`saved response.json sha256=${hash}`);
    return hash;
  }

  saveRawPayload(filename: string, data: string | Buffer): {
    path: string;
    sha256: string;
  } {
    const filePath = path.join(this.basePath, "raw", filename);
    fs.writeFileSync(filePath, data);
    const sha256 = computeSHA256(data);
    this.log(`saved raw/${filename} bytes=${typeof data === 'string' ? data.length : data.length} sha256=${sha256}`);
    return { path: `raw/${filename}`, sha256 };
  }

  saveHashes(hashes: Record<string, string>) {
    const filePath = path.join(this.basePath, "hashes.json");
    fs.writeFileSync(filePath, JSON.stringify(hashes, null, 2), "utf-8");
    this.log(`saved hashes.json`);
  }

  saveLog() {
    const filePath = path.join(this.basePath, "run.log");
    fs.writeFileSync(filePath, this.logs.join("\n") + "\n", "utf-8");
  }

  getBasePath(): string {
    return this.basePath;
  }

  verifyFile(relativePath: string, expectedHash: string): boolean {
    const fullPath = path.join(this.basePath, relativePath);
    if (!fs.existsSync(fullPath)) return false;
    const content = fs.readFileSync(fullPath);
    const actualHash = computeSHA256(content);
    return actualHash === expectedHash;
  }
}
