// READ-ONLY: lista dd-reports do servidor de produção. Não baixa, não modifica.
require('dotenv').config();
const { Client } = require('ssh2');

const HOST = process.env.HETZNER_HOST;
const USER = process.env.HETZNER_USER;
const PASS = process.env.HETZNER_PASS;

const CANDIDATE_PATHS = [
  '/var/www/auraloa/dist/public/dd-reports',
  '/var/www/auraloa/client/public/dd-reports',
  '/var/www/auraloa/server/public/dd-reports',
  '/var/www/auraloa/public/dd-reports',
  '/var/www/auraloa/dd-reports',
];

const conn = new Client();
conn.on('ready', () => {
  console.log(`✓ Conectado em ${HOST} como ${USER}\n`);
  const cmd = CANDIDATE_PATHS.map(p =>
    `echo "=== ${p} ===" && ls -la "${p}" 2>/dev/null | head -5 && echo "-- contagem --" && (ls "${p}" 2>/dev/null | wc -l) && echo ""`
  ).join(' ; ');
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); process.exit(1); }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write('[stderr] ' + d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', e => {
  console.error('SSH erro:', e.message);
  process.exit(1);
}).connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 20000 });
