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
const C = CASES[CASE];
const MO = C.b0.modeloMO;
const avisos = {}; // code -> warning visible after the star (score 3 only)
let telaF44 = ''; // questionnaire card text where F4.4 is asked
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
    await page.click('#btn-diagnostico-continuar'); await sleep(300); await page.click('#btn-pilares-continuar'); await sleep(300); await page.click('#btn-metodo-iniciar');
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
      if (scr === 'screen-radar') break;
      if (scr === 'screen-phase-result') { await page.click('#result-next-btn'); await sleep(200); continue; }
      if (scr === 'screen-horas') {
        telaHoras = await page.evaluate(() => document.getElementById('horas-card').innerText);
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
    if (process.env.DUMP_PONTOS) {
      // Points model (critical + others): n, code, phase, priority, for before/after comparison
      const pts = await page.evaluate(() => { const M = ptModel('detalhado'); return M.criticos.concat(M.demais).map(p => [p.n, p.code, p.fase, p.prioridade].join('|')); });
      fs.writeFileSync(process.env.DUMP_PONTOS, pts.join(String.fromCharCode(10)));
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
    check('folha 03: perda total, perda capturada, ganho mensal e × mensalidade, sem notas', /Perda total por mês/i.test(dom.pages[2] || '') && /Perda capturada/i.test(dom.pages[2] || '') && /Ganho mensal/i.test(dom.pages[2] || '') && /× mensalidade ref\./i.test(dom.pages[2] || '') && !/Contexto:|não se somam|Unidade:|Fonte:/.test(dom.pages[2] || ''));
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
      const mm = p3.match(/Perda total por mês\s*R\$ ([\d.,]+) mil/i);
      const k = u => u === 'mi' ? 1000 : 1;
      const t2 = m2 && num(m2[1]) * k(m2[2]);
      // Sheet 02 total (rounded in the lead) = monthly loss of sheet 03 × term
      check('total da folha 02 = perda/mês da folha 03 × prazo', !!(m2 && mm) && Math.abs(num(mm[1]) * +m2[3] - t2) <= (m2[2] === 'mi' ? 50 : 1),
        JSON.stringify({ folha02: m2 && m2.slice(1), mes: mm && mm[1] }));
      check('folha 02: linha "Recuperável com o plano" com × mensalidade ref.', /Recuperável com o plano · [\d,]+× mensalidade ref\./.test(p2));
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
       '“A gente paga o empreiteiro e depois descobre o retrabalho.”', 'Outros 10 pontos estão em alerta', 'Resolve: prioridade 4; pontos críticos 07 e 10.'].forEach(s => check('PCL ★ contém "' + s + '"', all.indexOf(s) >= 0));
      check('★ em nota 3 (F2.1) fora do relatório', !/corre atrás de material/i.test(all));
      // Option B: section 04 starts on the sheet of the 4th priority, so the sheet count stays the same
      check('seção 04 na mesma folha da Prioridade 4', /PRIORIDADE 4/.test(dom.pages[4] || '') && /DEMAIS PONTOS CRÍTICOS/.test(dom.pages[4] || ''));
      check('PCL ★ folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
    } else if (CASE === 'pcl') {
      ['21,5', 'R$ 526 mil', 'R$ 395 mil', 'R$ 11,5 mil', 'R$ 9,3 mil', 'R$ 5,5 mil', 'R$ 26,3 mil/mês', 'R$ 19,0 mil/mês', '9,5× mensalidade ref.', 'R$ 25,0 mil', '71%', '12,5×',
       'R$ 35,1 mil', 'R$ 8,7 mil', 'R$ 6,4 mil', 'R$ 2,1 mil', 'R$ 4,0 mil', 'R$ 3,8 mil',
       'Digitalização do painel integrado de indicadores', 'Digitalização da comunicação de bloqueios de pagamento', 'Implantação da gestão de aditivos de verba',
       'Plano de Transformação Operacional para a Construtora PCL', 'Pilar 3, Gestão integrada da produção', 'Resolve: prioridade 1; pontos críticos 04, 05, 07, 10, 11, 12 e 13; 6 pontos em alerta.',
       'Resolve: pontos críticos 06 e 09; 1 ponto em alerta.', 'Resolve: prioridades 2 e 3; ponto crítico 08; 4 pontos em alerta.', 'Por fonte de perda · 10 pontos críticos',
       'Outros 11 pontos estão em alerta', '3 de 13 pontos críticos', 'Total das 3 prioridades', 'mesma fonte da Prioridade 1'].forEach(s => check('PCL contém "' + s + '"', allLow.indexOf(s.toLowerCase()) >= 0));
      // Hours+payroll model only in the Detalhado annex (A.4); 15-month source values only in the annex
      ['R$ 172,5 mil', 'R$ 140,0 mil', 'R$ 82,7 mil', 'R$ 526,4 mil', 'R$ 20,5 mil', 'R$ 10,25 mil', '5,1×', '3,1×', 'R$ 6,15 mil', 'R$ 52,5 mil', 'R$ 78,8 mil', 'R$ 375,3 mil'].forEach(s => check('PCL ' + (MODE === 'resumido' ? 'sem' : 'com (Anexo)') + ' "' + s + '"', (allLow.indexOf(s.toLowerCase()) >= 0) === (MODE !== 'resumido')));
      check('PCL sem "custa R$ 26 mil" e sem bloco horas+folha no resumo', !/custa R\$ 26 mil/.test(all) && !/Perda em horas de gestão e folha/i.test(all));
      check('PCL folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
    } else if (CASE === 'prop') {
      // Own labor: payroll lines stay (Annex A.4 in the Detalhado), no contractors front
      check('própria: "MO própria" no escopo', /MO própria/.test(all));
      check('própria folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
      if (MODE !== 'resumido') check('própria: Anexo com retrabalho pago na folha', /Retrabalho pago na folha/.test(all));
    } else {
      check('título sem artigo: "para Horizonte Engenharia"', allLow.indexOf('plano de transformação operacional para horizonte engenharia') >= 0);
      check('sem linhas de folha própria (terceirizada)', !/Retrabalho pago na folha/.test(all));
      check('ERP "Não utiliza ERP"', /Não utiliza ERP/.test(all));
      check('prazo 24 meses', /24 meses/.test(all));
      check('terceirizada folhas = ' + EXP_FOLHAS, dom.pages.length === EXP_FOLHAS, dom.pages.length);
      ['Resolve: prioridade 2; pontos críticos 04, 05, 06, 07, 09, 10, 11 e 12; 5 pontos em alerta.', 'Resolve: pontos críticos 08 e 13; 1 ponto em alerta.', 'Resolve: prioridades 1 e 3; 1 ponto em alerta.', 'Por fonte de perda · 10 pontos críticos', 'Outros 7 pontos estão em alerta', 'R$ 52,9 mil', 'R$ 39,1 mil', '19,5×', 'R$ 33,5 mil/mês', '16,8× mensalidade ref.', 'Total no portfólio (3 obras)'].forEach(s => check('terceirizada contém "' + s + '"', allLow.indexOf(s.toLowerCase()) >= 0));
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
