const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

function run() {
  const conn = new Client();
  conn.on('error', (err) => { console.error('SSH err:', err.message); setTimeout(run, 8000); });
  conn.on('ready', () => {
    console.log('SSH OK');
    conn.exec('mkdir -p /var/www/auraloa/dist/public/due-diligence/suframa', (e, s) => {
      s.on('close', () => {
        conn.sftp((err, sftp) => {
          if (err) { console.error(err); conn.end(); return; }
          const local = path.resolve('Saida/due_diligence/suframa/due_diligence_suframa_1471249620254010000_CORRIGIDO.html');
          const remote = '/var/www/auraloa/dist/public/due-diligence/suframa/index.html';
          sftp.fastPut(local, remote, (e1) => {
            if (e1) console.error('ERR:', e1.message);
            else console.log('OK:', local.split('/').pop(), '->', remote, `(${(fs.statSync(local).size/1024).toFixed(0)}KB)`);
            conn.exec('ls -lh ' + remote + ' 2>&1', (e2, s2) => {
              let o = '';
              s2.on('data', d => o += d.toString());
              s2.on('close', () => {
                console.log(o.trim());
                console.log('\nPublicado em: https://loa.auradue.com/due-diligence/suframa/');
                try { fs.unlinkSync(path.resolve('_deploy_dd_temp.cjs')); } catch(x){}
                conn.end();
              });
            });
          });
        });
      });
    });
  });
  conn.connect({ host: '178.104.66.47', port: 22, username: 'root', password: 'taNnqRbfMmP7', readyTimeout: 30000, keepaliveInterval: 10000 });
}
run();
