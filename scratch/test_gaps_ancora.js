// Teste E2E real (clica pelo questionário) do padrão de apresentação de
// 2026-10: gaps-âncora, marcador ★ de dor, Síntese em 1 página, ROI em 4
// passos, Plano de Ação com próximo passo, títulos do Pilar 1 corrigidos e fim
// do limite de 14 gaps. Caso: Construtora PCL (respostas da call gravada).
// Gravações no Supabase e chamadas de IA são bloqueadas.
// Uso: PDF=1 MODE=resumido|detalhado OUT=arquivo.pdf [URL=https://siiga.vercel.app/] node scratch/test_gaps_ancora.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');
const WANT_PDF = process.env.PDF === '1';
const MODE = process.env.MODE || 'resumido';
const OUT = process.env.OUT || ('SIIGA_TESTE_GAPS_ANCORA_' + MODE.toUpperCase() + '.pdf');
const PORT = 8241;

// Respostas da PCL (score por código) e dores ★ com a frase do cliente.
const RESP = {
  'F1.1':1.5,'F1.2':0,'F1.3':0,'F1.4':1.5,'F1.6':3,'F1.7':0,'F1.5':1.5,
  'F2.1':3,'F2.2':1.5,'F2.3':1.5,
  'F3.1':1,'F3.2':0,'F3.3':1.5,'F3.4':1.5,'F3.5':0,
  'F4.1':1,'F4.2':1,'F4.3':1,'F4.4':1,
  'MO.1':1.5,'MO.2':1,'MO.3':0,'MO.4':1.5,'MO.5':1.5,'MO.6':1,'MO.7':1.5
};
const DORES = { 'F4.3':'o custo sou eu que compilo', 'MO.6':'a gente avisa o empreiteiro pelo WhatsApp' };
const HORAS = [16, 24, 32, 16, 32];

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
  const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
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
    const URL = process.env.URL || ('http://localhost:' + PORT + '/index.html');
    console.log('URL:', URL);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    await page.type('#c-empresa', 'Construtora PCL (teste)');
    await page.type('#c-contato', 'Thiago Toscano');
    await page.evaluate(() => { document.getElementById('c-cargo').value = 'Sócio'; });
    await page.type('#c-consultor', 'Adailton');
    await page.type('#c-email', 'teste@pcl-teste.com.br');
    await page.type('#c-telefone', '(83) 91234-5678');
    await page.click('button[onclick="startAssessment()"]');
    await sleep(300); await page.click('#btn-diagnostico-continuar'); await sleep(300); await page.click('#btn-pilares-continuar'); await sleep(300); await page.click('#btn-metodo-iniciar');
    await sleep(300);
    check('capa aceita e Bloco 0 aberto', await active(page) === 'screen-b0', await active(page));

    for (let i = 0; i < 30; i++) {
      if (await active(page) !== 'screen-b0') break;
      const q = await page.evaluate(() => { var q = B0Q[currentQIdx]; return { type: q.type, key: q.key, opts: (q.opts || []).map(o => o.v) }; });
      if (q.type === 'roi') {
        await page.evaluate(() => {
          document.getElementById('roi-obras').value = '1';
          document.getElementById('roi-prazo').value = '15';
          var o = document.getElementById('roi-orcamento'); o.value = '3.500.000'; o.dispatchEvent(new Event('input', { bubbles: true }));
        });
      } else if (q.type === 'ferramentas') {
        await page.evaluate(() => ['planejamento','medicao','qualidade'].forEach(k => { var el = document.getElementById('ferr-' + k); if (el) el.value = 'Excel'; }));
      } else {
        const want = { tipologia:'vert', b03:'0', modeloMO:'mista', momento:'crescimento' }[q.key];
        const idx = Math.max(0, q.opts.indexOf(want));
        const opts = await page.$$('#b0-card .opt');
        if (opts.length) await opts[idx].click();
      }
      await page.click('.screen.active .btn-p[onclick="nextQ()"]');
      await sleep(120);
    }
    await sleep(300);
    await page.evaluate(() => document.querySelector('#focus-all .focus-card-header').click()); await sleep(200);
    await page.evaluate(() => document.getElementById('btn-start-diagnosis').click()); await sleep(300);

    let dorMarcadas = 0, dorBoxes = 0;
    for (let i = 0; i < 90; i++) {
      const scr = await active(page);
      if (scr === 'screen-radar') break;
      if (scr === 'screen-phase-result') { await page.click('#result-next-btn'); await sleep(200); continue; }
      if (scr === 'screen-horas') {
        await page.evaluate(v => document.querySelectorAll('#horas-card input').forEach((el, i) => el.value = String(v[i])), HORAS);
        await page.click('#horas-next-btn'); await sleep(600);
        continue;
      }
      if (scr === 'screen-phase') {
        const info = await page.evaluate(() => {
          var bk = phaseOrder[currentPhaseIdx]; var q = getNavQs(PQ[bk], bk)[currentQIdx];
          var subs = Array.prototype.map.call(document.querySelectorAll('#phase-card .combo-sub-code'), function(e){ return e.textContent.trim(); });
          return { bk: bk, type: q.type, code: q.code, subs: subs, dorBoxes: document.querySelectorAll('#phase-card .dor-box').length };
        });
        dorBoxes += info.dorBoxes;
        if (info.type === 'numgrid') {
          await page.evaluate(() => document.querySelectorAll('#phase-card input[id^="rg-"]').forEach(el => { el.value = '100.000'; el.dispatchEvent(new Event('input', { bubbles: true })); }));
        } else {
          const codes = info.subs.length ? info.subs : [info.code];
          for (let gi = 0; gi < codes.length; gi++) {
            const code = codes[gi];
            await page.evaluate((gi, sc) => {
              var g = document.querySelectorAll('#phase-card .options')[gi];
              var os = g ? g.querySelectorAll('.opt') : [];
              for (var k = 0; k < os.length; k++) { if (parseFloat(os[k].querySelector('.opt-dot').textContent) === sc) { os[k].click(); return; } }
            }, gi, RESP[code]);
            await sleep(60);
            if (DORES[code]) {
              await page.evaluate(c => document.getElementById('dor-' + c).querySelector('.dor-toggle').click(), code);
              await sleep(60);
              await page.type('#dor-' + code.replace('.', '\\.') + ' .dor-frase', DORES[code]);
              dorMarcadas++;
            }
          }
        }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(120);
        continue;
      }
      await sleep(200);
    }
    check('botão ★ aparece nas perguntas (inclusive nas combinadas)', dorBoxes >= 20, dorBoxes);
    check('2 dores ★ marcadas com frase', dorMarcadas === 2, dorMarcadas);

    await sleep(1200);
    await page.evaluate(() => { var m = document.getElementById('save-modal'); if (m) m.style.display = 'none'; });
    const radar = await page.evaluate(() => ({
      score: document.getElementById('total-score').textContent,
      strong: (document.getElementById('radar-strong-label') || {}).textContent,
      scores: S.scores, dores: S.dores
    }));
    console.log('Radar:', radar.score, '|', radar.strong);
    console.log('S.dores:', JSON.stringify(radar.dores));
    check('score da PCL = 21.5/57', radar.score === '21.5/57', radar.score);
    check('radar mostra Ponto forte = Pilar 2', /Ponto forte: Pilar 2/.test(radar.strong || ''), radar.strong);
    check('dores gravadas no estado com frase', radar.dores['F4.3'] && radar.dores['F4.3'].star && radar.dores['F4.3'].frase === DORES['F4.3'] && radar.dores['MO.6'] && radar.dores['MO.6'].frase === DORES['MO.6']);

    await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="revealAha(\'mid\')"]').click()); await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="showReport()"]').click()); await sleep(1200);

    const rep = await page.evaluate(() => {
      var plan = getGapPlan();
      var txt = document.getElementById('screen-report').innerText;
      var nums = Array.prototype.map.call(document.querySelectorAll('#screen-report .rep-sec-title'), function(t){ return t.innerText.replace(/\s+/g,' ').trim(); });
      return {
        total: plan.all.length, anchors: plan.anchors.map(function(o){ return o.code + ':' + o.gap + ':' + o.fonte + (o.star ? '★' : ''); }),
        rest: plan.rest.map(function(o){ return o.gap + '=' + o.prioridade; }), attention: plan.attention.length,
        titulosF1: generateOpportunities().filter(function(o){ return /^F1\./.test(o.code); }).map(function(o){ return o.code + '=' + o.gap; }),
        anchorCards: document.querySelectorAll('#screen-report .anchor-gap-card').length,
        anchorCardsDirect: document.querySelectorAll('#screen-report > div > .anchor-gap-card').length,
        execAnchors: document.getElementById('exec-anchors-card').innerText,
        execRet: document.getElementById('exec-retorno-card').innerText,
        execSnap: document.getElementById('exec-snapshot').innerText,
        gapsTile: document.getElementById('gaps-summary-stats').innerText,
        oppRows: document.querySelectorAll('#opp-body tr').length,
        attnTxt: document.getElementById('opp-attn-card').innerText,
        roiTable: document.getElementById('roi-table-el').innerText,
        chain: document.getElementById('roi-chain-card').innerText,
        plano: document.getElementById('next-steps-container').innerText,
        hasFluxo: /Fluxo Metodológico/.test(txt), hasPlaceholder: /a definir/.test(txt),
        tack: /Leonardo Aidar/.test(txt) && /Tack Empreendimentos/.test(txt),
        secs: nums
      };
    });
    console.log('Gaps: total', rep.total, '| âncoras', JSON.stringify(rep.anchors));
    console.log('Demais:', JSON.stringify(rep.rest), '| atenção', rep.attention);
    console.log('Títulos F1:', JSON.stringify(rep.titulosF1));
    console.log('Seções:', JSON.stringify(rep.secs));
    console.log('Síntese:\n' + rep.execSnap + '\n' + rep.execAnchors + '\n' + rep.execRet);
    console.log('ROI 4 passos:\n' + rep.chain);
    console.log('Plano:\n' + rep.plano);
    check('24 gaps (sem limite de 14)', rep.total === 24, rep.total);
    check('quadro mostra 24 gaps identificados', /24\s*\n?\s*Gaps identificados/i.test(rep.gapsTile), rep.gapsTile.replace(/\n/g,' | '));
    check('3 gaps-âncora: HUB★, Bloqueios★, Aditivos', rep.anchors.join(',') === 'F4.3:Performance HUB — visão integrada:time★,MO.6:Comunicação de bloqueios de pagamento:retrabalho★,MO.3:Gestão de aditivos de verba:mo', rep.anchors.join(','));
    check('cards dos âncoras são filhos diretos do relatório (paginação do PDF)', rep.anchorCards === 3 && rep.anchorCardsDirect === 3, rep.anchorCards + '/' + rep.anchorCardsDirect);
    check('tabela Gaps Identificados com os 21 pontos (10 críticos + 11 de atenção)', rep.oppRows === 21, rep.oppRows);
    check('Pontos de atenção = 11, dentro da tabela única (card antigo oculto)', rep.attention === 11 && rep.attnTxt === '', rep.attention);
    check('títulos do Pilar 1 batem com as perguntas', rep.titulosF1.indexOf('F1.7=Cronograma bancário') >= 0 && rep.titulosF1.indexOf('F1.3=Duração dos pacotes por produtividade') >= 0 && rep.titulosF1.indexOf('F1.5=Integração planejamento × suprimentos') >= 0, JSON.stringify(rep.titulosF1));
    check('Síntese com 3 KPIs (Ganho capturável)', /Ganho Capturável/i.test(rep.execSnap));
    check('Síntese cita a frase do cliente', /o custo sou eu que compilo/.test(rep.execAnchors));
    check('retorno em uma linha: 120 h → 50 h → R$ 10,25 mil → 5,1×', /120 h\/mês/.test(rep.execRet) && /50 h\/mês/.test(rep.execRet) && /R\$ 10,25 mil/.test(rep.execRet) && /5,1×/.test(rep.execRet), rep.execRet.replace(/\n/g,' '));
    check('Síntese sem caixa de próximo passo', !/Próximo passo/i.test(rep.execAnchors + rep.execRet + rep.execSnap));
    check('Perda ao Ganho com coluna Gap-âncora', /Gap-âncora/i.test(rep.roiTable) && /● Performance HUB/.test(rep.roiTable));
    check('ROI em 4 passos com confirmação', /Dado de vocês/i.test(rep.chain) && /O retorno/i.test(rep.chain) && /faz sentido desenharmos o escopo/.test(rep.chain));
    check('Plano com Resolve, O que ouvimos e Próximo passo', /Resolve: ponto crítico 1; pontos 04, 05/.test(rep.plano) && !/Gap-âncora|ato/i.test(rep.plano) && /O que ouvimos/i.test(rep.plano) && /Próximo passo/i.test(rep.plano));
    check('Fluxo Metodológico removido do corpo', !rep.hasFluxo);
    check('sem placeholder de case', !rep.hasPlaceholder);
    check('case Tack (Leonardo Aidar) no gap de retrabalho', rep.tack);
    check('numeração sequencial das seções', JSON.stringify(rep.secs.map(s => s.slice(0,2))) === JSON.stringify(['01','02','03','04','05','06','07','07'].slice(0, rep.secs.length)), JSON.stringify(rep.secs.map(s => s.slice(0,2))));

    if (WANT_PDF) {
      await page.evaluate((m, t) => { window.__PDF_MODE = m; window.__PDF_THEME = t; if (t === 'light') changeReportTheme('light'); }, MODE, process.env.THEME || 'dark');
      await sleep(800);
      const uri = await page.evaluate(async () => new Promise(resolve => {
        generatePDF(false, window.__PDF_THEME === 'light' ? 'light' : null, window.__PDF_MODE);
        const it = setInterval(() => { if (!document.getElementById('pdf-loading') && window.__LAST_PDF_DATA) { clearInterval(it); resolve(window.__LAST_PDF_DATA); } }, 300);
        setTimeout(() => { clearInterval(it); resolve(window.__LAST_PDF_DATA || null); }, 150000);
      }));
      if (uri && uri.startsWith('data:application/pdf')) {
        const b64 = uri.replace(/^data:application\/pdf;[^,]*base64,/, '');
        const target = path.join(ROOT_DIR, OUT);
        fs.writeFileSync(target, Buffer.from(b64, 'base64'));
        console.log('PDF salvo:', target);
      } else { check('PDF gerado', false); }
    }
  } catch (e) {
    console.log('ERRO:', e && e.stack || e); fails.push('exception');
  } finally {
    await browser.close(); server.close();
    console.log(fails.length ? ('\nFALHAS: ' + fails.join(' | ')) : '\nTUDO OK');
    process.exit(fails.length ? 1 : 0);
  }
});
