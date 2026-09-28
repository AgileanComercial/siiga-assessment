// E2E real: preenche o diagnóstico de uma empresa teste, gera OS DOIS PDFs
// (Relatório Diagnóstico SIIGA detalhado + Proposta de Escopo) e verifica se os
// números batem entre os dois documentos (score /57, exposição, payback, pilares).
// Gravações no Supabase e IA bloqueadas. Uso: node scratch/test_full_docs.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');
const EMPRESA = process.env.EMPRESA || 'Construtora Exemplo E2E';
const MO = process.env.MO || 'propria';
const ERP = process.env.ERP || 'sienge';
const PORT = 8341;

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  let filePath = path.join(BASE_DIR, reqPath);
  if (!fs.existsSync(filePath)) filePath = path.join(ROOT_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else { res.writeHead(404); res.end('Not found'); }
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const active = page => page.evaluate(() => { var el = document.querySelector('.screen.active'); return el ? el.id : null; });

server.listen(PORT, async () => {
  const executablePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox'] });
  const fails = [];
  const check = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  -> ' + detail : '')); if (!ok) fails.push(name); };
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', r => ((r.url().includes('supabase.co') && r.method() !== 'GET' && r.method() !== 'OPTIONS') || r.url().includes('anthropic')) ? r.abort() : r.continue());
    page.on('pageerror', err => { console.log('PAGE ERROR:', err.message); fails.push('pageerror: ' + err.message); });
    page.on('dialog', d => d.dismiss());
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
    await page.goto('http://localhost:' + PORT + '/index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    await page.type('#c-empresa', EMPRESA);
    await page.type('#c-contato', 'Ana Ribeiro');
    await page.type('#c-cargo', 'Diretora de Operações');
    await page.type('#c-consultor', 'Consultor Agilean');
    await page.type('#c-email', 'ana@exemploe2e.com.br');
    await page.type('#c-telefone', '(11) 98888-7777');
    await page.click('button[onclick="startAssessment()"]');
    await sleep(300);

    // Bloco 0 — respostas medianas (2ª opção) e ROI realista
    for (let i = 0; i < 30; i++) {
      if (await active(page) !== 'screen-b0') break;
      const q = await page.evaluate(() => { var q = B0Q[currentQIdx]; return { type: q.type, key: q.key, opts: (q.opts || []).map(o => o.v) }; });
      if (q.type === 'roi') {
        await page.evaluate(() => {
          document.getElementById('roi-obras').value = '5';
          document.getElementById('roi-prazo').value = '18';
          var o = document.getElementById('roi-orcamento'); o.value = '8.000.000'; o.dispatchEvent(new Event('input', { bubbles: true }));
        });
      } else if (q.type === 'ferramentas') {
        await page.evaluate(() => document.querySelectorAll('#b0-card input[id^="ferr-"]').forEach((el, i) => el.value = 'Ferramenta ' + (i + 1)));
      } else {
        const opts = await page.$$('#b0-card .opt');
        let idx = Math.min(1, opts.length - 1);
        if (q.key === 'modeloMO') idx = q.opts.indexOf(MO);
        if (q.key === 'erp') { var ei = q.opts.indexOf(ERP); if (ei >= 0) idx = ei; }
        if (opts.length) await opts[idx].click();
      }
      await page.click('.screen.active .btn-p[onclick="nextQ()"]');
      await sleep(120);
    }
    await sleep(300);
    await page.evaluate(() => document.querySelector('#focus-all .focus-card-header').click()); await sleep(200);
    await page.evaluate(() => document.getElementById('btn-start-diagnosis').click()); await sleep(300);

    // Pilares (2ª opção = score 1) + tela de horas
    for (let i = 0; i < 80; i++) {
      const scr = await active(page);
      if (scr === 'screen-radar') break;
      if (scr === 'screen-phase-result') { await page.click('#result-next-btn'); await sleep(200); continue; }
      if (scr === 'screen-horas') {
        await page.evaluate(() => document.querySelectorAll('#horas-card input').forEach((el, i) => el.value = String([44,10,28,20,18][i])));
        await page.click('#horas-next-btn'); await sleep(600); continue;
      }
      if (scr === 'screen-phase') {
        const info = await page.evaluate(() => { var bk = phaseOrder[currentPhaseIdx]; var q = getNavQs(PQ[bk], bk)[currentQIdx]; return { type: q.type }; });
        if (info.type === 'numgrid') {
          await page.evaluate(() => document.querySelectorAll('#phase-card input[id^="rg-"]').forEach(el => { el.value = '150.000'; el.dispatchEvent(new Event('input', { bubbles: true })); }));
        } else {
          const n = await page.$$eval('#phase-card .options', gs => gs.length);
          for (let gi = 0; gi < n; gi++) { await page.evaluate(gi => { var g = document.querySelectorAll('#phase-card .options')[gi]; var o = g && g.querySelectorAll('.opt'); if (o && o.length) o[1].click(); }, gi); await sleep(40); }
        }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(120); continue;
      }
      await sleep(200);
    }
    await sleep(1000);
    await page.evaluate(() => { var m = document.getElementById('save-modal'); if (m) m.style.display = 'none'; });
    await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="revealAha(\'mid\')"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="showReport()"]').click()); await sleep(1200);

    // ── Números canônicos (motores do app) ──
    const canon = await page.evaluate(() => {
      var m = getMaturityScoreSummary();
      var roi = calculateROI();
      var r = window._lastROIReal || calcROIReal(0.50);
      var precoObra = precoPorObraPadrao(S.numObras);
      var rp = calcROIRealComMensalidade(0.50, precoObra);
      return {
        scoreStr: m.score + '/' + m.max, nivel: m.nivel,
        perdaBrutaStr: fmtNum(Math.round(roi.totalBase * (S.numObras||5))),
        capturavelStr: fmtNum(roi.totalPortfolio),
        paybackDiag: fmtPayback(r.estrategica.payback).txt,
        paybackProp: fmtPayback(rp.estrategica.payback).txt,
        prazo: rp.prazo,
        pilares: ['f1','f2','f3','f4'].map(function(k){ return { k:k, sc:getScore(k), max:SCORE_MAX_PILAR[k], pct:Math.round(getAvgPct(k)*100) }; }),
        empresaUpper: (S.empresa||'')
      };
    });
    console.log('\n=== NÚMEROS CANÔNICOS (fonte única: motores do diagnóstico) ===');
    console.log('Empresa:', canon.empresaUpper, '| Nível:', canon.nivel);
    console.log('SIIGA Score:', canon.scoreStr, '| Exposição bruta:', canon.perdaBrutaStr, '| Ganho capturável:', canon.capturavelStr);
    console.log('Payback (diag / proposta):', canon.paybackDiag, '/', canon.paybackProp, '| duração ROI:', canon.prazo, 'meses');
    console.log('Pilares:', canon.pilares.map(function(p){ return p.k+' '+p.sc+'/'+p.max+' ('+p.pct+'%)'; }).join(' · '));

    // ── Verifica no RELATÓRIO (tela report) ──
    const rep = await page.evaluate(() => {
      var snap = (document.getElementById('exec-snapshot') || {}).innerText || '';
      var full = document.getElementById('screen-report').innerText;
      return { snapScore: (snap.match(/(\d+(?:[.,]\d+)?)\/(\d+)/) || [null])[0], full: full };
    });
    check('Relatório: score no Executive Snapshot bate com o canônico', rep.snapScore === canon.scoreStr, rep.snapScore + ' vs ' + canon.scoreStr);
    check('Relatório: perda bruta (exposição) presente', rep.full.indexOf(canon.perdaBrutaStr) >= 0, canon.perdaBrutaStr);
    check('Relatório: ganho capturável presente', rep.full.indexOf(canon.capturavelStr) >= 0, canon.capturavelStr);

    // ── Gera o PDF do DIAGNÓSTICO (detalhado, tema escuro) ──
    const empFile = EMPRESA.replace(/[^a-zA-Z0-9]/g, '_');
    const diagUri = await page.evaluate(async () => new Promise(resolve => {
      window.__LAST_PDF_DATA = null;
      generatePDF(false, null, 'detalhado');
      const it = setInterval(() => { if (!document.getElementById('pdf-loading') && window.__LAST_PDF_DATA) { clearInterval(it); resolve(window.__LAST_PDF_DATA); } }, 300);
      setTimeout(() => { clearInterval(it); resolve(window.__LAST_PDF_DATA || null); }, 120000);
    }));
    if (diagUri && diagUri.startsWith('data:application/pdf')) {
      const b64 = diagUri.replace(/^data:application\/pdf;filename=[^;]+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
      fs.writeFileSync(path.join(ROOT_DIR, 'SIIGA_Diagnostico_' + empFile + '_DETALHADO.pdf'), Buffer.from(b64, 'base64'));
      check('PDF do Diagnóstico gerado', true);
    } else { check('PDF do Diagnóstico gerado', false); }

    // ── Gera o PDF da PROPOSTA ──
    const propUri = await page.evaluate(async () => new Promise(resolve => {
      window.__LAST_PROPOSTA_PDF_DATA = null;
      generateProposta('detalhado');
      const it = setInterval(() => { if (!document.getElementById('pdf-loading') && window.__LAST_PROPOSTA_PDF_DATA) { clearInterval(it); resolve(window.__LAST_PROPOSTA_PDF_DATA); } }, 300);
      setTimeout(() => { clearInterval(it); resolve(window.__LAST_PROPOSTA_PDF_DATA || null); }, 120000);
    }));
    if (propUri && propUri.startsWith('data:application/pdf')) {
      const b64 = propUri.replace(/^data:application\/pdf;filename=[^;]+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
      fs.writeFileSync(path.join(ROOT_DIR, 'SIIGA_Proposta_' + empFile + '.pdf'), Buffer.from(b64, 'base64'));
      check('PDF da Proposta gerado', true);
    } else { check('PDF da Proposta gerado', false); }

    // ── Verifica que a PROPOSTA repete os MESMOS números do diagnóstico ──
    const prop = await page.evaluate(() => document.getElementById('screen-proposta').innerHTML);
    const propTxt = await page.evaluate(() => document.getElementById('screen-proposta').innerText);
    const phas = s => prop.indexOf(s) >= 0;
    const phasT = s => propTxt.indexOf(s) >= 0;  // innerText: score sem <span>, payback sem &lt;
    check('Proposta: mesmo score /57 do diagnóstico', phasT(canon.scoreStr), canon.scoreStr);
    check('Proposta: mesma exposição BRUTA do diagnóstico', phasT(canon.perdaBrutaStr), canon.perdaBrutaStr);
    check('Proposta: mesmo ganho CAPTURÁVEL do diagnóstico', phasT(canon.capturavelStr), canon.capturavelStr);
    check('Proposta: payback presente', phasT(canon.paybackProp), canon.paybackProp);
    check('Proposta: nível de maturidade do diagnóstico presente', phas(canon.nivel), canon.nivel);
    // pilares: score sc/max de cada pilar aparece no recap da proposta
    canon.pilares.forEach(function(p){ check('Proposta: pilar '+p.k+' '+p.sc+'/'+p.max+' presente', phas(p.sc+' / '+p.max), p.sc+' / '+p.max); });

  } catch (e) { console.error('ERROR', e); fails.push('exception: ' + e.message); }
  console.log(fails.length ? ('\n' + fails.length + ' FALHA(S): ' + fails.join('; ')) : '\nTODOS OS CHECKS PASSARAM — informações batem entre os dois documentos');
  await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
});
