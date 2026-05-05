const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'C:/Users/MarcosCosta/OneDrive - CTS Brasil/Área de Trabalho/ClaudeCode/Grupo Stabia/Auditoria';
const SCREENSHOTS = path.join(BASE, '_agents', 'screenshots_argoit');
const OUTPUT = path.join(BASE, '_agents', 'explorer_argoit_raw.json');

const URL = 'https://www.argoit.com.br/stabia/';
const USER = 'auditoria';
const PASS = '4c2&#BcEQggDcfh';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = {
    url: URL,
    loginOk: false,
    menus: [],
    pages: [],
    helpPages: [],
    errors: []
  };

  try {
    // 1. LOGIN
    console.log('[1/5] Acessando ArgoIT...');
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: path.join(SCREENSHOTS, '01_login_page.png'), fullPage: true });

    // Tentar identificar campos de login
    const loginSelectors = [
      { user: 'input[name*="user" i]', pass: 'input[name*="pass" i]', btn: 'button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Login"), a:has-text("Entrar")' },
      { user: 'input[name*="login" i]', pass: 'input[name*="senha" i]', btn: 'button, input[type="submit"]' },
      { user: 'input[type="text"]', pass: 'input[type="password"]', btn: 'button, input[type="submit"], input[type="button"]' },
    ];

    let loggedIn = false;
    for (const sel of loginSelectors) {
      try {
        const userField = await page.$(sel.user);
        const passField = await page.$(sel.pass);
        if (userField && passField) {
          await userField.fill(USER);
          await passField.fill(PASS);
          await page.screenshot({ path: path.join(SCREENSHOTS, '02_login_filled.png'), fullPage: true });

          const btn = await page.$(sel.btn);
          if (btn) {
            await btn.click();
          } else {
            await passField.press('Enter');
          }
          await sleep(3000);
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await page.screenshot({ path: path.join(SCREENSHOTS, '03_after_login.png'), fullPage: true });
          loggedIn = true;
          results.loginOk = true;
          console.log('   Login realizado!');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!loggedIn) {
      // Capturar HTML da pagina de login para análise manual
      const html = await page.content();
      fs.writeFileSync(path.join(SCREENSHOTS, 'login_page.html'), html);
      results.errors.push('Nao conseguiu identificar campos de login automaticamente');
      console.log('   AVISO: Login nao identificado automaticamente. HTML salvo.');
    }

    // 2. MAPEAR MENUS
    console.log('[2/5] Mapeando menus...');
    await sleep(2000);

    // Capturar todos os links e menus visiveis
    const allLinks = await page.evaluate(() => {
      const links = [];
      // Links normais
      document.querySelectorAll('a[href]').forEach(a => {
        links.push({
          text: (a.textContent || '').trim().substring(0, 100),
          href: a.href,
          classes: a.className,
          parent: a.parentElement ? a.parentElement.tagName + '.' + a.parentElement.className : '',
          visible: a.offsetParent !== null
        });
      });
      // Botoes
      document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(b => {
        links.push({
          text: (b.textContent || b.value || '').trim().substring(0, 100),
          href: '#button',
          classes: b.className,
          parent: b.parentElement ? b.parentElement.tagName + '.' + b.parentElement.className : '',
          visible: b.offsetParent !== null
        });
      });
      return links;
    });

    results.menus = allLinks.filter(l => l.visible && l.text.length > 0);
    console.log(`   ${results.menus.length} links/botoes encontrados`);

    // 3. IDENTIFICAR MENUS DE NAVEGACAO (navbars, sidebars, dropdowns)
    console.log('[3/5] Explorando estrutura de navegacao...');

    const navStructure = await page.evaluate(() => {
      const navs = [];
      // Navbars
      document.querySelectorAll('nav, [role="navigation"], .navbar, .sidebar, .menu, .nav, #menu, #sidebar, #nav, .main-menu, .top-menu').forEach(nav => {
        const items = [];
        nav.querySelectorAll('a, button, li').forEach(item => {
          const text = (item.textContent || '').trim().substring(0, 80);
          if (text.length > 0 && text.length < 60) {
            items.push({
              tag: item.tagName,
              text: text,
              href: item.href || '',
              hasSubmenu: item.querySelector('ul, .dropdown, .submenu') !== null
            });
          }
        });
        if (items.length > 0) {
          navs.push({
            tag: nav.tagName,
            id: nav.id,
            class: nav.className,
            items: items.slice(0, 50)
          });
        }
      });
      return navs;
    });

    results.navigation = navStructure;

    // 4. TENTAR EXPANDIR DROPDOWNS/SUBMENUS
    console.log('[4/5] Expandindo submenus...');

    // Hover sobre items de menu para revelar submenus
    const menuItems = await page.$$('nav a, .navbar a, .menu a, .nav a, .sidebar a, li > a');
    let menuCount = 0;
    for (const item of menuItems.slice(0, 30)) {
      try {
        const text = await item.textContent();
        if (text && text.trim().length > 0 && text.trim().length < 50) {
          await item.hover();
          await sleep(500);
          menuCount++;
        }
      } catch (e) { continue; }
    }

    await page.screenshot({ path: path.join(SCREENSHOTS, '04_menus_expanded.png'), fullPage: true });
    console.log(`   ${menuCount} items de menu explorados`);

    // 5. BUSCAR PAGINAS DE AJUDA/DOCUMENTACAO
    console.log('[5/5] Buscando documentacao/ajuda...');

    const helpLinks = allLinks.filter(l =>
      /ajuda|help|manual|documentac|tutorial|faq|suporte|guia/i.test(l.text) ||
      /ajuda|help|manual|documentac|tutorial|faq|suporte|guia/i.test(l.href)
    );
    results.helpPages = helpLinks;

    // Navegar por paginas principais e capturar screenshots
    const mainPages = results.menus
      .filter(l => l.href && l.href.startsWith('http') && !l.href.includes('javascript:') && !l.href.includes('logout') && !l.href.includes('sair'))
      .reduce((acc, l) => {
        if (!acc.find(x => x.href === l.href)) acc.push(l);
        return acc;
      }, [])
      .slice(0, 20);

    console.log(`   Navegando por ${mainPages.length} paginas...`);

    for (let i = 0; i < mainPages.length; i++) {
      const pg = mainPages[i];
      try {
        await page.goto(pg.href, { waitUntil: 'networkidle', timeout: 15000 });
        await sleep(1000);

        const title = await page.title();
        const url = page.url();

        // Capturar info da pagina
        const pageInfo = await page.evaluate(() => {
          const forms = [];
          document.querySelectorAll('form').forEach(f => {
            const fields = [];
            f.querySelectorAll('input, select, textarea').forEach(el => {
              fields.push({
                tag: el.tagName,
                type: el.type || '',
                name: el.name || '',
                id: el.id || '',
                placeholder: el.placeholder || '',
                label: el.labels && el.labels[0] ? el.labels[0].textContent.trim() : ''
              });
            });
            forms.push({
              action: f.action || '',
              method: f.method || '',
              fields: fields
            });
          });

          const tables = [];
          document.querySelectorAll('table').forEach(t => {
            const headers = [];
            t.querySelectorAll('th').forEach(th => headers.push(th.textContent.trim()));
            tables.push({ headers, rowCount: t.querySelectorAll('tr').length });
          });

          const buttons = [];
          document.querySelectorAll('button, input[type="button"], input[type="submit"], a.btn, .button').forEach(b => {
            const txt = (b.textContent || b.value || '').trim();
            if (txt.length > 0) buttons.push(txt.substring(0, 60));
          });

          return { forms, tables, buttons };
        });

        const screenshotName = `page_${String(i+1).padStart(2,'0')}_${pg.text.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.png`;
        await page.screenshot({ path: path.join(SCREENSHOTS, screenshotName), fullPage: true });

        results.pages.push({
          index: i + 1,
          text: pg.text,
          url: url,
          title: title,
          screenshot: screenshotName,
          forms: pageInfo.forms,
          tables: pageInfo.tables,
          buttons: pageInfo.buttons
        });

        console.log(`   [${i+1}/${mainPages.length}] ${pg.text} — ${pageInfo.forms.length} forms, ${pageInfo.tables.length} tabelas`);
      } catch (e) {
        results.errors.push(`Pagina ${pg.text}: ${e.message}`);
      }
    }

    // Screenshot final do dashboard/home
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS, '99_final_dashboard.png'), fullPage: true });

  } catch (err) {
    results.errors.push(`Erro geral: ${err.message}`);
    console.error('ERRO:', err.message);
  }

  // Salvar resultado
  fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nResultado salvo em ${OUTPUT}`);
  console.log(`Screenshots em ${SCREENSHOTS}`);
  console.log(`Menus: ${results.menus.length} | Paginas: ${results.pages.length} | Erros: ${results.errors.length}`);

  await browser.close();
}

main().catch(console.error);
