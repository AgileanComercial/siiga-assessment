// Real E2E (clicks through the questionnaire) for the Direction A report PDF
// ("Prancha técnica", relatorio-prancha.js). Supabase writes and AI calls are blocked.
// Usage:
//   CASE=pcl  MODE=detalhado OUT="Piloto Relatorio v2/SIIGA_APP_v3_DETALHADO_PCL.pdf" node scratch/test_relatorio_prancha.js
//   CASE=terc MODE=resumido  OUT="Piloto Relatorio v2/SIIGA_APP_v3_RESUMIDO_TERC.pdf"  node scratch/test_relatorio_prancha.js
//   CASE: pcl (mixed labor), pcl2 (★ on alert point), prop (own labor), terc (outsourced). PROD_URL=https://siiga.vercel.app/ runs it in production.
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
// PCL with a star on an alert point (F3.4 = 1.5, becomes priority 4) and on a structured point (F2.1 = 3, tool warning)
CASES.pcl2 = Object.assign({}, CASES.pcl, { dores: Object.assign({}, CASES.pcl.dores, { 'F3.4':'a gente paga o empreiteiro e depois descobre o retrabalho', 'F2.1':'a gente sempre corre atrás de material' }) });
// PCL with own labor only (Phase III = Folha de Produção, 90 days)
CASES.prop = Object.assign({}, CASES.pcl, { b0: Object.assign({}, CASES.pcl.b0, { modeloMO: 'propria' }) });
// PCL with the vendedor's adjustment from the Conferência screen: priority 3 (Estouro de MO, MO.3) taken out of the priorities
CASES.ajuste = Object.assign({}, CASES.pcl, { ajustes: { travados: [], excluidos: ['MO.3'] }, prioFontes: ['retrabalho', 'time', 'erros'] });
// PCL without hours informed on the horas screen (Israel's pilot case): time source falls back to the market reference
CASES.semhoras = Object.assign({}, CASES.pcl, { consultor: 'Israel Chacon', horas: null });
const C = CASES[CASE];
const MO = C.b0.modeloMO;

// ── Valores esperados calculados da REGRA, a partir das respostas do caso (não do que o app imprime) ──
// ajuste pela maturidade = 0,20 + (1 − maturidade) × 0,50 (20% a 70%); perda estimada da empresa = referência × ajuste;
// ganho = perda estimada × redução com o SIIGA (horas 100%, retrabalho 40%, custo indireto do prazo 100%, erros de medição 70%, estouro de MO 70%).
const nf = (v, d) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fMil = v => 'R$ ' + nf(v / 1000, 1) + ' mil';                       // ptMil(v, 1)
const fMilInt = v => v >= 1e6 ? 'R$ ' + nf(v / 1e6, 0).replace(/,0$/, '') + ' mi' : 'R$ ' + nf(v / 1000, 0) + ' mil'; // ptMilInt
const fPct = v => Math.round(v * 100) + '%';
const fMilPt = v => v >= 1e6 ? 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }).slice(0, 0) + (Math.round(v / 1e4) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' mi' : fMil(v); // ptMil(v, 1)
const fTela = v => v >= 1e6 ? 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M' : v >= 1000 ? 'R$ ' + Math.round(v / 1000) + 'K' : 'R$ ' + Math.round(v); // fmtNum da ferramenta
const semNb = t => String(t).replace(/\u00a0/g, ' ');
function esperado(Cc) {
  const soma = pre => Object.keys(Cc.resp).filter(k => k.indexOf(pre) === 0).reduce((a, k) => a + Cc.resp[k], 0);
  const pm = { f1: soma('F1.') / 21, f2: soma('F2.') / 9, f3: soma('F3.') / 15, f4: soma('F4.') / 12 };
  const cap = m => Math.max(0.20, Math.min(0.70, 0.20 + (1 - m) * 0.50));
  const orc = parseInt(String(Cc.orcamento).replace(/\./g, ''), 10), prazo = +Cc.prazo, obras = +Cc.obras, mo = Cc.b0.modeloMO;
  const fator = { time: cap(pm.f3 * 0.5 + pm.f4 * 0.5), retrabalho: cap(pm.f2 * 0.3 + pm.f3 * 0.7), velocidade: cap(pm.f1 * 0.5 + pm.f2 * 0.5), erros: cap(pm.f3 * 0.4 + pm.f4 * 0.6), mo: cap(pm.f3 * 0.7 + pm.f2 * 0.3) };
  // sem horas informadas: 98 h/mês (12,25 dias × 8 h) GASTAS × 80% de economia média ((40% + 4 × 90%) ÷ 5) = 78,4 h/mês recuperáveis
  const horasRec = Cc.horas ? Cc.horas.reduce((a, h, i) => a + h * [0.4, 0.9, 0.9, 0.9, 0.9][i], 0) : 12.25 * 8 * ((0.4 + 4 * 0.9) / 5);
  const perda = { time: horasRec * 115 * prazo, retrabalho: orc * 0.10, velocidade: orc * 0.15 * 0.10, erros: orc * 0.45 * 0.05 };   // referências, antes do ajuste
  const red = { time: 1, retrabalho: 0.40, velocidade: 1, erros: 0.70, mo: 0.70 };
  if (mo === 'propria') perda.mo = orc * 0.45 * 0.15; else if (mo === 'mista') perda.mo = orc * 0.45 * 0.50 * 0.15;
  const fontes = Object.keys(perda), P = {}, G = {};
  fontes.forEach(k => { P[k] = Math.round(perda[k] * fator[k]); G[k] = Math.round(perda[k] * fator[k] * red[k]); });
  const somaP = fontes.reduce((a, k) => a + P[k], 0), somaG = fontes.reduce((a, k) => a + G[k], 0);
  const top3 = Cc.prioFontes || fontes.slice().sort((a, b) => P[b] - P[a]).slice(0, 3);   // 1 prioridade por fonte, das 3 mais caras (ou as fontes após a retirada)
  return { prazo, obras, fator, red, ref: perda, horasRec, P, G, somaP, somaG, perdaMes: somaP / prazo, ganhoMes: somaG / prazo, capEf: somaG / somaP,
    critPerda: top3.reduce((a, k) => a + P[k], 0), critMes: top3.reduce((a, k) => a + P[k], 0) / prazo, critCapMes: top3.reduce((a, k) => a + G[k], 0) / prazo, top3 };
}
const EXP = esperado(C);
const avisos = {}; // code -> warning visible after the star (score 3 only)
let telaF44 = ''; // questionnaire card text where F4.4 is asked
const telasPilar = []; // innerText of each pillar result screen (word "gap" must not appear)
const GAP = /gaps?/i;
let telaFerr = null, telaHoras = ''; // tools screen (fields shown) and hours screen text

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
    await page.goto(process.env.PROD_URL || ('http://localhost:' + PORT + '/index.html'), { waitUntil: 'networkidle0' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    await page.type('#c-empresa', C.empresa);
    await page.type('#c-contato', C.contato);
    await page.evaluate(v => { document.getElementById('c-cargo').value = v; }, C.cargo);
    await page.type('#c-consultor', C.consultor);
    await page.type('#c-email', 'contato@empresa-exemplo.com.br');
    await page.type('#c-telefone', '(11) 90000-0000');
    await page.click('button[onclick="startAssessment()"]');
    await sleep(300); if (process.env.AGENDA) {
      // Optional 2nd-meeting scheduling on the Diagnóstico screen (AGENDA=1)
      await page.evaluate(() => {
        document.getElementById('reuniao2-data').value = '2026-10-28';
        document.getElementById('reuniao2-hora').value = '14:30';
        addReuniao2Participante('Marina Alves', 'Diretora de Engenharia');
        addReuniao2Participante('', 'Sem nome');
      });
    }
    await page.click('#btn-diagnostico-continuar');  await sleep(300); await page.click('#btn-metodo-continuar'); await sleep(250); await page.click('#btn-portfolio-continuar'); await sleep(250); await page.click('#btn-premios-iniciar');
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
        telaFerr = await page.evaluate(() => ({ folha: !!document.getElementById('ferr-folha'), contratos: !!document.getElementById('ferr-contratos'), txt: document.getElementById('b0-card').innerText }));
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
      if (scr === 'screen-radar' || scr === 'screen-confirmacao') break;
      if (scr === 'screen-phase-result') { telasPilar.push(await page.evaluate(() => document.getElementById('screen-phase-result').innerText)); await page.click('#result-next-btn'); await sleep(200); continue; }
      if (scr === 'screen-horas') {
        telaHoras = await page.evaluate(() => document.getElementById('horas-card').innerText);
        await page.evaluate(v => document.querySelectorAll('#horas-card input').forEach((el, i) => el.value = v ? String(v[i]) : ''), C.horas);
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
          // F4.4 as shown on screen (combo "No fechamento / ERP"), checked against the labor model below
          if (codes.indexOf('F4.4') >= 0) telaF44 = await page.evaluate(() => document.getElementById('phase-card').innerText);
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
              avisos[code] = await page.evaluate(c => { const a = document.querySelector('#dor-' + c.replace('.', '\\.') + ' .dor-aviso'); return !!a && a.style.display !== 'none'; }, code);
            }
          }
        }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(120);
        continue;
      }
      await sleep(200);
    }
    check('tela de horas preenchida', horasOk);
    check('após as horas vem a Conferência, antes do Radar', await active(page) === 'screen-confirmacao', await active(page));
    await page.click('#btn-conf-resultados'); await sleep(900);
    check('Ver resultados -> Radar', await active(page) === 'screen-radar', await active(page));
    let roiAntes = null, roiDepois = null;
    if (C.ajustes) {
      const r = await page.evaluate(aj => { var a = calculateROI().totalBase; S.prioAjustes = aj; return { a: a, b: calculateROI().totalBase }; }, C.ajustes);
      roiAntes = r.a; roiDepois = r.b;
    }
    await sleep(1200);
    await page.evaluate(() => { var m = document.getElementById('save-modal'); if (m) m.style.display = 'none'; });
    await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="revealAha(\'mid\')"]').click()); await sleep(400);
    // AHA: tudo o que se chama de perda usa a perda estimada (referência × ajuste); o recuperável aparece rotulado, sem o percentual total
    const aha = await page.evaluate(() => ({ perObra: document.getElementById('aha-per-obra').textContent, total: document.getElementById('aha-total').textContent, rec: document.getElementById('aha-recuperavel').textContent, comps: Array.prototype.map.call(document.querySelectorAll('#aha-components .aha-num'), e => e.textContent), sub: document.getElementById('aha-subtotal').textContent, hasConf: !!document.querySelector('#screen-aha [onclick*="showConfirmacao"]') }));
    const ordem = ['time', 'retrabalho', 'velocidade', 'erros', 'mo'].filter(k => EXP.P[k] != null);
    check('AHA: perda por obra = perda estimada (' + fTela(EXP.somaP) + ', soma das fontes, referência × ajuste)', aha.perObra === fTela(EXP.somaP), aha.perObra + ' x ' + fTela(EXP.somaP));
    check('AHA: portfólio = perda estimada × obras (' + fTela(EXP.somaP * EXP.obras) + ')', aha.total === fTela(EXP.somaP * EXP.obras), aha.total + ' x ' + fTela(EXP.somaP * EXP.obras));
    check('AHA: composição por fonte em perda estimada e subtotal = perda estimada', JSON.stringify(aha.comps) === JSON.stringify(ordem.map(k => fTela(EXP.P[k]))) && aha.sub === fTela(EXP.somaP), aha.comps.join(' | ') + ' / ' + ordem.map(k => fTela(EXP.P[k])).join(' | '));
    check('AHA: ganho rotulado como recuperável (' + fTela(EXP.somaG) + ' por obra), sem o percentual total', aha.rec === 'Recuperável com o plano: ' + fTela(EXP.somaG) + ' por obra' + (EXP.obras > 1 ? ' · ' + fTela(EXP.somaG * EXP.obras) + ' no portfólio' : ''), aha.rec);
    check('AHA sem atalho para a Conferência', !aha.hasConf);
    check('AHA: texto visível sem a palavra "gap"', !GAP.test(await page.evaluate(() => document.getElementById('screen-aha').innerText)));
    await page.evaluate(() => document.querySelector('#screen-aha button[onclick="showReport()"]').click()); await sleep(1200);
    check('relatório sem o botão "← Conferência" (sem atalho visível ao cliente)', await page.evaluate(() => !/Conferência/.test(document.getElementById('screen-report').innerText) && !document.querySelector('#screen-report [onclick*="showConfirmacao"]')));

    check('telas de resultado por pilar (' + telasPilar.length + '): texto visível sem a palavra "gap"', telasPilar.length >= 4 && telasPilar.every(t => !GAP.test(t)), (telasPilar.map(t => (t.match(GAP) || [''])[0]).join('|')));
    check('relatório na tela: texto visível sem a palavra "gap"', !GAP.test(await page.evaluate(() => document.getElementById('screen-report').innerText)));
    // Proposta e diagnóstico focado (telas montadas aqui só para ler o texto; o PDF do relatório vem depois e não depende delas)
    const outras = await page.evaluate(() => {
      var r = {};
      try { var pb = ptpBuild(); r.proposta = pb.root.innerText; pb.root.parentNode.removeChild(pb.root); } catch (e) { r.proposta = 'ERRO ' + e.message; }
      try { focusedPilar = 'f3'; showFocusedResult(); r.focado = document.getElementById('screen-focused-result').innerText; } catch (e) { r.focado = 'ERRO ' + e.message; }
      showScreen('screen-report');
      return r;
    });
    check('proposta na tela: texto visível sem a palavra "gap" e com o título novo', !GAP.test(outras.proposta) && /Principais pontos críticos do diagnóstico/i.test(outras.proposta) && !/^ERRO/.test(outras.proposta), (outras.proposta.match(GAP) || [outras.proposta.slice(0, 40)])[0]);
    check('diagnóstico focado: texto visível sem a palavra "gap"', !GAP.test(outras.focado) && !/^ERRO/.test(outras.focado), (outras.focado.match(GAP) || [outras.focado.slice(0, 40)])[0]);

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
      var f03 = root ? Array.prototype.map.call(root.querySelectorAll(':scope > .page')[2].querySelectorAll('table tbody tr'), function(tr){ return Array.prototype.map.call(tr.children, function(td){ return td.innerText.trim(); }); }) : [];
      var grp = root ? Array.prototype.filter.call(root.querySelectorAll('tr.grp'), function(g){ return /fase de implementação iii/i.test(g.innerText); })[0] : null;
      var gI = root ? Array.prototype.filter.call(root.querySelectorAll('tr.grp'), function(g){ return /fase de implementação i(?!i)/i.test(g.innerText); })[0] : null;
      var reg = root ? root.querySelector('.tl') : null, plano = root ? root.querySelector('.plano') : null, F = Node.DOCUMENT_POSITION_FOLLOWING;
      var ordem = { ok: !!(grp && gI && reg && plano), I_antes_III: !!(gI && grp && (gI.compareDocumentPosition(grp) & F)), III_antes_regua: !!(grp && reg && (grp.compareDocumentPosition(reg) & F)), regua_antes_plano: !!(reg && plano && (reg.compareDocumentPosition(plano) & F)) };
      return { pages: pages, over: over, fontsOk: fontsOk, f03: f03, ordem: ordem };
    });
    if (process.env.DUMP_PONTOS) {
      // Points model (critical + others): n, code, phase, priority, for before/after comparison
      const pts = await page.evaluate(() => { const M = ptModel('detalhado'); return M.criticos.concat(M.demais).map(p => [p.n, p.code, p.fase, p.prioridade].join('|')); });
      fs.writeFileSync(process.env.DUMP_PONTOS, pts.join(String.fromCharCode(10)));
    }
    if (C.ajustes) {
      const aj = await page.evaluate(() => { const M = ptModel('detalhado'); return { crit: M.criticos.map(c => c.code).join(','), tit: M.criticos.map(c => c.titulo), demais: M.demais.map(d => d.code + ':' + d.n).join(','), pdf: document.getElementById('ptr-root').innerText }; });
      check('caso com ajuste: prioridades do relat\u00f3rio = MO.6, F4.3, F4.4 (a vaga da n\u00ba 3 foi para a pr\u00f3xima fonte)', aj.crit === 'MO.6,F4.3,F4.4', aj.crit);
      check('caso com ajuste: o PDF traz o t\u00edtulo da nova n\u00ba 3 e MO.3 volta para a tabela de pontos cr\u00edticos', aj.pdf.replace(/\u00a0/g, ' ').indexOf(aj.tit[2]) >= 0 && /MO\.3:\d+/.test(aj.demais), aj.tit[2] + ' | ' + aj.demais);
      check('caso com ajuste: a perda total do ROI n\u00e3o muda (' + roiAntes + ' = ' + roiDepois + ')', roiAntes === roiDepois && roiAntes > 0);
    }
    const all = dom.pages.join('\n').replace(/\u00a0/g, ' ');
    const allLow = all.toLowerCase();
    const pend = all.match(/.{0,40}\[PENDENTE.{0,40}/i);
    if (process.env.DUMP) dom.pages.forEach((t, i) => console.log('\n===== FOLHA ' + (i + 1) + ' =====\n' + t));
    console.log('\nFolga até o carimbo:', JSON.stringify(dom.over));
    check('fontes Bai Jamjuree e Manrope carregadas', dom.fontsOk.every(Boolean), JSON.stringify(dom.fontsOk));
    check('folga >= 10 mm em todas as folhas', dom.over.every(o => parseFloat(o.folga_mm) >= 9.5), JSON.stringify(dom.over.filter(o => parseFloat(o.folga_mm) < 9.5)));
    // No orphan sheet: no non-cover sheet may have more than 180 mm free, except the accepted "Próximo passo" + signatures sheet
    const orfas = dom.over.filter((o, i) => parseFloat(o.folga_mm) > 180 && !/PRÓXIMO PASSO/i.test(dom.pages[i + 1]));
    check('nenhuma folha órfã (folga > 180 mm), exceto a do bloco Próximo passo', orfas.length === 0, JSON.stringify(orfas));
    check('sem [PENDENTE]', !pend, pend && pend[0]);
    check('sem "(TESTE)", e-mail ou telefone', !/\(teste\)|@|\(\d{2}\)\s?\d/i.test(all));
    check('sem a palavra gap', !/\bgaps?\b/i.test(all));
    check('sem roteiro de venda', !/bate com a realidade|desenharmos o escopo|não precisam ser comentados/i.test(all));
    check('sem "Fase 4"/Jornada', !/Jornada|Fase 4/i.test(all));
    check('Depoimento de Cliente Agilean', /Depoimento de Cliente Agilean/i.test(all));
    check('sem "Pilar / tema", "tema fora", ACOMPANHAMENTO nem "Rotinas N" / numeração de rotinas', !/Pilar \/ tema|tema fora|ACOMPANHAMENTO|Rotinas \d|\d · (Planejamento|Medição|Qualidade|ERP|Controle de Contratos|Folha de Produção)|Pilar 4 · Painéis/.test(all));
    check('MO sem "Mão de obra" como pilar na tabela de pontos', !/	Mão de obra	/.test(all));
    // Coherence: the point of phase N shows only the short name of phase N; order = phase I, II, III, then loss source, then current order
    const coer = await page.evaluate(() => {
      const M = ptModel('detalhado'); const bad = [];
      M.criticos.concat(M.demais).forEach(p => {
        const curto = { I: 'I · Planejamento e canteiro', II: 'II · ERP e qualidade', III: 'III · Pagamento da MO' }[p.fase];
        if (p.faseCurta !== curto) bad.push(p.code + ' fase ' + p.fase + ' ' + p.faseCurta);
      });
      const gp = getGapPlan(calculateROI());
      gp.rest.forEach(o => { const f = PT_FASE[o.code]; if (((f === 'I' || f === 'II') ? 'Alta' : 'Média') !== o.prioridade) bad.push('ferramenta ' + o.code + ' ' + o.prioridade); });
      // Section 04 / tool table: only the remaining critical points, by loss source, then phase, then current order
      if (M.demais.some(d => !gp.rest.some(o => o.code === d.code)) || M.demais.length !== gp.rest.length) bad.push('pontos em alerta na tabela ou crítico faltando');
      const rk = o => gp.fontesOrd.indexOf(o.fonte), fz = o => ['I', 'II', 'III'].indexOf(PT_FASE[o.code]);
      const esp = gp.rest.map((o, i) => ({ o, i })).sort((a, b) => (rk(a.o) - rk(b.o)) || (fz(a.o) - fz(b.o)) || (a.i - b.i)).map(k => k.o.code);
      if (esp.join(',') !== M.demais.map(d => d.code).join(',')) bad.push('ordem do relatório difere da regra: ' + M.demais.map(d => d.code).join(','));
      if (gp.anchors.some(o => o.severity !== 'critico' && !o.star)) bad.push('ponto em alerta sem ★ virou prioridade');
      // Priority cards on screen: pillar of MO points as P2/P3 and the PDF source names
      if (/Prioridade \d · Mão de obra/i.test(document.getElementById('screen-report').innerText)) bad.push('MO como pilar nos cards');
      if (/Gap-âncora|gaps-âncora/i.test(document.getElementById('screen-report').innerText)) bad.push('"Gap-âncora" ainda na tela');
      if (/Otimização do time de gestão|Redução de retrabalhos|Ganho em velocidade de produção/.test(document.getElementById('opp-table-card').innerText + document.getElementById('exec-anchors-card').innerText)) bad.push('nome antigo de fonte na tabela de Gaps/Síntese');
      M.demais.forEach((d, i) => { if (d.n !== M.criticos.length + i + 1) bad.push('numeração ' + d.code); });
      // Tool table = same points, numbers, order and phase as section 04 of the PDF; one group row per loss source
      const trs = Array.prototype.map.call(document.querySelectorAll('#opp-body tr'), tr => Array.prototype.map.call(tr.children, td => td.textContent.trim()));
      const rows = trs.filter(r => r.length === 5), grps = trs.filter(r => r.length === 1);
      if (rows.length !== M.demais.length) bad.push('linhas da ferramenta ' + rows.length + ' x PDF ' + M.demais.length);
      const nFontes = M.demais.filter((d, i) => !i || M.demais[i - 1].fonteKey !== d.fonteKey).length;
      if (grps.length !== nFontes) bad.push('grupos por fonte na ferramenta ' + grps.length + ' x ' + nFontes);
      rows.forEach((r, i) => { const d = M.demais[i]; if (!d || r[0] !== String(d.n).padStart(2, '0') || r[4] !== d.faseCurta || r[2] !== d.pilar || /^MO$/.test(r[2]) || r[1] !== gp.rest.filter(o => o.code === d.code)[0].gap) bad.push('linha ' + i + ' da ferramenta: ' + r.join('|')); });
      if (/Numeração dos pontos igual/.test(document.getElementById('next-steps-container').innerText)) bad.push('nota de numeração ainda na seção 06');
      const card = document.getElementById('opp-table-card').innerText;
      if (/IMEDIATA|PROGRAMADA|Alta|Média|Dia 0|Após o dia 60|Início/i.test(card)) bad.push('palavra de prazo/urgência na tabela de Gaps');
      if (!/Por fonte de perda · \d+ pontos? críticos?/i.test(card)) bad.push('rótulo da tabela de Gaps');
      if (gp.attention.length && card.indexOf(gp.attention.length + ' pontos estão em alerta') < 0 && card.indexOf('Outro ponto está em alerta') < 0) bad.push('contagem de pontos em alerta na ferramenta');
      return bad;
    });
    check('fase coerente (nome curto), só críticos por fonte de perda, mesma regra no relatório e na tabela de Gaps da ferramenta', coer.length === 0, JSON.stringify(coer));
    // Section 06 of the screen: same 3 "Resolve" lines, phase names and numbering as the PDF; no "ato" nor "Gap-âncora"
    const s06 = await page.evaluate(() => {
      const M = ptModel('detalhado'); const t = document.getElementById('next-steps-container').innerText.replace(/\s+/g, ' '); const bad = [];
      ptFases(S.modeloMO).forEach(f => {
        const r = ptResolve(M, f.id); if (r && t.indexOf(r) < 0) bad.push('Resolve fase ' + f.id + ': ' + r);
        if (t.indexOf('Fase de Implementação ' + f.id + ' · ' + ptFaseNome(f, M)) < 0) bad.push('nome da fase ' + f.id);
      });
      if (/atos?|Gap-âncora/i.test(t)) bad.push('texto "ato" ou "Gap-âncora" na seção 06');
      if (!/o plano de ação se organiza em 3 Fases de Implementação/.test(t)) bad.push('frase de introdução');
      if (/obra\(s\)/.test(t)) bad.push('obra(s)');
      return bad;
    });
    check('seção 06 da tela igual ao PDF (Resolve, nomes das fases, sem "ato"/"Gap-âncora")', s06.length === 0, JSON.stringify(s06));
    check('folha 05 com coluna Fase', /FASE\s+PILAR|PILAR\s+FASE/i.test(dom.pages[4] || '') || /Fase I/.test(dom.pages[4] || ''));
    check('bloco Próximo passo presente', /PRÓXIMO PASSO/i.test(all));
    // Phase III by labor model, from day 60: outsourced = Controle de Empreiteiros (30 days, to day 90),
    // own = Folha de Produção (90 days, to day 150), mixed = both
    {
      const temE = MO !== 'propria', temF = MO !== 'terceirizada';
      const tit = MO === 'mista' ? /o Controle de Empreiteiros termina no dia 90 e a Folha de Produção, no dia 150/ :
        (MO === 'propria' ? /a Folha de Produção vai do dia 60 ao dia 150/ : /o Controle de Empreiteiros vai do dia 60 ao dia 90/);
      check('Fase III só com as frentes do tipo de MO (' + MO + ')',
        temE === /Controle de Empreiteiros\s*30 dias, após I e II/.test(all) && temF === /Folha de Produção\s*90 dias, após I e II/.test(all) &&
        temE === /Controle de Empreiteiros em 30 dias \(até o dia 90\)/.test(all) && temF === /Folha de Produção em 90 dias \(até o dia 150\)/.test(all) &&
        temE === /Controle de Contratos \/ Empreiteiros/.test(all) && temF === /Folha de Produção \/ Fechamento de MO/.test(all) &&
        tit.test(all) && !/20 dias|dia 80|Até 90 dias|até cerca do dia 150/i.test(all));
      const ns = await page.evaluate(() => document.getElementById('next-steps-container').innerText);
      check('tela: Fase III só com as frentes do tipo de MO', temF === /Folha de Produção · 90 dias/.test(ns) && temE === /Controle de Empreiteiros · 30 dias/.test(ns) &&
        /A partir do dia 60/.test(ns) && ns.indexOf((temF ? 150 : 90) + ' dias') >= 0 && !/Até 90 dias|20 dias/i.test(ns));
    }
    // Global value (whole term) only in the summary lead; sections 02 to 06 are monthly (Annex A keeps the formulas)
    {
      const corpo = dom.pages.slice(2).join('\n').split(/Anexo A · Memória de cálculo/i)[0].replace(/ /g, ' ');
      const g = corpo.match(/.{0,40}(em \d+ meses|Perda total estimada|Perda, \d+ meses|Capturável).{0,20}/i);
      check('valor global só no resumo do topo', !g && /Perda por mês/i.test(corpo) && /Ganho por mês/i.test(corpo), g && g[0]);
    }
    // Outsourced labor: no own labor / payroll anywhere (PDF text, tool screens and ROI JSON)
    if (MO === 'terceirizada') {
      const semCarimbo = all.replace(/Folha\s*\d+\s*\/\s*\d+/gi, '').replace(/^\s*FOLHA\s*$/gm, '').replace(/\tFOLHA\b/g, '');
      const hit = semCarimbo.match(/.{0,40}(folha|MO própria|mão de obra própria|\bHH\b).{0,40}/i);
      check('terceirizada: sem folha / MO própria no PDF', !hit, hit && hit[0]);
      const extra = await page.evaluate(() => {
        const j = JSON.stringify(buildDiagnosticoJSON().cliente.roiReal);
        // Whole report screen and the Aha screen (rendered on the way to the report)
        const tela = ['screen-report', 'screen-aha'].map(id => { const e = document.getElementById(id); return e ? e.textContent : ''; }).join('\n');
        const t = tela.match(/.{0,40}(folha|MO própria).{0,40}/i);
        return { j: j, rec: calcROIReal(0.5).estrategica.recTotal, tela: t ? t[0] : '' };
      });
      check('terceirizada: JSON do ROI sem folha e recuperação de folha = 0', !/folha/i.test(extra.j) && extra.rec === 0, extra.j + ' rec=' + extra.rec);
      check('terceirizada: telas da ferramenta sem folha / MO própria', !extra.tela, extra.tela);
    }
    // F4.4 follows the labor model: outsourced = contractors' measurement only, own = payroll only, mixed = both
    {
      const f44 = await page.evaluate(() => { const q = findQ('f4', 'F4.4'); return q.text + ' ' + q.reveals; });
      const temF = MO !== 'terceirizada', temM = MO !== 'propria';
      check('F4.4 conforme o tipo de MO (' + MO + '), na pergunta e na tela', !!telaF44 && telaF44.indexOf('O fechamento mensal de ') >= 0 &&
        temF === /folha/i.test(f44) && temM === /medição/i.test(f44) && temF === /fechamento mensal de folha/i.test(telaF44) && temM === /medição de empreiteiros/i.test(telaF44),
        f44.slice(0, 80));
      // Tools screen: payroll tool field only with own labor, contracts tool field only with outsourced labor;
      // hours screen: "fechar medição" / "fechar folha" by labor model
      check('tela de ferramentas conforme o tipo de MO', !!telaFerr && telaFerr.folha === temF && telaFerr.contratos === temM, JSON.stringify(telaFerr && { folha: telaFerr.folha, contratos: telaFerr.contratos }));
      check('tela de horas conforme o tipo de MO', temF === /folha/i.test(telaHoras) && temM === /medição de empreiteiros/i.test(telaHoras), (telaHoras.match(/Medir avanço[^\n]*/) || [''])[0]);
    }
    check('seções 03 "Prioridades" e 04 "Demais pontos críticos", sem "Ponto crítico N" nem "Demais pontos avaliados"', /03\s+Prioridades/i.test(dom.pages[0] || '') && /04\s+Demais pontos críticos/i.test(dom.pages[0] || '') && !/Ponto crítico \d|Pontos críticos \d|Demais pontos avaliados/.test(all));
    check('★ em nota 3 mostra aviso na ferramenta; nas demais respostas, não', Object.keys(avisos).every(c => avisos[c] === (c === 'F2.1' && CASE === 'pcl2')), JSON.stringify(avisos));
    check('Participação recomendada sempre visível', /Participação recomendada/i.test(all));
    if (process.env.AGENDA) {
      check('agendamento: 28/10/2026 e 14h30', /28\/10\/2026/.test(all) && /14h30/.test(all));
      check('participantes: tabela nas duas versões',
        /Participante confirmado/i.test(all) && /Marina Alves/.test(all) && all.indexOf(C.contato) >= 0 && !/Sem nome/.test(all));
    } else {
      check('sem agendamento: "A definir" e sem tabela', /A definir/.test(all) && !/Participante confirmado/i.test(all));
    }
    // v5: folha 03 on the loss-map base (total loss, captured share, monthly gain, x reference fee), no explanatory notes
    check('folha 03: perda estimada por mês e ganho mensal (2 cards, sem o card de captura), sem notas e sem múltiplo', /Perda estimada por mês/i.test(dom.pages[2] || '') && !/Captura\s*\n?\s*\d+%/i.test((dom.pages[2] || '').split(/FONTE DE PERDA/i)[0]) && /Ganho mensal/i.test(dom.pages[2] || '') && !/mensalidade|×/i.test((dom.pages[2] || '').split(/FONTE DE PERDA/i)[0]) && !/Contexto:|não se somam|Unidade:|Fonte:/.test(dom.pages[2] || ''));
    check('PDF sem nenhuma menção a "mensalidade" (toda a versão ' + MODE + ')', !/mensalidade/i.test(all), (all.match(/.{0,30}mensalidade.{0,30}/i) || [''])[0]);
    {
      const num = t => parseFloat(String(t).replace(/[^\d,]/g, '').replace(',', '.'));
      const linhas = (dom.f03 || []).map(r => r.map(semNb)).filter(r => r.length >= 4 && /^R\$/.test(r[1]) && /%$/.test(r[2]) && /^R\$/.test(r[3]) && !/^Total/.test(r[0]));
      const ruins = linhas.filter(r => { const pm = num(r[1]), c = num(r[2]) / 100, g = num(r[3]); return Math.abs(pm * c - g) > 0.05 + pm * 0.005 + 0.05 * c; }).map(r => r.slice(0, 4).join(' | '));
      check('folha 03: perda × captura = ganho em cada linha (' + linhas.length + ' fontes)', linhas.length >= 4 && ruins.length === 0, JSON.stringify(ruins));
      const tot = (dom.f03 || []).filter(r => /^Total( por obra|, 1 obra)$/.test(semNb(r[0]).trim())).map(r => r.map(semNb))[0];
      check('folha 03: a linha Total não mostra o percentual de captura (só por fonte)', !!tot && tot[2] === '', JSON.stringify(tot));
      check('folha 03: valores batem com a regra (perda estimada/mês ' + fMil(EXP.perdaMes) + ', ganho/mês ' + fMil(EXP.ganhoMes) + ')', !!tot && tot[1] === fMil(EXP.perdaMes) && tot[3] === fMil(EXP.ganhoMes), JSON.stringify(tot));
      check('folha 03: captura por fonte = redução com o SIIGA (' + linhas.map(r => r[2]).join(', ') + ')', linhas.length >= 4 && linhas.every(r => { const f = Object.keys(EXP.P).filter(k => fMil(EXP.P[k] / EXP.prazo) === r[1] && fMil(EXP.G[k] / EXP.prazo) === r[3])[0]; return f && r[2] === fPct(EXP.red[f]); }), JSON.stringify(linhas));
      check('folha 03: título em reais ("' + fMil(EXP.ganhoMes) + ' dos ' + fMil(EXP.perdaMes) + ' de perda estimada por mês' + (EXP.obras > 1 ? ', por obra,' : '') + ' são recuperáveis com o plano")', semNb(dom.pages[2] || '').replace(/\s+/g, ' ').indexOf(fMil(EXP.ganhoMes) + ' dos ' + fMil(EXP.perdaMes) + ' de perda estimada por mês' + (EXP.obras > 1 ? ', por obra,' : '') + ' são recuperáveis com o plano') >= 0);
      check('folha 03: nota das fontes com captura 100% (horas e custo indireto do prazo)', /captura é 100%: a perda já é a parte que o SIIGA elimina/.test(semNb(dom.pages[2] || '').replace(/\s+/g, ' ')));
      // rodada 6: cenário conservador = 50% do ganho proposto (esperado da regra, não da saída do app)
      const CONS = 0.5, nf2 = v => 'R$ ' + (v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2, useGrouping: true }) + ' mil', nf1 = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      const f03 = semNb(dom.pages[2] || '').replace(/\s+/g, ' ');
      const notaEsp = 'Mesmo recuperando só 50% do proposto: ' + fMil(EXP.ganhoMes * CONS) + ' por mês' + (EXP.obras > 1 ? ', por obra' : '');
      check('rodada 6: folha 03 (' + MODE + ') com a nota "' + notaEsp + '"', f03.indexOf(notaEsp) >= 0, f03.slice(-300));
      if (EXP.obras > 1) {
        const mp = f03.match(/\(R\$ ([\d.,]+) mil por mês no portfólio de (\d+) obras\)/), esp = EXP.somaG * EXP.obras / EXP.prazo * CONS / 1000;
        check('rodada 6: nota com o valor no portfólio (' + fMil(EXP.somaG * EXP.obras / EXP.prazo * CONS) + ' no portfólio de ' + EXP.obras + ' obras)', !!mp && +mp[2] === EXP.obras && Math.abs(parseFloat(mp[1].replace(/\./g, '').replace(',', '.')) - esp) < 0.06, mp && mp[0]);
      } else check('rodada 6: nota sem "no portfólio" (1 obra)', f03.indexOf('no portfólio de') < 0 || /Total no portfólio/.test(f03));
      check('rodada 6: nota do conservador sem fórmula nem cálculo (' + MODE + ')', !/Mesmo recuperando[^.]*(fórmula|cálculo)/i.test(f03));
      check('rodada 6: sem "Pessimista" em nenhuma parte (' + MODE + ')', !/pessimista/i.test(all));
      check('rodada 6: sem "Cenário adotado" na folha 06 nem em nenhuma parte (' + MODE + ')', !/Cenário adotado/i.test(all));
      if (MODE === 'resumido') check('rodada 6: Resumido sem "fórmula"', !/fórmula/i.test(all));
      else {
        const ax4 = semNb(all).replace(/\s+/g, ' '), k4 = ax4.search(/A\.4 RETORNO MENSAL/i), a4 = k4 >= 0 ? ax4.slice(k4) : '';
        check('rodada 6: A.4 presente', k4 >= 0);
        check('rodada 6: A.4 total = folha 03 (perda ' + nf2(EXP.perdaMes) + ' e ganho ' + nf2(EXP.ganhoMes) + '; folha 03 ' + fMil(EXP.perdaMes) + ' e ' + fMil(EXP.ganhoMes) + ')', a4.indexOf(nf2(EXP.perdaMes)) >= 0 && a4.indexOf(nf2(EXP.ganhoMes)) >= 0 && f03.indexOf(fMil(EXP.ganhoMes)) >= 0);
        const rotulos = Object.keys(EXP.P).filter(k => k !== 'mo' || EXP.P.mo);
        check('rodada 6: A.4 com uma linha por fonte (perda ÷ ' + EXP.prazo + ' e ganho/mês de cada uma)', rotulos.every(k => a4.indexOf(fMil(EXP.P[k]) + ' ÷ ' + EXP.prazo) >= 0 && a4.indexOf(nf2(EXP.P[k] / EXP.prazo)) >= 0 && a4.indexOf(nf2(EXP.G[k] / EXP.prazo)) >= 0), a4.slice(0, 600));
        check('rodada 6: A.4 com "Cenário conservador (50% do ganho proposto)" = ' + nf2(EXP.ganhoMes * CONS), a4.indexOf('Cenário conservador (50% do ganho proposto) ' + nf2(EXP.ganhoMes * CONS)) >= 0);
        const hMes = EXP.horasRec * EXP.fator.time;
        check('rodada 6: A.4 indicadores: horas recuperáveis ' + nf1(hMes) + ' h/mês (= ganho das horas ÷ R$ 115/h), ' + nf1(hMes * EXP.prazo) + ' h por obra, ' + (hMes / 176 * 100).toFixed(1).replace('.', ',') + '% de 1 profissional, conservador ' + nf1(hMes * CONS) + ' h/mês',
          Math.abs(EXP.G.time / EXP.prazo / 115 - hMes) < 0.05 && a4.indexOf(nf1(hMes) + ' h/mês') >= 0 && a4.indexOf(nf1(hMes * EXP.prazo) + ' h') >= 0 && a4.indexOf((hMes / 176 * 100).toFixed(1).replace('.', ',') + '%') >= 0 && a4.indexOf(nf1(hMes * CONS) + ' h/mês') >= 0);
        check('rodada 6: A.4 sem o modelo antigo (captura do cenário, Horas do time técnico, folha, indevidos)', !/captura do cenário|Horas do time técnico|Retrabalho pago na folha|Pagamentos indevidos|Potencial pleno/i.test(a4));
      }
    }
    check('plano: Fases I e II, depois a Fase III, depois a régua, depois o card do plano de ação', dom.ordem.ok && dom.ordem.I_antes_III && dom.ordem.III_antes_regua && dom.ordem.regua_antes_plano, JSON.stringify(dom.ordem));
    check('folhas 02 e 05 sem IMEDIATA, PROGRAMADA, Dia 0, Após o dia 60 nem Início', !/IMEDIATA|PROGRAMADA|Dia 0|Após o dia 60|início em até|Implantar em até/i.test((dom.pages[1] || '') + (dom.pages[4] || '').split(/PLANO DE TRANSFORMAÇÃO/i)[0]) && !/IMEDIATA|PROGRAMADA/.test(all));
    check('folha 05: coluna Fase com nome curto, sem coluna de perda e sem nota de rodapé', /I · Planejamento e canteiro/.test(dom.pages[4] || '') && /III · Pagamento da MO/.test(dom.pages[4] || '') && !/Perda por mês sem tratamento/i.test(dom.pages[4] || '') && !/A Fase III vem após|o valor aparece só nos pontos críticos/.test(all));
    // v5: wording rules and the same total on folhas 02 and 03
    check('sem "Parcial" (status "Em alerta")', !/\bParcial(mente)?\b/.test(all) && /Em alerta/.test(dom.pages[1] || ''));
    check('sem "Confidencial" nem "resumido"/"detalhado" no documento', !/Confidencial/i.test(all) && !/resumido|relatório detalhado/i.test(all));
    check('capa: "Relatório Diagnóstico SIIGA"', /Relatório Diagnóstico SIIGA/i.test(dom.pages[0] || ''));
    check('sem seção "Perda por fonte e ganho capturável" e sem referência a seções nas notas', !/Perda por fonte e ganho capturável/i.test(all) && !/seção \d/i.test(all));
    check('sumário 01 a 06 (05 = Plano, 06 = Bases)', /05\s+Plano de Transformação Operacional/i.test(dom.pages[0] || '') && /06\s+Bases do diagnóstico/i.test(dom.pages[0] || ''));
    {
      const p2 = (dom.pages[1] || '').replace(/\u00a0/g, ' '), p3 = (dom.pages[2] || '').replace(/\u00a0/g, ' ');
      const num = s => parseFloat(s.replace(/\./g, '').replace(',', '.'));
      const m2 = p2.match(/perda estimada (?:na|por) obra é de R\$ ([\d.,]+) (mil|mi) em (\d+) meses/);
      const mm = p3.match(/Perda estimada por mês\s*R\$ ([\d.,]+) mil/i);
      const k = u => u === 'mi' ? 1000 : 1;
      const t2 = m2 && num(m2[1]) * k(m2[2]);
      // Sheet 02 total (rounded in the lead) = monthly loss of sheet 03 × term
      check('total da folha 02 = perda/mês da folha 03 × prazo', !!(m2 && mm) && Math.abs(num(mm[1]) * +m2[3] - t2) <= (m2[2] === 'mi' ? 50 : 1),
        JSON.stringify({ folha02: m2 && m2.slice(1), mes: mm && mm[1] }));
      check('folha 02: linha "Recuperável com o plano" só com o valor R$/mês (' + fMil(EXP.critCapMes) + '), sem múltiplo', semNb(p2).replace(/\s+/g, ' ').indexOf('Recuperável com o plano ' + fMil(EXP.critCapMes) + '/mês') >= 0 && !/Recuperável com o plano ·/.test(p2), (semNb(p2).match(/Recuperável com o plano.{0,30}/) || [''])[0]);
    }
    check('folha 02: Fase de Implementação com nome curto', /I · Planejamento e canteiro|III · Pagamento da MO/.test(dom.pages[1] || '') && /Fase de Implementação/i.test(dom.pages[1] || ''));
    if (MODE === 'resumido') {
      check('Resumido sem fórmula (÷, Cálculo:, Como é calculado, Fórmula, Anexo)', !/÷|Cálculo:|Como é calculado|Fórmula|Anexo A/i.test(all));
    } else {
      check('Detalhado com Anexo A e fórmula ÷', /Anexo A/.test(all) && /÷/.test(all));
    }
    // Expected sheets (v5, without the loss-by-source section): Detalhado 10; Resumido 8, with or without the participants table
    const EXP_FOLHAS = MODE === 'resumido' ? 8 : 10;
    if (CASE === 'pcl2') {
      ['Total das 4 prioridades', '3 de 13 pontos críticos; 1 ponto em alerta com dor declarada', 'Em alerta · dor declarada pelo cliente', 'Digitalização da FVS vinculada ao avanço físico',
       '“A gente paga o empreiteiro e depois descobre o retrabalho.”', 'Outros 10 pontos estão em alerta', 'Resolve: prioridade 4; pontos críticos 08 e 10.'].forEach(s => check('PCL ★ contém "' + s + '"', all.indexOf(s) >= 0));
      check('★ em nota 3 (F2.1) fora do relatório', !/corre atrás de material/i.test(all));
      // Option B: section 04 starts on the sheet of the 4th priority, so the sheet count stays the same
      check('seção 04 na mesma folha da Prioridade 4', /PRIORIDADE 4/.test(dom.pages[4] || '') && /DEMAIS PONTOS CRÍTICOS/.test(dom.pages[4] || ''));
      check('PCL ★ folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
    } else if (CASE === 'pcl') {
      ['21,5', fMilInt(EXP.somaP), fMilInt(EXP.critPerda), fMil(EXP.P.retrabalho / EXP.prazo), fMil(EXP.P.time / EXP.prazo), fMil(EXP.P.mo / EXP.prazo),
       fMil(EXP.critMes) + '/mês', fMil(EXP.critCapMes) + '/mês', fMil(EXP.ganhoMes), fMil(EXP.perdaMes),
       fMil(EXP.G.time / EXP.prazo), fMil(EXP.G.retrabalho / EXP.prazo), fMil(EXP.G.velocidade / EXP.prazo), fMil(EXP.G.erros / EXP.prazo), fMil(EXP.G.mo / EXP.prazo),
       'Digitalização do painel integrado de indicadores', 'Digitalização da comunicação de bloqueios de pagamento', 'Implantação da gestão de aditivos de verba',
       'Plano de Transformação Operacional para a Construtora PCL', 'Pilar 3, Gestão integrada da produção', 'Resolve: prioridade 2; pontos críticos 04, 05, 06, 10, 11, 12 e 13; 6 pontos em alerta.',
       'Resolve: pontos críticos 07 e 09; 1 ponto em alerta.', 'Resolve: prioridades 1 e 3; ponto crítico 08; 4 pontos em alerta.', 'Por fonte de perda · 10 pontos críticos',
       'Outros 11 pontos estão em alerta', '3 de 13 pontos críticos', 'Total das 3 prioridades', 'mesma fonte da Prioridade 1'].forEach(s => check('PCL contém "' + s + '"', allLow.indexOf(s.toLowerCase()) >= 0));
      // Hours+payroll model only in the Detalhado annex (A.4); 15-month source values only in the annex
      [fMil(EXP.P.time), fMil(EXP.P.retrabalho), fMil(EXP.P.mo), fMil(EXP.somaP), fMil(EXP.P.velocidade), fMil(EXP.P.erros), fMil(EXP.somaG)].forEach(s => check('PCL ' + (MODE === 'resumido' ? 'sem' : 'com (Anexo)') + ' "' + s + '"', (allLow.indexOf(s.toLowerCase()) >= 0) === (MODE !== 'resumido')));
      check('PCL sem múltiplo da mensalidade (5,1×, 3,1×, 9,5×, 12,5×)', !/5,1×|3,1×|9,5×|12,5×/.test(all));
      {
        const ax = semNb(all).replace(/\s+/g, ' ');
        check('rodada 5: "Custo indireto do prazo" e sem "Custos proporcionais" nem "Fator de captura" em nenhuma parte', /Custo indireto do prazo/.test(ax) && !/Custos proporcionais|Fator de captura|fator de captura/.test(ax));
        check('rodada 5: glossário/bases com "Ajuste pela maturidade" e custos indiretos (15% × 10%)', /Ajuste pela maturidade/.test(ax) && /15% do orçamento × 10%/.test(ax));
        if (MODE !== 'resumido') {
          check('Anexo A.2 "Perda estimada por fonte": retrabalho = orçamento × 10% × ajuste ' + fPct(EXP.fator.retrabalho), ax.indexOf('A.2 Perda estimada por fonte') >= 0 || /A\.2 PERDA ESTIMADA POR FONTE/.test(ax) ? ax.indexOf('Orçamento R$ 3,5 mi × 10% × ' + fPct(EXP.fator.retrabalho) + ' (ajuste)') >= 0 : false);
          check('Anexo A.2: custo indireto do prazo = orçamento × 15% (custos indiretos) × 10% (redução de prazo com o SIIGA) × ajuste ' + fPct(EXP.fator.velocidade), ax.indexOf('Orçamento R$ 3,5 mi × 15% (custos indiretos) × 10% (redução de prazo com o SIIGA) × ' + fPct(EXP.fator.velocidade) + ' (ajuste)') >= 0);
          check('Anexo A.3 "Redução e ganho": retrabalho ' + fMil(EXP.P.retrabalho) + ' × 40%, erros ' + fMil(EXP.P.erros) + ' × 70%, horas ' + fMil(EXP.P.time) + ' × 100%, total com a captura ' + fPct(EXP.capEf), ax.indexOf(fMil(EXP.P.retrabalho) + ' × 40%') >= 0 && ax.indexOf(fMil(EXP.P.erros) + ' × 70%') >= 0 && ax.indexOf(fMil(EXP.P.time) + ' × 100%') >= 0 && ax.indexOf(fPct(EXP.capEf) + ' ' + fMil(EXP.somaG)) >= 0);
          check('Anexo A.1: custos indiretos 15% do orçamento e redução de prazo 10% (referência SIIGA) em linhas separadas', /Custos indiretos do prazo \(equipe, equipamentos, canteiro\) 15% do orçamento/.test(ax) && /Redução de prazo com o SIIGA 10% \(referência SIIGA\)/.test(ax));
        }
      }
      check('PCL sem "custa R$ 26 mil" e sem bloco horas+folha no resumo', !/custa R\$ 26 mil/.test(all) && !/Perda em horas de gestão e folha/i.test(all));
      check('PCL folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
    } else if (CASE === 'ajuste') {
      // PCL with MO.3 taken out of the priorities: the 3rd priority is the best critical of the next source (F4.4); MO.3 goes back to section 04
      ['Total das 3 prioridades', 'Digitalização do controle financeiro do fechamento (ERP)', 'Por fonte de perda · 10 pontos críticos', 'Outros 11 pontos estão em alerta', fMilInt(EXP.somaP), fMil(EXP.P.erros / EXP.prazo)].forEach(s => check('ajuste contém "' + s + '"', allLow.indexOf(s.toLowerCase()) >= 0));
      check('ajuste: MO.3 (aditivos de verba) segue no relatório, só como ponto crítico', /Implantação da gestão de aditivos de verba/.test(all) && !/PRIORIDADE 3[\s\S]{0,80}aditivos/i.test(dom.pages[3] || ''));
      check('ajuste folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
    } else if (CASE === 'prop') {
      // Own labor: the A.4 is per loss source (no payroll lines since round 6), no contractors front
      check('própria: "MO própria" no escopo', /MO própria/.test(all));
      check('própria folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
      check('própria: sem linhas de retrabalho/pagamentos na folha (A.4 por fonte)', !/Retrabalho pago na folha|Pagamentos indevidos/.test(all));
    } else if (CASE === 'semhoras') {
      // No hours informed: 98 h/mês spent × 80% average saving = 78,4 h/mês recoverable; expected values come from the rule (78,4 h × R$ 115 × prazo × fator)
      const horasRec = 12.25 * 8 * 0.8, perdaTime = horasRec * 115 * EXP.prazo;
      check('sem horas: referência do time = 78,4 h × R$ 115 × prazo', Math.abs(EXP.ref.time - perdaTime) <= 1, EXP.ref.time + ' x ' + perdaTime);
      check('sem horas: perda estimada do time = 78,4 h × R$ 115 × prazo × ajuste, e o ganho é igual à perda (redução 100%)', Math.abs(EXP.P.time - Math.round(perdaTime * EXP.fator.time)) <= 1 && EXP.G.time === EXP.P.time, EXP.P.time);
      [fMil(EXP.P.time / EXP.prazo), fMil(EXP.G.time / EXP.prazo), fMil(EXP.perdaMes), fMil(EXP.ganhoMes)].forEach(s => check('sem horas contém "' + s + '"', all.indexOf(s) >= 0));
      if (MODE !== 'resumido') {
        check('sem horas: Anexo A com 98 h/mês × 80% = 78,4 h/mês', /98\s*h/.test(all) && /80%/.test(all) && /78,4\s*h/.test(all));
        check('sem horas: sem a referência antiga "12,25 dias × 8 h"', !/12,25 dias × 8 ?h/.test(all));
      }
      check('sem horas folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
    } else {
      check('título sem artigo: "para Horizonte Engenharia"', allLow.indexOf('plano de transformação operacional para horizonte engenharia') >= 0);
      check('sem linhas de folha própria (terceirizada)', !/Retrabalho pago na folha/.test(all));
      check('ERP "Não utiliza ERP"', /Não utiliza ERP/.test(all));
      check('prazo 24 meses', /24 meses/.test(all));
      check('terceirizada folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
      ['Resolve: prioridade 2; pontos críticos 04, 05, 06, 07, 09, 10, 11 e 12; 5 pontos em alerta.', 'Resolve: pontos críticos 08 e 13; 1 ponto em alerta.', 'Resolve: prioridades 1 e 3; 1 ponto em alerta.', 'Por fonte de perda · 10 pontos críticos', 'Outros 7 pontos estão em alerta', fMil(EXP.perdaMes), fMil(EXP.ganhoMes), fMil(EXP.critCapMes) + '/mês', 'Total no portfólio (3 obras)', fMil(EXP.perdaMes * EXP.obras), fMil(EXP.ganhoMes * EXP.obras)].forEach(s => check('terceirizada contém "' + s + '"', allLow.indexOf(s.toLowerCase()) >= 0));
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
