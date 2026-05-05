const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected');
  const cmds = [
    'cd /var/www/auraloa',
    'node -e "console.log(require(\'playwright/package.json\').version)" 2>&1',
    'ls /root/.cache/ms-playwright/ 2>&1',
    'PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright npx playwright install chromium 2>&1',
    'ls /root/.cache/ms-playwright/ 2>&1',
  ];
  conn.exec(cmds.join(' && '), { timeout: 180000 }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log(out);

      // Test again
      conn.exec('cd /var/www/auraloa && node -e "const pw=require(\'playwright\');console.log(\'PW version:\',pw.chromium.name());(async()=>{const b=await pw.chromium.launch({headless:true});console.log(\'LAUNCHED\');const p=await b.newPage();await p.goto(\'https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1\',{timeout:30000});console.log(\'PAGE:\',await p.title());await b.close();console.log(\'OK\')})().catch(e=>console.log(\'ERR:\',e.message.substring(0,500)))" 2>&1', { timeout: 60000 }, (err2, stream2) => {
        let out2 = '';
        stream2.on('data', d => out2 += d.toString());
        stream2.stderr.on('data', d => out2 += d.toString());
        stream2.on('close', () => {
          console.log('\nTEST RESULT:');
          console.log(out2);
          conn.end();
        });
      });
    });
  });
}).connect({ host: '178.104.66.47', port: 22, username: 'root', password: 'taNnqRbfMmP7', readyTimeout: 20000 });
