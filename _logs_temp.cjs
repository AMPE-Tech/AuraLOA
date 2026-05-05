const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 logs auraloa --lines 30 --nostream 2>&1 | grep -E "\\[Credor\\]|\\[DD Pipeline\\]"', (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '178.104.66.47', port: 22, username: 'root', password: 'taNnqRbfMmP7', readyTimeout: 20000 });
