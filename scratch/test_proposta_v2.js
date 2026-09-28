// E2E real da Proposta reconstruída (12 seções, ordem do "Considerações da
// Proposta.docx", 2026-09-28): clica pelo questionário, chega ao relatório,
// gera a Proposta (resumido + detalhado), salva os PDFs e valida o conteúdo no
// DOM. Gravações no Supabase e chamadas de IA são bloqueadas.
// Uso: node scratch/test_proposta_v2.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');
const MO = process.env.MO || 'propria';
const PORT = 8331;

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
    page.on('request', r => ((r.url().includes('supabase.co') && r.method() !== 'GET' && r.method() !== 'OPTIONS') || r.url().includes('anthropic')) ? r.abort() : r.continue());
    page.on('pageerror', err => { console.log('PAGE ERROR:', err.message); fails.push('pageerror: ' + err.message); });
    page.on('dialog', d => d.dismiss());
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
    const URL = 'http://localhost:' + PORT + '/index.html';
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    await page.type('#c-empresa', 'Construtora Meridiano');
    await page.type('#c-contato', 'Contato Teste');
    await page.type('#c-cargo', 'Diretor de Operações');
    await page.type('#c-consultor', 'Consultor Teste');
    await page.type('#c-email', 'teste@meridiano.com.br');
    await page.type('#c-telefone', '(11) 91234-5678');
    await page.click('button[onclick="startAssessment()"]');
    await sleep(300);

    // Bloco 0
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
        let idx = opts.length - 1;
        if (q.key === 'modeloMO') idx = q.opts.indexOf(MO);
        if (opts.length) await opts[idx].click();
      }
      await page.click('.screen.active .btn-p[onclick="nextQ()"]');
      await sleep(120);
    }
    await sleep(300);
    await page.evaluate(() => document.querySelector('#focus-all .focus-card-header').click()); await sleep(200);
    await page.evaluate(() => document.getElementById('btn-start-diagnosis').click()); await sleep(300);

    // Pilares + horas
    for (let i = 0; i < 80; i++) {
      const scr = await active(page);
      if (scr === 'screen-radar') break;
      if (scr === 'screen-phase-result') { await page.click('#result-next-btn'); await sleep(200); continue; }
      if (scr === 'screen-horas') {
        const vals = [44, 10, 28, 20, 18];
        await page.evaluate(v => document.querySelectorAll('#horas-card input').forEach((el, i) => el.value = String(v[i])), vals);
        await page.click('#horas-next-btn'); await sleep(600); continue;
      }
      if (scr === 'screen-phase') {
        const info = await page.evaluate(() => { var bk = phaseOrder[currentPhaseIdx]; var q = getNavQs(PQ[bk], bk)[currentQIdx]; return { type: q.type }; });
        if (info.type === 'numgrid') {
          await page.evaluate(() => document.querySelectorAll('#phase-card input[id^="rg-"]').forEach(el => { el.value = '150.000'; el.dispatchEvent(new Event('input', { bubbles: true })); }));
        } else {
          const nGroups = await page.$$eval('#phase-card .options', gs => gs.length);
          for (let gi = 0; gi < nGroups; gi++) { await page.evaluate(gi => { var g = document.querySelectorAll('#phase-card .options')[gi]; var o = g && g.querySelectorAll('.opt'); if (o && o.length) o[1].click(); }, gi); await sleep(40); }
        }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(120); continue;
      }
      await sleep(200);
    }
    await sleep(1000);
    await page.evaluate(() => { var m = document.getElementById('save-modal'); if (m) m.style.display = 'none'; });
    await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="revealAha(\'mid\')"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="showReport()"]').click()); await sleep(1000);

    // ── Gera as duas propostas e salva os PDFs ──
    async function gerar(mode) {
      const uri = await page.evaluate(async (m) => new Promise(resolve => {
        window.__LAST_PROPOSTA_PDF_DATA = null;
        generateProposta(m);
        const it = setInterval(() => { if (!document.getElementById('pdf-loading') && window.__LAST_PROPOSTA_PDF_DATA) { clearInterval(it); resolve(window.__LAST_PROPOSTA_PDF_DATA); } }, 300);
        setTimeout(() => { clearInterval(it); resolve(window.__LAST_PROPOSTA_PDF_DATA || null); }, 120000);
      }), mode);
      if (uri && uri.startsWith('data:application/pdf')) {
        const b64 = uri.replace(/^data:application\/pdf;filename=[^;]+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
        const out = path.join(ROOT_DIR, 'SIIGA_PROPOSTA_V2_' + mode.toUpperCase() + '.pdf');
        fs.writeFileSync(out, Buffer.from(b64, 'base64'));
        console.log('PDF salvo:', out);
        check('PDF ' + mode + ' gerado', true);
      } else { check('PDF ' + mode + ' gerado', false); }
    }
    // força um ERP nomeado para exercitar a personalização do bloco de integração
    await page.evaluate((erp) => { S.ferramentas = S.ferramentas || {}; S.ferramentas.erp = erp; }, process.env.ERP || 'sienge');
    await gerar('detalhado');

    // ── Assertions sobre o DOM da proposta (modo detalhado, já construído) ──
    const t = await page.evaluate(() => document.getElementById('screen-proposta').innerHTML);
    const has = s => t.indexOf(s) >= 0;
    check('#1 hero renomeado', has('Proposta do Escopo de Projeto para a'));
    check('#1 subtítulo consultivo (nasce do diagnóstico)', has('nasce diretamente do diagnóstico'));
    check('#1 faixa Lean Experience na capa (3 fotos)', has('Workshop Lean Experience') && (t.match(/img\/lean\/Foto/g)||[]).length === 3);
    check('#2 faixa "prêmio/valor em jogo" removida', !has('valor em jogo') && !has('O PRÊMIO'));
    check('#3 recap com nome da empresa', has('Recapitulação Executiva do Diagnóstico SIIGA da CONSTRUTORA MERIDIANO'));
    check('#4 maiores gaps', has('Maiores Gaps Identificados no Diagnóstico') && has('composição da exposição'));
    check('#5 objetivo do redesenho', has('Objetivo do Redesenho SIIGA') && has('Meta Central'));
    check('#6 programa de redesenho', has('O Programa de Redesenho SIIGA'));
    check('#7 resultados por nível', has('Resultados Esperados por Nível'));
    check('#7 integração com ERP do cliente (Sienge)', has('Integrações Nativas de ERP') && has('nativamente ao Sienge'));
    check('#7 cards de integração padrão (orçamento×plan. + medições)', has('Orçamento × Planejamento') && has('Envio das medições físico-financeiras'));
    check('#8 jornada/governança', has('Jornada, Governança e Time'));
    check('#8 formato remoto (sem "3 encontros presenciais")', has('forma') && has('remota') && !has('3 encontros presenciais'));
    check('#9 método SIIGA + base metodologia', has('O Método SIIGA') && has('A base da nossa Metodologia SIIGA'));
    check('#9 implantação x redesenho', has('Implantação de Sistema × Redesenho SIIGA'));
    check('#10 depoimentos (CONX/Dimas/Dasart)', has('CONX') && has('Natalia V. de Dios') && has('Claudio Barreira'));
    check('#11 investimento personalizado', has('Investimento Personalizado para a CONSTRUTORA MERIDIANO'));
    check('#11 sem chips de módulos', !has('MO3') && !has('MOP') && !has('CPO'));
    check('#12 retorno projetado personalizado', has('Retorno Projetado para a CONSTRUTORA MERIDIANO'));
    check('#12 cenário Base 50% + média das obras + payback', has('captura de 50%') && has('duração média das obras') && has('Payback'));
    check('#12 cenário único (sem Agressivo/Pleno)', !has('AGRESSIVO') && !has('Agressivo'));
    check('#13 próximo passo consultivo (kick-off + orçamento das obras)', has('data do Kick-Off') && has('planejamento e o orçamento das obras'));
    check('sem título antigo "Proposta Comercial" na tela', !has('Proposta Comercial'));
    // documento único: a memória de cálculo (detalhado) está presente
    check('memória de cálculo presente (documento único = detalhado)', has('Memória de cálculo') && has('Como é calculado'));

  } catch (e) { console.error('ERROR', e); fails.push('exception: ' + e.message); }
  console.log(fails.length ? ('\n' + fails.length + ' FALHA(S): ' + fails.join('; ')) : '\nTODOS OS CHECKS PASSARAM');
  await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
});
