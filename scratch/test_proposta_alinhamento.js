// E2E da Proposta alinhada ao relatório: para cada caso (terc, pcl, ajuste, pcl2, p5, prop) preenche o
// questionário, gera o PDF do relatório e a Proposta, e confere que a proposta repete as MESMAS prioridades,
// a perda por mês e o recuperável do relatório (esperado calculado da regra, a partir das respostas), a duração do
// programa e o preço do Redesenho por tipo de MO (3 meses / R$ 45 mil terceirizada; 5 meses / R$ 75 mil própria e
// mista) e o payback sobre o investimento total com o ganho a partir do 3º mês (calculado à parte, mês a mês).
// Escritas no Supabase e chamadas de IA bloqueadas. Uso: node scratch/test_proposta_alinhamento.js  (CASES=terc,pcl para filtrar)
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const CASES = require('./casos_prancha.js');

const BASE_DIR = path.resolve(__dirname, '..');
const PORT = 8351;
const LISTA = (process.env.CASES || 'terc,pcl,ajuste,pcl2,p5,prop').split(',');
const PRECO_MES = 15000;   // Redesenho: R$ 15 mil por mês de programa

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
  const perda = { time: horasRec * 115 * prazo, retrabalho: orc * 0.10, velocidade: orc * 0.10 * 0.15, erros: orc * 0.45 * 0.05 };
  const red = { time: 1, retrabalho: 0.40, velocidade: 1, erros: 1, mo: 0.70 };
  if (mo === 'propria') perda.mo = orc * 0.45 * 0.15; else if (mo === 'mista') perda.mo = orc * 0.45 * 0.50 * 0.15;
  const fontes = Object.keys(perda), P = {}, G = {};
  fontes.forEach(k => { P[k] = Math.round(perda[k]); G[k] = Math.round(perda[k] * red[k] * fator[k]); });
  const somaP = fontes.reduce((a, k) => a + P[k], 0), somaG = fontes.reduce((a, k) => a + G[k], 0);
  const top3 = Cc.prioFontes || fontes.slice().sort((a, b) => P[b] - P[a]).slice(0, 3);   // 1 prioridade por fonte, das 3 mais caras (ou as fontes após a retirada)
  return { prazo, obras, fator, P, G, somaP, somaG, perdaMes: somaP / prazo, ganhoMes: somaG / prazo, capEf: somaG / somaP,
    critPerda: top3.reduce((a, k) => a + P[k], 0), critMes: top3.reduce((a, k) => a + P[k], 0) / prazo, critCapMes: top3.reduce((a, k) => a + G[k], 0) / prazo, top3 };
}

const norm = t => String(t).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
const moeda = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(BASE_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else { res.writeHead(404); res.end('Not found'); }
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const active = page => page.evaluate(() => { var el = document.querySelector('.screen.active'); return el ? el.id : null; });

// Payback calculado à parte (não usa propPayback): investimento mês a mês x ganho acumulado.
function paybackEsperado(cfg, ganhoMes, prazo, meses, inicio) {
  let inv = 0, ganho = 0;
  for (let m = 1; m <= prazo; m++) {
    if (m <= meses) inv += (PRECO_MES * meses) / meses;                // Redesenho em parcelas iguais (De = 15 mil × meses)
    if (m === 1) inv += cfg.ativPor;                                   // Ativação no mês 1
    if (m > meses) inv += cfg.mensalPor * cfg.nObras;                  // plataforma depois do programa
    if (m >= inicio) ganho += ganhoMes;
    if (ganho >= inv) return { mes: m, inv, ganho };
  }
  return { mes: null };
}

server.listen(PORT, async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const fails = [];
  const check = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  -> ' + detail : '')); if (!ok) fails.push(name); };
  try {
    for (const nome of LISTA) {
      const C = CASES[nome]; const MO = C.b0.modeloMO; const EXP = esperado(C);
      console.log('\n=== caso ' + nome + ' (' + MO + ') ===');
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', r => ((r.url().includes('supabase.co') && r.method() !== 'GET' && r.method() !== 'OPTIONS') || r.url().includes('anthropic')) ? r.abort() : r.continue());
      page.on('pageerror', err => { console.log('PAGE ERROR:', err.message); fails.push(nome + ' pageerror: ' + err.message); });
      page.on('dialog', d => d.dismiss());
      await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
      await page.goto('http://localhost:' + PORT + '/index.html', { waitUntil: 'networkidle0' });
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.type('#c-empresa', C.empresa); await page.type('#c-contato', C.contato);
      await page.evaluate(v => { document.getElementById('c-cargo').value = v; }, C.cargo);
      await page.type('#c-consultor', C.consultor); await page.type('#c-email', 'contato@empresa-exemplo.com.br'); await page.type('#c-telefone', '(11) 90000-0000');
      await page.click('button[onclick="startAssessment()"]'); await sleep(300);
      await page.click('#btn-diagnostico-continuar'); await sleep(300); await page.click('#btn-metodo-continuar'); await sleep(250); await page.click('#btn-portfolio-continuar'); await sleep(250); await page.click('#btn-premios-iniciar'); await sleep(300);
      for (let i = 0; i < 30; i++) {
        if (await active(page) !== 'screen-b0') break;
        const q = await page.evaluate(() => { var q = B0Q[currentQIdx]; return { type: q.type, key: q.key, opts: (q.opts || []).map(o => o.v) }; });
        if (q.type === 'roi') {
          await page.evaluate(c => { document.getElementById('roi-obras').value = c.obras; document.getElementById('roi-prazo').value = c.prazo; var o = document.getElementById('roi-orcamento'); o.value = c.orcamento; o.dispatchEvent(new Event('input', { bubbles: true })); }, C);
        } else if (q.type === 'ferramentas') {
          await page.evaluate(c => { Object.keys(c.ferr).forEach(k => { var el = document.getElementById('ferr-' + k); if (el) el.value = c.ferr[k]; }); var e = document.getElementById('ferr-erp'); if (e && c.erp) { e.value = c.erp; e.dispatchEvent(new Event('change', { bubbles: true })); } }, C);
        } else {
          const idx = Math.max(0, q.opts.indexOf(C.b0[q.key])); const opts = await page.$$('#b0-card .opt'); if (opts.length) await opts[idx].click();
        }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(120);
      }
      await sleep(300);
      await page.evaluate(() => document.querySelector('#focus-all .focus-card-header').click()); await sleep(200);
      await page.evaluate(() => document.getElementById('btn-start-diagnosis').click()); await sleep(300);
      for (let i = 0; i < 90; i++) {
        const scr = await active(page);
        if (scr === 'screen-radar' || scr === 'screen-confirmacao') break;
        if (scr === 'screen-phase-result') { await page.click('#result-next-btn'); await sleep(200); continue; }
        if (scr === 'screen-horas') { await page.evaluate(v => document.querySelectorAll('#horas-card input').forEach((el, i) => el.value = v ? String(v[i]) : ''), C.horas); await page.click('#horas-next-btn'); await sleep(600); continue; }
        if (scr === 'screen-phase') {
          const info = await page.evaluate(() => { var bk = phaseOrder[currentPhaseIdx]; var q = getNavQs(PQ[bk], bk)[currentQIdx]; var subs = Array.prototype.map.call(document.querySelectorAll('#phase-card .combo-sub-code'), e => e.textContent.trim()); return { type: q.type, code: q.code, subs: subs }; });
          if (info.type === 'numgrid') {
            await page.evaluate(v => document.querySelectorAll('#phase-card input[id^="rg-"]').forEach(el => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }), C.folha || '0');
          } else {
            const codes = info.subs.length ? info.subs : [info.code];
            for (let gi = 0; gi < codes.length; gi++) {
              const code = codes[gi]; const sc = C.resp[code] !== undefined ? C.resp[code] : 1;
              await page.evaluate((gi, sc) => { var g = document.querySelectorAll('#phase-card .options')[gi]; var os = g ? g.querySelectorAll('.opt') : []; for (var k = 0; k < os.length; k++) { if (parseFloat(os[k].querySelector('.opt-dot').textContent) === sc) { os[k].click(); return; } } }, gi, sc);
              await sleep(60);
              if (C.dores[code]) { await page.evaluate(c => document.getElementById('dor-' + c).querySelector('.dor-toggle').click(), code); await sleep(60); await page.type('#dor-' + code.replace('.', '\\.') + ' .dor-frase', C.dores[code]); }
            }
          }
          await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(120); continue;
        }
        await sleep(200);
      }
      await page.click('#btn-conf-resultados'); await sleep(900);
      if (C.ajustes) await page.evaluate(aj => { S.prioAjustes = aj; }, C.ajustes);   // Conferência: o vendedor retirou o MO.3
      await sleep(800);
      await page.evaluate(() => { var m = document.getElementById('save-modal'); if (m) m.style.display = 'none'; });
      await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click()); await sleep(400);
      await page.evaluate(() => document.querySelector('button[onclick="revealAha(\u0027mid\u0027)"]').click()); await sleep(400);
      await page.evaluate(() => document.querySelector('#screen-aha button[onclick="showReport()"]').click()); await sleep(1200);

      // Relatório (resumido): DOM do PDF
      await page.evaluate(async () => new Promise(resolve => {
        window.__PT_KEEP_DOM = true; window.__LAST_PDF_DATA = null; generatePDF(false, 'dark', 'resumido');
        const it = setInterval(() => { if (!document.getElementById('pdf-loading') && window.__LAST_PDF_DATA) { clearInterval(it); resolve(); } }, 300);
        setTimeout(() => { clearInterval(it); resolve(); }, 180000);
      }));
      const rel = norm(await page.evaluate(() => { var r = document.getElementById('ptr-root'); return r ? r.innerText : ''; }));
      const M = await page.evaluate(() => { var m = ptModel('resumido'); return { crit: m.criticos.map(c => ({ n: c.n, code: c.code, titulo: c.titulo, pilar: c.pilar, frase: c.frase, mes: c.mes, fonte: c.fonte.label, alerta: c.alerta, fase: c.fase })), demais: m.demais.length, fontesLabels: m.roi.items.map(i => m.fontes[i.key].label) }; });
      // Proposta
      const P = await page.evaluate(async () => {
        window.__LAST_PROPOSTA_PDF_DATA = null; generateProposta('detalhado');
        await new Promise(resolve => { const it = setInterval(() => { if (!document.getElementById('pdf-loading') && window.__LAST_PROPOSTA_PDF_DATA) { clearInterval(it); resolve(); } }, 250); setTimeout(() => { clearInterval(it); resolve(); }, 120000); });
        return { txt: document.getElementById('screen-proposta').innerText, cfg: getPropostaCfg() };
      });
      const txt = norm(P.txt), cfg = P.cfg, lo = txt.toLowerCase();   // rótulos de KPI e títulos saem em maiúsculas no innerText
      const tem = x => lo.indexOf(x.toLowerCase()) >= 0;

      // ── prioridades iguais às do relatório ──
      const esperaN = { terc: 3, pcl: 3, ajuste: 3, pcl2: 4, p5: 5, prop: 3 }[nome];
      check('prioridades: ' + esperaN + ' no relatório e na proposta', M.crit.length === esperaN && (txt.match(/Prioridade \d/g) || []).length >= esperaN, M.crit.length);
      if (nome === 'ajuste') check('ajuste: prioridades = MO.6, F4.3, F4.4 (MO.3 retirado) e a proposta não traz o título do MO.3', M.crit.map(c => c.code).join(',') === 'MO.6,F4.3,F4.4' && txt.indexOf('Implantação da gestão de aditivos de verba') < 0, M.crit.map(c => c.code).join(','));
      let ordem = -1, okOrd = true;
      M.crit.forEach(c => {
        const ir = rel.indexOf(c.titulo), ip = txt.indexOf(c.titulo);
        check('prioridade ' + c.n + ' (' + c.code + ') "' + c.titulo + '" no relatório e na proposta', ir >= 0 && ip >= 0);
        if (ip <= ordem) okOrd = false; ordem = ip;
        check('prioridade ' + c.n + ': pilar e fonte "' + c.pilar + ' · ' + c.fonte + '"', txt.indexOf(c.pilar + ' · ' + c.fonte) >= 0);
        if (c.frase) check('prioridade ' + c.n + ': frase do cliente entre aspas', txt.indexOf('“' + c.frase.replace(/\.$/, '') + '.”') >= 0 && rel.indexOf(c.frase.replace(/\.$/, '')) >= 0);
        if (c.mes != null) check('prioridade ' + c.n + ': perda por mês ' + fMil(c.mes) + ' igual no relatório e na proposta', txt.indexOf('Perda por mês sem tratamento: ' + fMil(c.mes)) >= 0 && rel.indexOf(fMil(c.mes)) >= 0);
      });
      check('prioridades na mesma ordem do relatório', okOrd);
      const fontesDist = new Set(M.crit.map(c => c.fonte)).size;
      check('perda por mês só na 1ª prioridade de cada fonte (' + fontesDist + ')', (txt.match(/Perda por mês sem tratamento:/g) || []).length === fontesDist);
      check('etiquetas Crítico / Em alerta conforme a nota (' + M.crit.filter(c => c.alerta).length + ' em alerta)', (txt.match(/Em alerta Prioridade/gi) || []).length === M.crit.filter(c => c.alerta).length);
      check('"Demais pontos críticos do diagnóstico: ' + M.demais + '"', M.demais === 0 || txt.indexOf('Demais pontos críticos do diagnóstico: ' + M.demais) >= 0, M.demais);
      check('composição da exposição com os nomes de fonte do relatório', M.fontesLabels.every(l => txt.indexOf(l) >= 0), M.fontesLabels.join(' | '));

      // ── seção 01: Score, Perda por mês, Recuperável ──
      const obras = +C.obras;
      check('01: perda por mês ' + fMil(EXP.perdaMes) + ' igual ao relatório', tem('Perda por mês ' + fMil(EXP.perdaMes)) && rel.indexOf(fMil(EXP.perdaMes)) >= 0);
      if (obras > 1) check('01: perda por mês no portfólio (' + obras + ' obras) ' + fMil(EXP.perdaMes * obras), txt.indexOf(fMil(EXP.perdaMes * obras) + ' no portfólio de ' + obras + ' obras') >= 0 && rel.indexOf(fMil(EXP.perdaMes * obras)) >= 0);
      if (['terc', 'pcl', 'ajuste', 'prop'].indexOf(nome) >= 0) {
        check('01: recuperável com o plano ' + fMil(EXP.critCapMes) + '/mês igual ao relatório', tem('Recuperável com o plano ' + fMil(EXP.critCapMes) + '/mês') && rel.indexOf(fMil(EXP.critCapMes) + '/mês') >= 0);
      }
      check('01: sem "Payback Projetado" no recap', !/Payback Projetado/i.test(txt));
      ['Planejamento estratégico do fluxo de produção', 'Proteção e garantia da execução do plano', 'Gestão integrada da produção', 'Controle real e performance da produção'].forEach((n, i) => check('01: "Pilar ' + (i + 1) + ' · ' + n + '"', txt.indexOf('Pilar ' + (i + 1) + ' · ' + n) >= 0));

      // ── duração e preço do programa por tipo de MO ──
      const meses = MO === 'terceirizada' ? 3 : 5, deEsp = PRECO_MES * meses;
      check('programa de ' + meses + ' meses (cfg) e Redesenho de ' + moeda(deEsp) + ' (De = Por)', cfg.progMeses === meses && cfg.progDe === deEsp && cfg.progPor === deEsp, cfg.progMeses + ' / ' + cfg.progDe);
      check('texto: "programa de ' + meses + ' meses", "Mês ' + meses + ' — Análise e resultados", Redesenho "× ' + meses + ' meses" e termos', txt.indexOf('programa de ' + meses + ' meses') >= 0 && txt.indexOf('Mês ' + meses + ' — Análise e resultados') >= 0 && txt.indexOf('R$ 15.000/mês × ' + meses + ' meses') >= 0 && txt.indexOf('R$ 15.000/mês · ' + meses + ' meses') >= 0 && txt.indexOf(moeda(deEsp)) >= 0);
      const outros = MO === 'terceirizada' ? [4, 5] : [3, 4];
      check('texto sem a duração de outro tipo de MO', outros.every(n => txt.indexOf('em ' + n + ' meses') < 0 && txt.indexOf('nos ' + n + ' meses') < 0 && txt.indexOf('programa de ' + n + ' meses') < 0));
      // Fases de Implementação I, II e III, com a Fase III do tipo de MO
      check('04: Fases de Implementação I, II e III com os nomes e prazos do relatório', ['Fase de Implementação I', 'Planejamento e Controle Integrado com o Canteiro', 'Fase de Implementação II', 'Integração com o ERP e o Sistema de Qualidade', 'Fase de Implementação III', 'Controle de Pagamento da Mão de Obra Integrado', 'Até 60 dias', 'A partir do dia 60'].every(s => txt.indexOf(s) >= 0));
      const temEmp = MO !== 'propria', temFolha = MO !== 'terceirizada';
      check('04: Fase III ' + (temEmp ? 'com Controle de Empreiteiros em 30 dias' : 'sem Controle de Empreiteiros') + ' e ' + (temFolha ? 'com Folha de Produção em 90 dias' : 'sem Folha de Produção'), (txt.indexOf('Controle de Empreiteiros em 30 dias') >= 0) === temEmp && (txt.indexOf('Folha de Produção em 90 dias') >= 0) === temFolha);
      ['I', 'II', 'III'].forEach(f => {
        const ns = M.crit.filter(c => c.fase.charAt(0) === f && c.fase.charAt(1) !== 'I' || (c.fase === f)).map(c => c.n);
        const esp = ns.length ? (ns.length === 1 ? 'Prioridade ' + ns[0] : 'Prioridades ' + ns.slice(0, -1).join(', ') + ' e ' + ns[ns.length - 1]) : null;
        const ini = txt.indexOf('Fase de Implementação ' + f + ' '), fim = f === 'III' ? txt.indexOf('Construção · ~75%') : txt.indexOf('Fase de Implementação ' + (f === 'I' ? 'II' : 'III') + ' ');
        const bloco = txt.slice(ini, fim);
        check('04: Fase ' + f + (esp ? ' liga "' + esp + '"' : ' sem prioridade, sem linha de prioridades e sem "Nenhuma"'), esp ? bloco.indexOf(esp) >= 0 : !/Prioridades? \d/.test(bloco) && bloco.indexOf('Nenhuma') < 0, bloco.slice(-60));
      });
      check('04: sem linha de continuidade do Customer Success', txt.indexOf('segue com o Customer Success') < 0);
      check('06: título "Governança, Ritos e Time" e papel do Customer Success nos ' + meses + ' meses', tem('Governança, Ritos e Time') && txt.indexOf('programa nos ' + meses + ' meses') >= 0);
      check('03: baseline na "Fase de Implementação I" e dias de fechamento do tipo de MO', txt.indexOf('baseline real medida na Fase de Implementação I') >= 0 && txt.indexOf('dias de fechamento da ' + (MO === 'terceirizada' ? 'medição' : (MO === 'propria' ? 'folha' : 'medição e da folha'))) >= 0);
      check('11: "inicia a Fase de Implementação I"', txt.indexOf('inicia a Fase de Implementação I na semana') >= 0);
      check('03: sem a promessa de benchmark do setor', !/benchmark do setor/i.test(txt));

      // ── seção 10: payback sobre o investimento total, ganho a partir do mês 3 (esperado calculado à parte) ──
      const prazo = +C.prazo, ganhoMes = EXP.somaG / prazo * cfg.nObras;
      const pb = paybackEsperado(cfg, ganhoMes, prazo, meses, 3);
      const kpi = ((lo.match(/payback (sem payback|\d+ meses?)/) || [])[1] || '').toLowerCase();
      check('10: payback esperado ' + (pb.mes ? pb.mes + ' meses' : 'sem payback') + ' (investimento ' + (pb.mes ? moeda(pb.inv) : '-') + ', ganho mensal ' + moeda(ganhoMes) + ')', pb.mes ? kpi === pb.mes + (pb.mes === 1 ? ' mês' : ' meses') : kpi === 'sem payback', kpi);
      if (pb.mes) check('10: investimento total até o payback ' + moeda(pb.inv) + ' e ganho acumulado ' + moeda(pb.ganho) + ' na tela', tem(moeda(pb.inv)) && tem(moeda(pb.ganho)));
      const paga = pb.mes && pb.mes > meses;
      check('10: plataforma entra a partir do mês ' + (meses + 1) + (paga ? ' e aparece no investimento, por obra' : ' (payback dentro do programa: sem plataforma)'), paga ? txt.indexOf('mensalidade') >= 0 && txt.indexOf('por obra, para ' + cfg.nObras + ' obra') >= 0 : txt.indexOf('plataforma R$') < 0);
      check('10: premissa "a partir do 3º mês" e ganho no período da obra (' + (prazo - 2) + ' meses)', txt.indexOf('Ganho no período da obra, a partir do 3º mês') >= 0 && txt.indexOf('(' + (prazo - 2) + ' meses)') >= 0);
      check('10: "Captura efetiva (redução com o SIIGA × fator de maturidade, 20% a 70%)" com ' + fPct(EXP.capEf), txt.indexOf('Captura efetiva (redução com o SIIGA × fator de maturidade, 20% a 70%) ' + fPct(EXP.capEf)) >= 0);
      check('10: exposição com o nº de obras da proposta (' + cfg.nObras + ')', tem('Exposição em Risco ' + fTela(EXP.somaP * cfg.nObras)), fTela(EXP.somaP * cfg.nObras));
      check('10: sem "Fator de captura (pela maturidade atual)"', txt.indexOf('Fator de captura (pela maturidade atual)') < 0);

      // ── textos proibidos ──
      [['ROI Mensal', /ROI Mensal/i], ['% da jornada', /% da jornada/i], ['Horas recuperadas', /Horas recuperadas/i], ['Pilar macro/tático/operacional', /Pilar (macro|tático|operacional)/i],
       ['Fase 1', /Fase 1\b/], ['Jornada', /jornada/i], ['gap', /\bgaps?\b/i], ['OPORTUNIDADE', /OPORTUNIDADE/i], ['capacidade de gestão liberada', /capacidade de gestão liberada/i]]
        .forEach(([n, re]) => check('sem "' + n + '"', !re.test(txt), (txt.match(re) || [''])[0]));
      check('depoimento do Claudio Barreira (Dasart) mantido', txt.indexOf('Claudio Barreira') >= 0 && txt.indexOf('Dasart') >= 0);
      await page.close();
    }
  } catch (e) { console.error('ERROR', e); fails.push('exception: ' + e.message); }
  console.log(fails.length ? ('\n' + fails.length + ' FALHA(S): ' + fails.join('; ')) : '\nTODOS OS CHECKS PASSARAM');
  await browser.close(); server.close(); process.exit(fails.length ? 1 : 0);
});
