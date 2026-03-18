import { EvidencePack } from "../../server/services/evidence_pack";

export function createEvidencePack(processId: string): EvidencePack {
  return new EvidencePack(processId);
}

export { EvidencePack };
