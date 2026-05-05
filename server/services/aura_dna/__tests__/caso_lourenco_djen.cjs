/**
 * Teste manual da Camada 5 (DJEN) com CNJ 0110039-73.1992.4.02.5102.
 * Roda direto via tsx ou compila TS antes - usar versao .cjs adapter.
 */
async function main() {
  // Inline da camada (evita configurar tsc):
  const BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
  const CNJ = '0110039-73.1992.4.02.5102';
  const url = `${BASE}?numeroProcesso=${encodeURIComponent(CNJ)}`;
  console.log(`[DJEN] GET ${url}`);
  const t0 = Date.now();
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await resp.json();
  console.log(`[DJEN] HTTP ${resp.status} em ${Date.now()-t0}ms`);
  console.log(`[DJEN] count=${body.count}`);
  if (body.items && body.items.length) {
    const it = body.items[0];
    console.log(`\n--- Item 1 ---`);
    console.log(`data_disponibilizacao: ${it.data_disponibilizacao}`);
    console.log(`tipoComunicacao      : ${it.tipoComunicacao}`);
    console.log(`tipoDocumento        : ${it.tipoDocumento}`);
    console.log(`siglaTribunal/orgao  : ${it.siglaTribunal} / ${it.nomeOrgao}`);
    console.log(`destinatarios (${it.destinatarios?.length||0}):`);
    for (const d of it.destinatarios||[]) console.log(`  - ${d.polo} ${d.nome}`);
    console.log(`link: ${it.link?.slice(0,80)}...`);
    console.log(`teor (primeiros 400 chars de HTML):`);
    console.log(it.texto?.slice(0,400));
  }
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });
