// Teste E2E real (clica pelo questionário) das correções de 24/09/2026:
// score único /57, ROI com mensalidade R$2.000 e captura 50% fixas, tela única
// de horas depois do Pilar 4, nomenclatura "Pilar". Requisições ao Supabase são
// bloqueadas — nada é gravado na base de produção.
// Uso: MO=terceirizada|propria  PDF=1  node scratch/test_score_roi_pilar.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');
const MO = process.env.MO || 'terceirizada';
const WANT_PDF = process.env.PDF === '1';
const OUT = process.env.OUT || ('SIIGA_TESTE_SCORE_ROI_PILAR_' + MO.toUpperCase() + '.pdf');
const PORT = 8231 + (MO === 'propria' ? 1 : 0);

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  let filePath = path.join(BASE_DIR, reqPath);
  if (!fs.existsSync(filePath)) filePath = path.join(ROOT_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
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
    // Leituras do Supabase liberadas; gravações (POST/PATCH/DELETE) e IA bloqueadas
    page.on('request', r => ((r.url().includes('supabase.co') && r.method() !== 'GET' && r.method() !== 'OPTIONS') || r.url().includes('anthropic')) ? r.abort() : r.continue());
    page.on('pageerror', err => { console.log('PAGE ERROR:', err.message); fails.push('pageerror: ' + err.message); });
    page.on('dialog', d => d.dismiss());
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
    const URL = process.env.URL || ('http://localhost:' + PORT + '/index.html');
    console.log('URL:', URL);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    await page.type('#c-empresa', 'CONSTRUTORA TESTE PILAR ' + MO.toUpperCase());
    await page.type('#c-contato', 'Contato Teste');
    await page.type('#c-cargo', 'Diretor de Engenharia');
    await page.type('#c-consultor', 'Consultor Teste');
    await page.type('#c-email', 'teste@teste-pilar.com.br');
    await page.type('#c-telefone', '(11) 91234-5678');
    await page.click('button[onclick="startAssessment()"]');
    await sleep(300); await page.click('#btn-diagnostico-continuar');  await sleep(300); await page.click('#btn-metodo-iniciar');
    await sleep(300);

    // Bloco 0 — B0.3 na opção máxima (3 pts) para provar que ela NÃO entra no total
    for (let i = 0; i < 30; i++) {
      if (await active(page) !== 'screen-b0') break;
      const q = await page.evaluate(() => { var q = B0Q[currentQIdx]; return { type: q.type, key: q.key, opts: (q.opts || []).map(o => o.v) }; });
      if (q.type === 'roi') {
        await page.evaluate(() => {
          document.getElementById('roi-obras').value = '2';
          document.getElementById('roi-prazo').value = '22';
          var o = document.getElementById('roi-orcamento'); o.value = '14.000.000'; o.dispatchEvent(new Event('input', { bubbles: true }));
        });
      } else if (q.type === 'ferramentas') {
        await page.evaluate(() => document.querySelectorAll('#b0-card input[id^="ferr-"]').forEach((el, i) => el.value = 'Ferramenta ' + (i + 1)));
      } else {
        const opts = await page.$$('#b0-card .opt');
        let idx = opts.length - 1;
        if (q.key === 'modeloMO') idx = q.opts.indexOf(MO);
        if (opts.length) await opts[idx].click();
      }
      await page.click('.screen.active .btn-p[onclick="nextQ()"]');
      await sleep(120);
    }
    await sleep(300);
    console.log('Tela após Bloco 0:', await active(page));
    await page.evaluate(() => document.querySelector('#focus-all .focus-card-header').click()); await sleep(200);
    await page.evaluate(() => document.getElementById('btn-start-diagnosis').click()); await sleep(300);

    const navLabels = new Set();
    const screensSeen = [];
    let hoursScreenAfter = null, sawNumgridInPillar = false;
    for (let i = 0; i < 80; i++) {
      const scr = await active(page);
      if (screensSeen[screensSeen.length - 1] !== scr) screensSeen.push(scr);
      if (scr === 'screen-radar') break;
      if (scr === 'screen-phase-result') {
        const lastBk = await page.evaluate(() => phaseOrder[currentPhaseIdx]);
        await page.click('#result-next-btn'); await sleep(200);
        if (await active(page) === 'screen-horas') hoursScreenAfter = lastBk;
        continue;
      }
      if (scr === 'screen-horas') {
        const labels = await page.$$eval('#horas-card label', ls => ls.map(l => l.textContent));
        console.log('Campos da tela de horas:', labels.join(' | '));
        check('tela de horas tem 5 campos', labels.length === 5, labels.length);
        const vals = [44, 10, 28, 20, 18];
        await page.evaluate(v => document.querySelectorAll('#horas-card input').forEach((el, i) => el.value = String(v[i])), vals);
        await page.click('#horas-next-btn'); await sleep(600);
        continue;
      }
      if (scr === 'screen-phase') {
        const info = await page.evaluate(() => {
          var bk = phaseOrder[currentPhaseIdx]; var q = getNavQs(PQ[bk], bk)[currentQIdx];
          return { bk: bk, type: q.type, code: q.code, nav: document.getElementById('nav-step').textContent, badge: (document.querySelector('#phase-card .phase-badge') || {}).textContent };
        });
        navLabels.add(info.nav.split(' · ')[0] + ' | ' + info.badge);
        if (info.type === 'numgrid') {
          if (info.code !== 'MO.ROI1') sawNumgridInPillar = true;
          await page.evaluate(() => document.querySelectorAll('#phase-card input[id^="rg-"]').forEach(el => { el.value = '150.000'; el.dispatchEvent(new Event('input', { bubbles: true })); }));
        } else {
          // Combos: clica a 2ª opção de cada sub-item; perguntas simples: 2ª opção (score 1)
          const nGroups = await page.$$eval('#phase-card .options', gs => gs.length);
          for (let gi = 0; gi < nGroups; gi++) {
            await page.evaluate(gi => { var g = document.querySelectorAll('#phase-card .options')[gi]; var o = g && g.querySelectorAll('.opt'); if (o && o.length) o[1].click(); }, gi);
            await sleep(40);
          }
        }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(120);
        continue;
      }
      await sleep(200);
    }
    console.log('Telas:', screensSeen.join(' > '));
    console.log('Rótulos de navegação:', [...navLabels].join('  ||  '));
    check('tela de horas aparece depois do Pilar 4', hoursScreenAfter === 'f4', hoursScreenAfter);
    check('nenhuma pergunta de horas dentro dos pilares', !sawNumgridInPillar);
    check('nenhum rótulo "Fase" na navegação', ![...navLabels].some(l => /Fase/.test(l)));

    await sleep(1200);
    await page.evaluate(() => { var m = document.getElementById('save-modal'); if (m) m.style.display = 'none'; });
    const radar = await page.evaluate(() => ({ score: document.getElementById('total-score').textContent, lvl: document.getElementById('total-level').textContent, b03: S.scores.b03, labels: (radarChartInst && radarChartInst.data.labels) || null }));
    console.log('Radar:', JSON.stringify(radar));

    await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="revealAha(\'mid\')"]').click()); await sleep(400);
    await page.evaluate(() => (showConfirmacao(), document.getElementById('btn-conf-relatorio').click())); await sleep(1000);

    const rep = await page.evaluate(() => {
      var snap = document.getElementById('exec-snapshot').innerText;
      var m = snap.match(/(\d+(?:[.,]\d+)?)\/(\d+)/);
      var r = window._lastROIReal;
      return {
        snapScore: m ? m[0] : null,
        record: (function(){ var s = getMaturityScoreSummary(); return s.score + '/' + s.max; })(),
        mensInputs: !!document.getElementById('roi2-mensalidade') || !!document.getElementById('roi2-captura'),
        roiMens: r.mensalidade, roiFator: r.fator,
        estText: document.getElementById('roi2-estrategica').innerText,
        sumText: document.getElementById('roi2-summary').innerText,
        paramsText: document.getElementById('roi2-params-box').innerText,
        fluxosText: (document.getElementById('roi2-fluxos-table') || {innerText:'(sem tabela no HTML)'}).innerText,
        cenText: document.getElementById('roi2-cenarios-table').innerText,
        horas: getHorasGestao(), potPleno: r.operacional.potPleno, hMes: r.operacional.hMes, roi: r.estrategica.roi, ganho: r.estrategica.ganhoLiquido,
        perdaTime: (function(){ var it = calculateROI().items.filter(function(i){ return i.key === 'time'; })[0]; return { base: it.baseValue, basis: it.basis }; })(),
        presDias: (document.getElementById('pres-diaslib') || {}).textContent,
        fallback: (function(){ var bak = S.roi2; S.roi2 = {folha:0,hPlanejar:0,hCurtoMedio:0,hMedicao:0,hQualidade:0,hConsolidar:0}; var it = calculateROI().items[0]; S.roi2 = bak; return { base: it.baseValue, basis: it.basis }; })(),
        faseLeft: (document.getElementById('screen-report').innerText.match(/\bFases?\b[^\n]{0,40}/g) || [])
      };
    });
    console.log('Relatório: snapshot', rep.snapScore, '| getMaturityScoreSummary', rep.record);
    console.log('ROI: mensalidade', rep.roiMens, 'fator', rep.roiFator, 'potPleno', rep.potPleno, 'hMes', rep.hMes, 'ROI', Math.round(rep.roi * 100) + '%', 'ganho líquido', Math.round(rep.ganho));
    console.log('Resumo ROI:', rep.sumText);
    console.log('Estratégica:\n' + rep.estText);
    console.log('Pressupostos:\n' + rep.paramsText);
    console.log('Fluxos:\n' + rep.fluxosText);
    console.log('Cenários:\n' + rep.cenText);
    console.log('"Fase" restante no relatório:', JSON.stringify(rep.faseLeft));

    check('radar e relatório mostram o mesmo score', radar.score === rep.snapScore, radar.score + ' vs ' + rep.snapScore);
    check('máximo do score é 57', /\/57$/.test(radar.score), radar.score);
    check('B0.3 = 3 não entra no total', radar.b03 === 3 && radar.score === rep.record, 'b03=' + radar.b03);
    check('radar com rótulos Pilar', radar.labels && radar.labels.every(l => /^Pilar/.test(l)), JSON.stringify(radar.labels));
    check('sem campos editáveis de mensalidade/captura', !rep.mensInputs);
    check('mensalidade fixa 2000 (não × obras)', rep.roiMens === 2000, rep.roiMens);
    check('fator de captura fixo 50%', rep.roiFator === 0.5, rep.roiFator);
    check('linha de investimento mostra R$ 2.000/2K', /R\$ (2\.000|2K)\/mês/.test(rep.estText));
    check('potencial pleno = 44×0,4 + (10+28+20+18)×0,9', Math.abs(rep.potPleno - (44 * 0.4 + 76 * 0.9)) < 1e-6, rep.potPleno);
    console.log('Mapa de Perdas (time):', JSON.stringify(rep.perdaTime), '| pressuposto:', rep.presDias);
    console.log('Fallback sem horas:', JSON.stringify(rep.fallback));
    check('Mapa de Perdas usa horas do cliente: 86 h × R$115 × 22', rep.perdaTime.base === Math.round(86 * 115 * 22), rep.perdaTime.base);
    check('pressuposto mostra 86 h', /^86 h$/.test(rep.presDias || ''), rep.presDias);
    check('sem horas: referência de mercado 98 h × R$115 × 22', rep.fallback.base === Math.round(98 * 115 * 22) && /referência de mercado/.test(rep.fallback.basis), rep.fallback.base);
    check('tabela de cenários mantida (4 linhas)', (rep.cenText.match(/Pessimista|Conservador|Realista|Pleno/g) || []).length >= 4);

    if (WANT_PDF) {
      await page.evaluate(m => { window.__PDF_MODE = m; }, process.env.MODE || 'detalhado');
      const uri = await page.evaluate(async () => new Promise(resolve => {
        generatePDF(false, null, window.__PDF_MODE);
        const it = setInterval(() => { if (!document.getElementById('pdf-loading') && window.__LAST_PDF_DATA) { clearInterval(it); resolve(window.__LAST_PDF_DATA); } }, 300);
        setTimeout(() => { clearInterval(it); resolve(window.__LAST_PDF_DATA || null); }, 120000);
      }));
      if (uri && uri.startsWith('data:application/pdf')) {
        const b64 = uri.replace(/^data:application\/pdf;filename=[^;]+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
        const out = path.join(ROOT_DIR, OUT);
        fs.writeFileSync(out, Buffer.from(b64, 'base64'));
        console.log('PDF salvo em', out);
      } else { check('PDF gerado', false); }
    }
  } catch (e) { console.error('ERROR', e); fails.push('exception'); }
  console.log(fails.length ? ('\n' + fails.length + ' FALHA(S): ' + fails.join('; ')) : '\nTODOS OS CHECKS PASSARAM');
  await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
});
