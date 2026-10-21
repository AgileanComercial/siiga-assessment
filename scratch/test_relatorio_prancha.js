// Real E2E (clicks through the questionnaire) for the Direction A report PDF
// ("Prancha técnica", relatorio-prancha.js). Supabase writes and AI calls are blocked.
// Usage:
//   CASE=pcl  MODE=detalhado OUT="Piloto Relatorio v2/SIIGA_APP_v3_DETALHADO_PCL.pdf" node scratch/test_relatorio_prancha.js
//   CASE=terc MODE=resumido  OUT="Piloto Relatorio v2/SIIGA_APP_v3_RESUMIDO_TERC.pdf"  node scratch/test_relatorio_prancha.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');
const MODE = process.env.MODE === 'resumido' ? 'resumido' : 'detalhado';
const CASE = process.env.CASE || 'pcl';
const OUT = process.env.OUT || ('SIIGA_APP_v3_' + MODE.toUpperCase() + '_' + CASE.toUpperCase() + '.pdf');
const PORT = 8243;

const CASES = {
  // Construtora PCL (call answers; same as test_gaps_ancora.js)
  pcl: {
    empresa: 'Construtora PCL', contato: 'Thiago Toscano', cargo: 'Sócio', consultor: 'Adailton',
    obras: '1', prazo: '15', orcamento: '3.500.000', b0: { tipologia: 'vert', b03: '0', modeloMO: 'mista', momento: 'crescimento' },
    ferr: { planejamento: 'Excel', medicao: 'Excel', qualidade: 'Excel' }, erp: '',
    resp: { 'F1.1':1.5,'F1.2':0,'F1.3':0,'F1.4':1.5,'F1.6':3,'F1.7':0,'F1.5':1.5,'F2.1':3,'F2.2':1.5,'F2.3':1.5,
      'F3.1':1,'F3.2':0,'F3.3':1.5,'F3.4':1.5,'F3.5':0,'F4.1':1,'F4.2':1,'F4.3':1,'F4.4':1,
      'MO.1':1.5,'MO.2':1,'MO.3':0,'MO.4':1.5,'MO.5':1.5,'MO.6':1,'MO.7':1.5 },
    dores: { 'F4.3':'o custo sou eu que compilo', 'MO.6':'a gente avisa o empreiteiro pelo WhatsApp' },
    folha: '100.000', horas: [16, 24, 32, 16, 32]
  },
  // Second case: outsourced labor, no ERP, other company name (no article), other term
  terc: {
    empresa: 'Horizonte Engenharia', contato: 'Marina Lopes', cargo: 'Diretor', consultor: 'Israel Chacon',
    obras: '3', prazo: '24', orcamento: '12.000.000', b0: { tipologia: 'com', b03: '1', modeloMO: 'terceirizada', momento: 'consolidacao' },
    ferr: { planejamento: 'MS Project', medicao: 'Planilha própria', qualidade: 'Papel', contratos: 'Excel' }, erp: 'nenhum',
    resp: { 'F1.1':3,'F1.2':1,'F1.3':1.5,'F1.4':0,'F1.6':1,'F1.7':1.5,'F1.5':0,'F2.1':1,'F2.2':0,'F2.3':1.5,
      'F3.1':1.5,'F3.2':1,'F3.3':0,'F3.4':0,'F3.5':1.5,'F4.1':1.5,'F4.2':3,'F4.3':0,'F4.4':1,
      'MO.5':0,'MO.6':1.5,'MO.7':1 },
    dores: { 'F3.4':'a gente paga o empreiteiro e depois descobre o retrabalho' },
    folha: null, horas: [24, 30, 50, 20, 26]
  }
};
const C = CASES[CASE];

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  let filePath = path.join(BASE_DIR, reqPath);
  if (!fs.existsSync(filePath)) filePath = path.join(ROOT_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else { res.writeHead(404); res.end('Not found'); }
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const active = page => page.evaluate(() => { var el = document.querySelector('.screen.active'); return el ? el.id : null; });

server.listen(PORT, async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const fails = [];
  const check = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  -> ' + detail : '')); if (!ok) fails.push(name); };
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', r => ((r.url().includes('supabase.co') && r.method() !== 'GET' && r.method() !== 'OPTIONS') || r.url().includes('anthropic')) ? r.abort() : r.continue());
    page.on('pageerror', err => { console.log('PAGE ERROR:', err.message); fails.push('pageerror: ' + err.message); });
    page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
    page.on('dialog', d => { console.log('DIALOG:', d.message()); d.dismiss(); });
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
    await page.goto('http://localhost:' + PORT + '/index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    await page.type('#c-empresa', C.empresa);
    await page.type('#c-contato', C.contato);
    await page.evaluate(v => { document.getElementById('c-cargo').value = v; }, C.cargo);
    await page.type('#c-consultor', C.consultor);
    await page.type('#c-email', 'contato@empresa-exemplo.com.br');
    await page.type('#c-telefone', '(11) 90000-0000');
    await page.click('button[onclick="startAssessment()"]');
    await sleep(300);

    for (let i = 0; i < 30; i++) {
      if (await active(page) !== 'screen-b0') break;
      const q = await page.evaluate(() => { var q = B0Q[currentQIdx]; return { type: q.type, key: q.key, opts: (q.opts || []).map(o => o.v) }; });
      if (q.type === 'roi') {
        await page.evaluate(c => {
          document.getElementById('roi-obras').value = c.obras;
          document.getElementById('roi-prazo').value = c.prazo;
          var o = document.getElementById('roi-orcamento'); o.value = c.orcamento; o.dispatchEvent(new Event('input', { bubbles: true }));
        }, C);
      } else if (q.type === 'ferramentas') {
        await page.evaluate(c => {
          Object.keys(c.ferr).forEach(k => { var el = document.getElementById('ferr-' + k); if (el) el.value = c.ferr[k]; });
          var e = document.getElementById('ferr-erp'); if (e && c.erp) { e.value = c.erp; e.dispatchEvent(new Event('change', { bubbles: true })); }
        }, C);
      } else {
        const idx = Math.max(0, q.opts.indexOf(C.b0[q.key]));
        const opts = await page.$$('#b0-card .opt');
        if (opts.length) await opts[idx].click();
      }
      await page.click('.screen.active .btn-p[onclick="nextQ()"]');
      await sleep(120);
    }
    await sleep(300);
    await page.evaluate(() => document.querySelector('#focus-all .focus-card-header').click()); await sleep(200);
    await page.evaluate(() => document.getElementById('btn-start-diagnosis').click()); await sleep(300);

    let horasOk = false;
    for (let i = 0; i < 90; i++) {
      const scr = await active(page);
      if (scr === 'screen-radar') break;
      if (scr === 'screen-phase-result') { await page.click('#result-next-btn'); await sleep(200); continue; }
      if (scr === 'screen-horas') {
        await page.evaluate(v => document.querySelectorAll('#horas-card input').forEach((el, i) => el.value = String(v[i])), C.horas);
        horasOk = true;
        await page.click('#horas-next-btn'); await sleep(600);
        continue;
      }
      if (scr === 'screen-phase') {
        const info = await page.evaluate(() => {
          var bk = phaseOrder[currentPhaseIdx]; var q = getNavQs(PQ[bk], bk)[currentQIdx];
          var subs = Array.prototype.map.call(document.querySelectorAll('#phase-card .combo-sub-code'), function(e){ return e.textContent.trim(); });
          return { bk: bk, type: q.type, code: q.code, subs: subs };
        });
        if (info.type === 'numgrid') {
          await page.evaluate(v => document.querySelectorAll('#phase-card input[id^="rg-"]').forEach(el => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }), C.folha || '0');
        } else {
          const codes = info.subs.length ? info.subs : [info.code];
          for (let gi = 0; gi < codes.length; gi++) {
            const code = codes[gi];
            const sc = C.resp[code] !== undefined ? C.resp[code] : 1;
            await page.evaluate((gi, sc) => {
              var g = document.querySelectorAll('#phase-card .options')[gi];
              var os = g ? g.querySelectorAll('.opt') : [];
              for (var k = 0; k < os.length; k++) { if (parseFloat(os[k].querySelector('.opt-dot').textContent) === sc) { os[k].click(); return; } }
            }, gi, sc);
            await sleep(60);
            if (C.dores[code]) {
              await page.evaluate(c => document.getElementById('dor-' + c).querySelector('.dor-toggle').click(), code);
              await sleep(60);
              await page.type('#dor-' + code.replace('.', '\\.') + ' .dor-frase', C.dores[code]);
            }
          }
        }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(120);
        continue;
      }
      await sleep(200);
    }
    check('tela de horas preenchida', horasOk);
    await sleep(1200);
    await page.evaluate(() => { var m = document.getElementById('save-modal'); if (m) m.style.display = 'none'; });
    await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="revealAha(\'mid\')"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="showReport()"]').click()); await sleep(1200);

    // Uses the on-screen dark toggle first: the PDF must come out in the light Direction A anyway.
    await page.evaluate(() => changeReportTheme('dark'));
    await sleep(500);
    const t0 = Date.now();
    const uri = await page.evaluate(async (m) => new Promise(resolve => {
      window.__PT_KEEP_DOM = true;
      generatePDF(false, 'dark', m);
      const it = setInterval(() => { if (!document.getElementById('pdf-loading') && window.__LAST_PDF_DATA) { clearInterval(it); resolve(window.__LAST_PDF_DATA); } }, 300);
      setTimeout(() => { clearInterval(it); resolve(window.__LAST_PDF_DATA || null); }, 180000);
    }), MODE);
    console.log('PDF em', ((Date.now() - t0) / 1000).toFixed(1), 's');

    const dom = await page.evaluate(() => {
      var root = document.getElementById('ptr-root');
      var pages = root ? Array.prototype.map.call(root.querySelectorAll(':scope > .page'), function(p){ return p.innerText; }) : [];
      var over = root ? Array.prototype.map.call(root.querySelectorAll(':scope > .page:not(.cover)'), function(p, i) {
        var st = p.querySelector('.carimbo').getBoundingClientRect().top; var b = 0;
        p.querySelectorAll('.body > *').forEach(function(e){ b = Math.max(b, e.getBoundingClientRect().bottom); });
        return { folha: i + 2, folga_mm: ((st - b) / (96 / 25.4)).toFixed(1) };
      }) : [];
      var fontsOk = PT_FONT_FACES.map(function(f){ return document.fonts.check(f, 'Ação'); });
      return { pages: pages, over: over, fontsOk: fontsOk };
    });
    const all = dom.pages.join('\n').replace(/\u00a0/g, ' ');
    const allLow = all.toLowerCase();
    const pend = all.match(/.{0,40}\[PENDENTE.{0,40}/i);
    if (process.env.DUMP) dom.pages.forEach((t, i) => console.log('\n===== FOLHA ' + (i + 1) + ' =====\n' + t));
    console.log('\nFolga até o carimbo:', JSON.stringify(dom.over));
    check('fontes Bai Jamjuree e Manrope carregadas', dom.fontsOk.every(Boolean), JSON.stringify(dom.fontsOk));
    check('folga >= 10 mm em todas as folhas', dom.over.every(o => parseFloat(o.folga_mm) >= 9.5), JSON.stringify(dom.over.filter(o => parseFloat(o.folga_mm) < 9.5)));
    check('sem [PENDENTE]', !pend, pend && pend[0]);
    check('sem "(TESTE)", e-mail ou telefone', !/\(teste\)|@|\(\d{2}\)\s?\d/i.test(all));
    check('sem a palavra gap', !/\bgaps?\b/i.test(all));
    check('sem roteiro de venda', !/bate com a realidade|desenharmos o escopo|Próximo passo|não precisam ser comentados/i.test(all));
    check('sem "Fase 4"/Jornada', !/Jornada|Fase 4/i.test(all));
    check('Depoimento de Cliente Agilean', /Depoimento de Cliente Agilean/i.test(all));
    check('prioridades sem dias', !/início em até|Implantar em até/i.test(all) && /IMEDIATA/.test(all));
    if (MODE === 'resumido') {
      check('Resumido sem fórmula (÷, Cálculo:, Como é calculado, Fórmula, Anexo)', !/÷|Cálculo:|Como é calculado|Fórmula|Anexo A/i.test(all));
    } else {
      check('Detalhado com Anexo A e fórmula ÷', /Anexo A/.test(all) && /÷/.test(all));
    }
    if (CASE === 'pcl') {
      ['21,5', 'R$ 526 mil', 'R$ 395 mil', 'R$ 11,5 mil', 'R$ 9,3 mil', 'R$ 5,5 mil', 'R$ 26,3 mil/mês', 'custa R$ 26 mil à obra', 'R$ 20,5 mil/mês', 'R$ 10,25 mil', '5,1×', '3,1×', 'R$ 6,15 mil',
       'R$ 172,5 mil', 'R$ 140,0 mil', 'R$ 52,5 mil', 'R$ 78,8 mil', 'R$ 82,7 mil', 'R$ 526,4 mil', 'R$ 375,3 mil', 'R$ 35,1 mil',
       'Digitalização do painel integrado de indicadores', 'Digitalização da comunicação de bloqueios de pagamento', 'Implantação da gestão de aditivos de verba',
       'Plano de Transformação Operacional para a Construtora PCL', 'Pilar 3, Gestão da produção', 'Resolve: ponto crítico 1; pontos 05, 06, 07, 09, 10, 11 e 12.',
       'Resolve: pontos críticos 2 e 3; ponto 08.'].forEach(s => check('PCL contém "' + s + '"', allLow.indexOf(s.toLowerCase()) >= 0));
      check('PCL folhas = ' + (MODE === 'resumido' ? 8 : 10), dom.pages.length === (MODE === 'resumido' ? 8 : 10), dom.pages.length);
    } else {
      check('título sem artigo: "para Horizonte Engenharia"', allLow.indexOf('plano de transformação operacional para horizonte engenharia') >= 0);
      check('sem linhas de folha própria (terceirizada)', !/Retrabalho pago na folha/.test(all));
      check('ERP "Não utiliza ERP"', /Não utiliza ERP/.test(all));
      check('prazo 24 meses', /24 meses/.test(all));
    }

    if (uri && uri.startsWith('data:application/pdf')) {
      const b64 = uri.replace(/^data:application\/pdf;[^,]*base64,/, '');
      const target = path.isAbsolute(OUT) ? OUT : path.join(ROOT_DIR, OUT);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(b64, 'base64'));
      console.log('PDF salvo:', target);
    } else { check('PDF gerado', false); }
  } catch (e) {
    console.log('ERRO:', e && e.stack || e); fails.push('exception');
  } finally {
    await browser.close(); server.close();
    console.log(fails.length ? ('\nFALHAS: ' + fails.join(' | ')) : '\nTUDO OK');
    process.exit(fails.length ? 1 : 0);
  }
});
