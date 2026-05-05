// READ-ONLY DOWNLOAD: baixa dd-reports do servidor de produção pra pasta local.
require('dotenv').config();
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HETZNER_HOST;
const USER = process.env.HETZNER_USER;
const PASS = process.env.HETZNER_PASS;

const REMOTE_DIR = '/var/www/auraloa/dist/public/dd-reports';
const LOCAL_DIR = path.join(__dirname, 'client', 'public', 'dd-reports');

if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

const conn = new Client();
conn.on('ready', () => {
  console.log(`✓ Conectado em ${HOST}`);
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); process.exit(1); }
    sftp.readdir(REMOTE_DIR, (err, list) => {
      if (err) {
        console.error(`Pasta remota não encontrada: ${REMOTE_DIR}`);
        console.error(err.message);
        conn.end();
        process.exit(1);
      }
      const htmls = list.filter(f => f.filename.endsWith('.html'));
      console.log(`📁 Remoto: ${htmls.length} arquivos HTML em ${REMOTE_DIR}`);

      const existsLocal = new Set(fs.readdirSync(LOCAL_DIR));
      const toDownload = htmls.filter(f => !existsLocal.has(f.filename));
      console.log(`📥 Baixando: ${toDownload.length} novos · ${htmls.length - toDownload.length} já existem localmente\n`);

      if (!toDownload.length) {
        console.log('Nada novo pra baixar.');
        conn.end();
        return;
      }

      let done = 0, failed = 0;
      const total = toDownload.length;
      const next = (i) => {
        if (i >= total) {
          console.log(`\n✅ Download concluído · ${done} sucesso · ${failed} falhas`);
          conn.end();
          return;
        }
        const f = toDownload[i];
        const remotePath = `${REMOTE_DIR}/${f.filename}`;
        const localPath = path.join(LOCAL_DIR, f.filename);
        sftp.fastGet(remotePath, localPath, (err) => {
          if (err) {
            failed++;
            console.log(`  ✗ ${f.filename} (${err.message})`);
          } else {
            done++;
            const kb = (f.attrs.size / 1024).toFixed(0);
            console.log(`  ✓ [${done}/${total}] ${f.filename} (${kb}KB)`);
          }
          next(i + 1);
        });
      };
      next(0);
    });
  });
}).on('error', e => {
  console.error('SSH erro:', e.message);
  process.exit(1);
}).connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 20000 });
