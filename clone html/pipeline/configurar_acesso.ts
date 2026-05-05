/**
 * configurar_acesso.ts
 * Configura a senha de acesso para um relatório de due diligence.
 * Cria o arquivo acesso.json com o hash bcrypt da senha.
 *
 * USO:
 *   npx tsx server/scripts/due_diligence/configurar_acesso.ts \
 *     --pasta=./Saida/due_diligence/1503896 \
 *     --processo="1503896-55.2022.8.26.0050" \
 *     --senha="DraMarcia2026!"
 */

import bcrypt from "bcrypt";
import * as fs from "fs";
import * as path from "path";

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)=?(.*)$/.exec(arg);
    if (m) args[m[1]] = m[2] || "true";
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const pasta = args["pasta"];
  const numeroCNJ = args["processo"];
  const senha = args["senha"];

  if (!pasta || !numeroCNJ || !senha) {
    console.error("Uso: npx tsx configurar_acesso.ts --pasta=CAMINHO --processo=CNJ --senha=SENHA");
    process.exit(1);
  }

  const pastaAbs = path.resolve(pasta);
  if (!fs.existsSync(pastaAbs)) {
    console.error(`Pasta não encontrada: ${pastaAbs}`);
    process.exit(1);
  }

  if (senha.length < 8) {
    console.error("A senha deve ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  console.log("Gerando hash bcrypt da senha...");
  const senhaHash = await bcrypt.hash(senha, 12);

  const acesso = {
    processoId: path.basename(pastaAbs),
    numeroCNJ,
    senhaHash,
    criadoEm: new Date().toISOString(),
  };

  const acessoPath = path.join(pastaAbs, "acesso.json");
  fs.writeFileSync(acessoPath, JSON.stringify(acesso, null, 2), "utf-8");

  console.log("\n✓ Acesso configurado com sucesso!");
  console.log(`  Arquivo: ${acessoPath}`);
  console.log(`  Processo: ${numeroCNJ}`);
  console.log(`  Senha: ${"*".repeat(senha.length)} (omitida)`);
  console.log(`\n  URL de acesso (após deploy):`);
  console.log(`  https://app.auraloa.com.br/due-diligence/${path.basename(pastaAbs)}`);
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
