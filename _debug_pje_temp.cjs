const { Client } = require('ssh2');

function run() {
  const conn = new Client();
  conn.on('error', (err) => { console.error('SSH err:', err.message); setTimeout(run, 5000); });
  conn.on('ready', () => {
    console.log('SSH OK');

    // Test 1: PJe with full razão social + check what actually happened
    // Test 2: processual antigo with stealth user-agent
    const testCode = `cd /var/www/auraloa && node -e "
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({headless:true});

  // === TEST 1: PJe Nome da Parte with FULL razao social ===
  console.log('=== TEST 1: PJe - Nome da Parte ===');
  const p1=await b.newPage();
  await p1.goto('https://pje1g-consultapublica.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam',{waitUntil:'domcontentloaded',timeout:30000});
  await p1.waitForTimeout(3000);

  // Fill nome da parte with full razao social
  const nomeParte=p1.locator('#fPP\\\\:dnp\\\\:nomeParte');
  await nomeParte.fill('INSTITUTO NACIONAL DE COLONIZACAO E REFORMA AGRARIA');
  await p1.waitForTimeout(500);

  // Find and click Pesquisar button
  const btns=await p1.locator('input[type=submit], button').all();
  console.log('Buttons found:',btns.length);
  for(let i=0;i<btns.length;i++){
    const val=await btns[i].getAttribute('value').catch(()=>'');
    const txt=await btns[i].innerText().catch(()=>'');
    const id=await btns[i].getAttribute('id').catch(()=>'');
    console.log('  btn['+i+']  val='+val+' txt='+txt+' id='+id);
  }

  // Click the search button (typically id contains 'searchProcessos' or 'pesquisar')
  const searchBtn=p1.locator('#fPP\\\\:searchProcessos, input[value*=Pesquisar], button:has-text(\"Pesquisar\")').first();
  if(await searchBtn.count()>0){
    console.log('Clicking search button...');
    await searchBtn.click();
    await p1.waitForTimeout(10000);
  } else {
    console.log('No search button found, pressing Enter...');
    await nomeParte.press('Enter');
    await p1.waitForTimeout(10000);
  }

  const body1=await p1.locator('body').innerText();
  // Look for CNJs
  const cnjs1=[...new Set((body1.match(/(\\\\d{7}-\\\\d{2}\\\\.\\\\d{4}\\\\.\\\\d\\\\.\\\\d{2}\\\\.\\\\d{4})/g)||[]))];
  console.log('PJe CNJs found:',cnjs1.length);
  cnjs1.slice(0,10).forEach((c,i)=>console.log('  '+i+'. '+c));
  if(cnjs1.length===0){
    console.log('Body excerpt (500):',body1.substring(0,500));
  }
  await p1.screenshot({path:'/tmp/pje_incra_result.png',fullPage:true});
  await p1.close();

  // === TEST 2: processual antigo com user-agent real ===
  console.log('\\n=== TEST 2: processual antigo (com user-agent) ===');
  const ctx=await b.newContext({
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const p2=await ctx.newPage();
  try{
    await p2.goto('https://processual.trf1.jus.br/consultaProcessual/cpfCnpjParte.php?secao=TRF1',{waitUntil:'domcontentloaded',timeout:30000});
    await p2.waitForTimeout(3000);
    const title2=await p2.title();
    console.log('Title:',title2);
    if(title2.includes('Just a moment')||title2.includes('Cloudflare')){
      console.log('CLOUDFLARE BLOCKED - processual antigo');
    } else {
      console.log('processual antigo ACCESSIBLE');
      const inputs2=await p2.locator('input').all();
      console.log('Inputs:',inputs2.length);
      // Try fill CNPJ
      const cnpjInput=p2.locator('input[name=cpf_cnpj], input[id=cpf_cnpj]').first();
      if(await cnpjInput.count()>0){
        await cnpjInput.fill('00375972000160');
        await p2.locator('input[type=submit]').first().click();
        await p2.waitForTimeout(8000);
        const body2=await p2.locator('body').innerText();
        const cnjs2=[...new Set((body2.match(/(\\\\d{7}-\\\\d{2}\\\\.\\\\d{4}\\\\.\\\\d\\\\.\\\\d{2}\\\\.\\\\d{4})/g)||[]))];
        console.log('processual CNJs:',cnjs2.length);
        cnjs2.slice(0,10).forEach((c,i)=>console.log('  '+i+'. '+c));
      }
    }
  }catch(e2){console.log('processual ERR:',e2.message.substring(0,200))}
  await p2.close();

  await b.close();
  console.log('\\nDone');
})().catch(e=>console.log('FATAL:',e.message.substring(0,400)));
" 2>&1`;

    conn.exec(testCode, { timeout: 120000 }, (err, stream) => {
      let out = '';
      stream.on('data', d => out += d.toString());
      stream.stderr.on('data', d => out += d.toString());
      stream.on('close', () => {
        console.log(out);
        conn.end();
      });
    });
  });
  conn.connect({ host: '178.104.66.47', port: 22, username: 'root', password: 'taNnqRbfMmP7', readyTimeout: 30000, keepaliveInterval: 10000 });
}
run();
