const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); process.exit(1); }
    sftp.fastPut(path.join(__dirname, 'dist', 'index.cjs'), '/var/www/auraloa/dist/index.cjs', (err) => {
      if (err) { console.error(err); conn.end(); process.exit(1); }
      console.log('Upload OK:', (fs.statSync(path.join(__dirname, 'dist', 'index.cjs')).size/1024).toFixed(0) + 'KB');
      conn.exec('cd /var/www/auraloa && pm2 restart auraloa --update-env 2>&1 && sleep 2 && pm2 status auraloa', (err, stream) => {
        if (err) { console.error(err); conn.end(); return; }
        stream.on('data', (d) => process.stdout.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '178.104.66.47', port: 22, username: 'root', password: 'taNnqRbfMmP7', readyTimeout: 20000 });
