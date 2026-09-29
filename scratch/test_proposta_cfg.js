// E2E: preenche o diagnóstico UMA vez e gera 3 Propostas com configurações
// diferentes do painel do vendedor (S.proposta), salvando um PDF de cada e
// verificando o conteúdo da seção de Investimento/Termos. Uso:
//   node scratch/test_proposta_cfg.js
// Saídas: 3 PDFs em <raiz do projeto>/SIIGA_Proposta_Teste{1,2,3}_*.pdf
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');
const EMPRESA = 'Construtora Cenarios E2E';
const PORT = 8342;

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

// Gera a Proposta com a config dada e devolve {innerText, pdfUri}.
async function gerar(page, cfg) {
  return await page.evaluate(async (cfg) => {
    S.proposta = cfg;
    window.__LAST_PROPOSTA_PDF_DATA = null;
    generateProposta('detalhado');
    const uri = await new Promise(resolve => {
      const it = setInterval(() => { if (!document.getElementById('pdf-loading') && window.__LAST_PROPOSTA_PDF_DATA) { clearInterval(it); resolve(window.__LAST_PROPOSTA_PDF_DATA); } }, 250);
      setTimeout(() => { clearInterval(it); resolve(window.__LAST_PROPOSTA_PDF_DATA || null); }, 90000);
    });
    return { txt: document.getElementById('screen-proposta').innerText, uri: uri };
  }, cfg);
}
function savePdf(uri, name, check) {
  if (uri && uri.startsWith('data:application/pdf')) {
    const b64 = uri.replace(/^data:application\/pdf;filename=[^;]+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
    fs.writeFileSync(path.join(ROOT_DIR, name), Buffer.from(b64, 'base64'));
    check('PDF gerado: ' + name, true);
  } else { check('PDF gerado: ' + name, false); }
}

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
    await page.goto(process.env.URL || ('http://localhost:' + PORT + '/index.html'), { waitUntil: 'networkidle0' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    // ── Preenche o diagnóstico (fluxo padrão, respostas medianas) ──
    await page.type('#c-empresa', EMPRESA);
    await page.type('#c-contato', 'Ana Ribeiro');
    await page.type('#c-cargo', 'Diretora de Operações');
    await page.type('#c-consultor', 'Consultor Agilean');
    await page.type('#c-email', 'ana@cenarios.com.br');
    await page.type('#c-telefone', '(11) 98888-7777');
    await page.click('button[onclick="startAssessment()"]');
    await sleep(300);
    for (let i = 0; i < 30; i++) {
      if (await active(page) !== 'screen-b0') break;
      const q = await page.evaluate(() => { var q = B0Q[currentQIdx]; return { type: q.type, key: q.key, opts: (q.opts || []).map(o => o.v) }; });
      if (q.type === 'roi') {
        await page.evaluate(() => { document.getElementById('roi-obras').value = '5'; document.getElementById('roi-prazo').value = '18'; var o = document.getElementById('roi-orcamento'); o.value = '8.000.000'; o.dispatchEvent(new Event('input', { bubbles: true })); });
      } else if (q.type === 'ferramentas') {
        await page.evaluate(() => document.querySelectorAll('#b0-card input[id^="ferr-"]').forEach((el, i) => el.value = 'Ferramenta ' + (i + 1)));
      } else {
        const opts = await page.$$('#b0-card .opt');
        let idx = Math.min(1, opts.length - 1);
        if (opts.length) await opts[idx].click();
      }
      await page.click('.screen.active .btn-p[onclick="nextQ()"]');
      await sleep(120);
    }
    await sleep(300);
    await page.evaluate(() => document.querySelector('#focus-all .focus-card-header').click()); await sleep(200);
    await page.evaluate(() => document.getElementById('btn-start-diagnosis').click()); await sleep(300);
    for (let i = 0; i < 80; i++) {
      const scr = await active(page);
      if (scr === 'screen-radar') break;
      if (scr === 'screen-phase-result') { await page.click('#result-next-btn'); await sleep(200); continue; }
      if (scr === 'screen-horas') { await page.evaluate(() => document.querySelectorAll('#horas-card input').forEach((el, i) => el.value = String([44,10,28,20,18][i]))); await page.click('#horas-next-btn'); await sleep(600); continue; }
      if (scr === 'screen-phase') {
        const info = await page.evaluate(() => { var bk = phaseOrder[currentPhaseIdx]; var q = getNavQs(PQ[bk], bk)[currentQIdx]; return { type: q.type }; });
        if (info.type === 'numgrid') { await page.evaluate(() => document.querySelectorAll('#phase-card input[id^="rg-"]').forEach(el => { el.value = '150.000'; el.dispatchEvent(new Event('input', { bubbles: true })); })); }
        else { const nn = await page.$$eval('#phase-card .options', gs => gs.length); for (let gi = 0; gi < nn; gi++) { await page.evaluate(gi => { var g = document.querySelectorAll('#phase-card .options')[gi]; var o = g && g.querySelectorAll('.opt'); if (o && o.length) o[1].click(); }, gi); await sleep(40); } }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(120); continue;
      }
      await sleep(200);
    }
    await sleep(800);
    await page.evaluate(() => { var m = document.getElementById('save-modal'); if (m) m.style.display = 'none'; });
    await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="revealAha(\'mid\')"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="showReport()"]').click()); await sleep(1200);
    check('Diagnóstico preenchido (tela report)', (await active(page)) === 'screen-report');

    // Números de referência (defaults resolvidos por getPropostaCfg).
    const ref = await page.evaluate(() => { var c = getPropostaCfg(); return { n:S.numObras, completoAtiv:PROP_ATIVACAO.completo.tab, completoPiso:PROP_ATIVACAO.completo.piso, escalaObra:propPrecoPlanoObra('escala',S.numObras) }; });
    console.log('\n numObras=' + ref.n + ' | ativação completo=' + ref.completoAtiv + ' (piso ' + ref.completoPiso + ') | escala/obra=' + ref.escalaObra + '\n');

    // ── CENÁRIO 1: Completo, com descontos nos 2 produtos + Modelo Piloto 2 meses ──
    const r1 = await gerar(page, { plan:'completo', progPor:52000, ativPor:14000, mensalPor:null, piloto:true, pilotoMeses:2, validade:20, kickoff:'2026-10-20' });
    savePdf(r1.uri, 'SIIGA_Proposta_Teste1_Completo_Descontos_Piloto.pdf', check);
    check('C1: Redesenho de Processos SIIGA presente', r1.txt.indexOf('Redesenho de Processos SIIGA') >= 0);
    check('C1: Ativação do Completo presente', r1.txt.indexOf('Ativação SIIGA Plan., Controle, Qualidade e MO') >= 0);
    check('C1: desconto na consultoria (52.000)', r1.txt.indexOf('52.000') >= 0);
    check('C1: Modelo Piloto 2 meses na observação', r1.txt.indexOf('2 primeiras mensalidades') >= 0);
    check('C1: Kick-Off sugerido (20/10/2026)', r1.txt.indexOf('20/10/2026') >= 0);

    // ── CENÁRIO 2: só consultoria — Ativação "não se aplica", sem piloto ──
    const r2 = await gerar(page, { plan:'maestria', ativNA:true, piloto:false, validade:15 });
    savePdf(r2.uri, 'SIIGA_Proposta_Teste2_SoConsultoria_SemAtivacao.pdf', check);
    check('C2: Ativação "Não se aplica" presente', r2.txt.indexOf('Não se aplica') >= 0);
    check('C2: NÃO cita Modelo Piloto', r2.txt.indexOf('Modelo Piloto') < 0);
    check('C2: consultoria em valor cheio (60.000)', r2.txt.indexOf('60.000') >= 0);

    // ── CENÁRIO 3: Escala + módulos (MO terc. + Qualidade), valores cheios ──
    const r3 = await gerar(page, { plan:'escala', mods:{ mo3:true, qq:true }, validade:30 });
    savePdf(r3.uri, 'SIIGA_Proposta_Teste3_Escala_Modulos.pdf', check);
    check('C3: Ativação do Escala presente', r3.txt.indexOf('Ativação SIIGA Planejamento e Controle') >= 0);
    check('C3: módulos listados (Gestão MO · terceirizada)', r3.txt.indexOf('Gestão MO · terceirizada') >= 0);
    check('C3: módulo Qualidade listado', r3.txt.indexOf('Gestão da Qualidade') >= 0);

  } catch (e) { console.error('ERROR', e); fails.push('exception: ' + e.message); }
  console.log(fails.length ? ('\n' + fails.length + ' FALHA(S): ' + fails.join('; ')) : '\nTODOS OS CHECKS PASSARAM — 3 cenários gerados e verificados');
  await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
});
