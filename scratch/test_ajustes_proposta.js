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
const PORT = 8347;

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


    // ── A: Redesenho "Não se aplica" (só Ativação), mensalidade com desconto por obra ──
    const rA = await gerar(page, { plan:'maestria', progNA:true, mensalPor:1700, validade:15, kickoff:'2026-10-20' });
    savePdf(rA.uri, 'SIIGA_Proposta_Ajustes_A_SoAtivacao.pdf', check);
    check('A: seções do programa ocultas (Objetivo)', !/objetivo do redesenho/i.test(rA.txt));
    check('A: seção Programa oculta', !/o programa de redesenho siiga/i.test(rA.txt));
    check('A: Workshop Lean fora da capa', !/workshop lean experience/i.test(rA.txt));
    check("A: sem \"Não se aplica\" e sem card de Redesenho", !/não se aplica/i.test(rA.txt) && !/redesenho de processos siiga/i.test(rA.txt));
    check('A: mensalidade por obra (1.700 /obra/mês)', /1\.700[\s\S]{0,30}\/obra\/mês/.test(rA.txt));
    check('A: De riscado por obra (1.932)', rA.txt.indexOf('1.932') >= 0);
    check('A: "para 5 obras"', rA.txt.indexOf('5 obras') >= 0);
    check('A: cobrança desde o 1º mês de uso', rA.txt.indexOf('1º mês de uso') >= 0);
    check('A: sem "Fase 1"/Kick-Off do programa', rA.txt.indexOf('Fase 1') < 0);
    check('A: sem total multiplicado (R$ 8.500 /mês)', rA.txt.indexOf('8.500') < 0 && rA.txt.indexOf('9.660') < 0);
    const nums = await page.evaluate(() => Array.from(document.querySelectorAll('#screen-proposta .card')).filter(c => c.style.display !== 'none').map(c => { var e = c.querySelector('.prop-sec-num'); return e ? e.textContent : null; }).filter(Boolean));
    check('A: numeração contínua 01..N', nums.every((v, i) => v === (i + 1 < 10 ? '0' : '') + (i + 1)), nums.join(','));

    // ── B: os dois produtos ativos, desconto por obra ──
    const rB = await gerar(page, { plan:'maestria', mensalPor:1700, validade:15 });
    savePdf(rB.uri, 'SIIGA_Proposta_Ajustes_B_Completa.pdf', check);
    check('B: Objetivo do Redesenho presente', /objetivo do redesenho/i.test(rB.txt));
    check('B: mensalidade por obra 1.700 e "5 obras"', /1\.700/.test(rB.txt) && rB.txt.indexOf('5 obras') >= 0);
    check('B: card Plataforma nos termos por obra', /Plataforma \(após\)[\s\S]{0,60}\/obra\/mês/i.test(rB.txt));

    // ── C: modal — toggle progNA e exclusão mútua com ativNA ──
    const c = await page.evaluate(() => {
      openPropostaModal();
      const q = sel => document.querySelector('#proposta-modal ' + sel);
      const out = {};
      out.lblObra = document.getElementById('pm-mensal') != null && document.getElementById('proposta-modal').innerText.indexOf('Por obra/mês') >= 0;
      q('[data-toggle="progNA"]').click();
      out.progHidden = !document.getElementById('pm-prog');
      q('[data-toggle="ativNA"]').click();
      out.progBackOn = !!document.getElementById('pm-prog');
      out.ativHidden = !document.getElementById('pm-ativ');
      document.getElementById('proposta-modal').remove();
      return out;
    });
    check('C: campo mensalidade rotulado "Por obra/mês"', c.lblObra);
    check('C: progNA esconde valor do Redesenho', c.progHidden);
    check('C: ativNA desliga progNA (exclusão mútua)', c.progBackOn && c.ativHidden);

    // ── D: só Redesenho (Ativação NA), nº de obras ajustado na proposta (3 obras; diagnóstico = 5) ──
    const rD = await gerar(page, { nObras:3, plan:'maestria', ativNA:true, mensalPor:1800, validade:15, kickoff:'2026-10-20' });
    savePdf(rD.uri, 'SIIGA_Proposta_Ajustes_D2_SoRedesenho_3obras.pdf', check);
    check("D: sem \"Não se aplica\" e sem card de Ativação", !/não se aplica/i.test(rD.txt) && !/ativação siiga/i.test(rD.txt));
    check('D: mensalidade por obra faixa 2-3 (2.162 De, 1.800 Por) e "3 obras"', rD.txt.indexOf('2.162') >= 0 && rD.txt.indexOf('1.800') >= 0 && rD.txt.indexOf('3 obras') >= 0);
    check('D: Objetivo do Redesenho presente', /objetivo do redesenho/i.test(rD.txt));

    // ── E: modal — alterar nº de obras troca a faixa/preço ──
    const e = await page.evaluate(() => {
      S.proposta = null;
      openPropostaModal();
      const inp = document.getElementById('pm-nobras');
      inp.value = '12'; inp.dispatchEvent(new Event('change', { bubbles: true }));
      const txt = document.getElementById('proposta-modal').innerText;
      const out = { faixa: /acima de 10 obras/.test(txt), diag: /diagnóstico: /.test(txt), val: document.getElementById('pm-nobras').value };
      document.getElementById('pm-gen').click();
      return out;
    });
    await sleep(1000);
    check('E: faixa "acima de 10 obras" após digitar 12', e.faixa && e.val === '12');
    check('E: mostra nº do diagnóstico ao lado', e.diag);
    const eCfg = await page.evaluate(() => { const c = getPropostaCfg(); return { n: c.nObras, preco: c.precoObra }; });
    check('E: cfg usa 12 obras (Maestria >10 = 1.242)', eCfg.n === 12 && eCfg.preco === 1242, JSON.stringify(eCfg));
    await page.evaluate(() => { S.proposta = null; });

  } catch (e) { console.error('ERROR', e); fails.push('exception: ' + e.message); }
  console.log(fails.length ? ('\n' + fails.length + ' FALHA(S): ' + fails.join('; ')) : '\nTODOS OS CHECKS PASSARAM');
  await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
});
