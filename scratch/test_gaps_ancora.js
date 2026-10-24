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
const G2DIR = process.env.G2DIR || path.join(__dirname, 'shots_g2');
fs.mkdirSync(G2DIR, { recursive: true });

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
    await sleep(300); await page.click('#btn-diagnostico-continuar');  await sleep(300); await page.click('#btn-metodo-iniciar');
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
    await page.evaluate(() => (showConfirmacao(), document.getElementById('btn-conf-relatorio').click())); await sleep(1200);

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
        oppRows: Array.prototype.filter.call(document.querySelectorAll('#opp-body tr'), function(tr){ return tr.children.length === 5; }).length,
        oppCard: document.getElementById('opp-table-card').innerText,
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
    check('quadro mostra 13 pontos críticos', /13\s*\n?\s*Pontos críticos/i.test(rep.gapsTile), rep.gapsTile.replace(/\n/g,' | '));
    check('3 gaps-âncora: HUB★, Bloqueios★, Aditivos', rep.anchors.join(',') === 'F4.3:Performance HUB — visão integrada:time★,MO.6:Comunicação de bloqueios de pagamento:retrabalho★,MO.3:Gestão de aditivos de verba:mo', rep.anchors.join(','));
    check('cards dos âncoras são filhos diretos do relatório (paginação do PDF)', rep.anchorCards === 3 && rep.anchorCardsDirect === 3, rep.anchorCards + '/' + rep.anchorCardsDirect);
    check('tabela Gaps Identificados só com os 10 demais críticos, e os 11 em alerta só contados', rep.oppRows === 10 && /Outros 11 pontos estão em alerta/.test(rep.oppCard), rep.oppRows);
    check('Pontos de atenção = 11, dentro da tabela única (card antigo oculto)', rep.attention === 11 && rep.attnTxt === '', rep.attention);
    check('títulos do Pilar 1 batem com as perguntas', rep.titulosF1.indexOf('F1.7=Cronograma bancário') >= 0 && rep.titulosF1.indexOf('F1.3=Duração dos pacotes por produtividade') >= 0 && rep.titulosF1.indexOf('F1.5=Integração planejamento × suprimentos') >= 0, JSON.stringify(rep.titulosF1));
    check('Síntese com 3 KPIs (Ganho capturável)', /Ganho Capturável/i.test(rep.execSnap));
    check('Síntese cita a frase do cliente', /o custo sou eu que compilo/.test(rep.execAnchors));
    check('retorno em uma linha: 120 h → 50 h → R$ 10,25 mil → 5,1×', /120 h\/mês/.test(rep.execRet) && /50 h\/mês/.test(rep.execRet) && /R\$ 10,25 mil/.test(rep.execRet) && /5,1×/.test(rep.execRet), rep.execRet.replace(/\n/g,' '));
    check('Síntese sem caixa de próximo passo', !/Próximo passo/i.test(rep.execAnchors + rep.execRet + rep.execSnap));
    check('Perda ao Ganho com coluna Prioridade', /Prioridade/i.test(rep.roiTable) && !/Gap-âncora/i.test(rep.roiTable) && /● Performance HUB/.test(rep.roiTable));
    check('ROI em 4 passos com confirmação', /Dado de vocês/i.test(rep.chain) && /O retorno/i.test(rep.chain) && /faz sentido desenharmos o escopo/.test(rep.chain));
    check('Plano com Resolve, O que ouvimos e Próximo passo', /Resolve: prioridade 1; pontos críticos 04, 05/.test(rep.plano) && !/Gap-âncora|ato/i.test(rep.plano) && /O que ouvimos/i.test(rep.plano) && /Próximo passo/i.test(rep.plano));
    check('Fluxo Metodológico removido do corpo', !rep.hasFluxo);
    check('sem placeholder de case', !rep.hasPlaceholder);
    check('case Tack (Leonardo Aidar) no gap de retrabalho', rep.tack);
    check('numeração sequencial das seções', JSON.stringify(rep.secs.map(s => s.slice(0,2))) === JSON.stringify(['01','02','03','04','05','06','07','07'].slice(0, rep.secs.length)), JSON.stringify(rep.secs.map(s => s.slice(0,2))));

    // ── Ajustes do vendedor (S.prioAjustes) e tela de Conferência ──
    const AJ = async (aj, dores) => page.evaluate((aj, dores) => {
      S.prioAjustes = aj;
      var salvo = JSON.parse(JSON.stringify(S.dores));
      Object.keys(dores || {}).forEach(function(c){ S.dores[c] = { star: true, frase: dores[c] }; });
      var p = getGapPlan();
      var r = { anchors: p.anchors.map(function(o){ return o.code + ':' + o.prioTipo + (o.travado ? '!' : ''); }), rest: p.rest.map(function(o){ return o.code + (o.retirado ? '*' : ''); }), att: p.attention.map(function(o){ return o.code + (o.retirado ? '*' : ''); }),
        total: calculateROI().totalBase };
      S.dores = salvo;
      return r;
    }, aj, dores);
    const base0 = await AJ({}, {});
    check('sem ajustes: prioridades iguais às de antes (F4.3, MO.6, MO.3)', base0.anchors.join(',') === 'F4.3:fin,MO.6:fin,MO.3:fin', base0.anchors.join(','));
    const nulo = await AJ({ travados: [], excluidos: [] }, {});
    check('ajustes vazios = sem ajustes', JSON.stringify(nulo) === JSON.stringify(base0));
    const ret3 = await AJ({ travados: [], excluidos: ['MO.3'] }, {});
    check('retirar a nº 3 (Estouro de MO): a vaga vai para a PRÓXIMA FONTE (Erros de medição e folha: F4.4), não para MO.2', ret3.anchors.join(',') === 'F4.3:fin,MO.6:fin,F4.4:fin', ret3.anchors.join(','));
    check('retirado volta para o rest com a marca', ret3.rest.indexOf('MO.3*') >= 0, ret3.rest.join(','));
    const retAlerta = await AJ({ travados: [], excluidos: ['F3.4'] }, { 'F3.4': 'qualidade só no fechamento' });
    check('★ em alerta retirada volta para attention (1,5), com a marca', retAlerta.att.indexOf('F3.4*') >= 0 && retAlerta.anchors.indexOf('F3.4:extra') < 0, retAlerta.anchors.join(',') + ' | ' + retAlerta.att.join(','));
    const comAlerta = await AJ({}, { 'F3.4': 'qualidade só no fechamento' });
    check('★ em alerta entra como extra (nº 4) sem ajustes', comAlerta.anchors.join(',') === 'F4.3:fin,MO.6:fin,MO.3:fin,F3.4:extra', comAlerta.anchors.join(','));
    const prom = await AJ({ travados: [{ code: 'F4.1', tipo: 'extra' }], excluidos: [] }, {});
    check('promovido ocupa vaga extra (4) e não conta como financeiro', prom.anchors.join(',') === 'F4.3:fin,MO.6:fin,MO.3:fin,F4.1:extra!', prom.anchors.join(','));
    const prom2 = await AJ({ travados: [{ code: 'F4.1', tipo: 'extra' }, { code: 'F1.7', tipo: 'extra' }, { code: 'F3.2', tipo: 'extra' }], excluidos: [] }, {});
    check('teto 5: o 3º promovido não entra', prom2.anchors.length === 5 && prom2.anchors.indexOf('F3.2:extra!') < 0, prom2.anchors.join(','));
    const seis = await AJ({ travados: [], excluidos: [] }, { 'F3.2': 'a', 'F4.1': 'b', 'F4.2': 'c' });
    check('6ª ★ (3 ★ extras) substitui a financeira não travada e sem ★ da fonte mais barata (MO.3), teto 5', seis.anchors.length === 5 && seis.anchors.join(',').indexOf('MO.3') < 0 && seis.anchors.filter(a => /:extra/.test(a)).length === 3, seis.anchors.join(','));
    const trav6 = await AJ({ travados: [{ code: 'MO.3', tipo: 'fin' }], excluidos: [] }, { 'F3.2': 'a', 'F4.1': 'b', 'F4.2': 'c' });
    check('travado sobrevive a 6 ★ e o teto continua 5', trav6.anchors.length === 5 && trav6.anchors.indexOf('MO.3:fin!') >= 0, trav6.anchors.join(','));
    const tr3 = await AJ({ travados: [{ code: 'F4.1', tipo: 'fin' }], excluidos: [] }, {});
    check('travado fin cobre a sua fonte (F4.1 = fonte time): F4.3 não duplica a vaga', tr3.anchors.join(',') === 'F4.1:fin!,MO.6:fin,MO.3:fin,F4.3:extra', tr3.anchors.join(','));
    check('perda total do ROI não muda com nenhum ajuste', [ret3, prom, prom2, seis, trav6, tr3].every(r => r.total === base0.total));

    // Tela de Conferência (cliques reais)
    await page.evaluate(() => { S.prioAjustes = { travados: [], excluidos: [] }; showConfirmacao(); }); await sleep(300);
    check('Conferência ativa, com aviso de uso interno', await active(page) === 'screen-confirmacao' && /Uso interno: não é mostrada ao cliente/.test(await page.$eval('#screen-confirmacao', e => e.innerText)));
    check('3 prioridades na Conferência e botões Travar / Tirar', await page.evaluate(() => document.querySelectorAll('#conf-body .conf-card').length === 3 && document.querySelectorAll('#conf-body [data-acao="travar"]').length === 3 && document.querySelectorAll('#conf-body [data-acao="tirar"]').length === 3));
    const perdas = await page.$$eval('#conf-body .conf-meta', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
    check('perda por mês por fonte (mesma conta do relatório): R$ 11,5 / 9,3 / 5,5 mil', /11,5 mil/.test(perdas[0]) && /9,3 mil/.test(perdas[1]) && /5,5 mil/.test(perdas[2]), JSON.stringify(perdas));
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 }); await sleep(300);
    await page.screenshot({ path: path.join(G2DIR, 'conferencia_pcl_normal_1366x768.png'), fullPage: true });
    // comentário sem ligar a ★
    await page.evaluate(() => { var i = document.querySelectorAll('#conf-body .conf-card')[2].querySelector('input'); i.value = 'aditivo fica no e-mail'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    const dorMO3 = await page.evaluate(() => JSON.stringify(S.dores['MO.3']));
    check('comentário grava S.dores[code].frase com star:false (não vira dor declarada)', dorMO3 === JSON.stringify({ star: false, frase: 'aditivo fica no e-mail' }), dorMO3);
    check('o comentário não muda as prioridades', await page.evaluate(() => getGapPlan().anchors.map(o => o.code).join(',') === 'F4.3,MO.6,MO.3'));
    // travar e destravar
    await page.evaluate(() => document.querySelectorAll('#conf-body .conf-card')[0].querySelector('[data-acao="travar"]').click());
    check('Travar grava travado fin', await page.evaluate(() => JSON.stringify(S.prioAjustes.travados) === JSON.stringify([{ code: 'F4.3', tipo: 'fin' }]) && !!document.querySelector('#conf-body .conf-card.trav .conf-lock')));
    await page.evaluate(() => document.querySelector('#conf-body [data-acao="destravar"]').click());
    check('Destravar limpa', await page.evaluate(() => S.prioAjustes.travados.length === 0));
    // tirar a nº 3
    await page.evaluate(() => document.querySelectorAll('#conf-body .conf-card')[2].querySelector('[data-acao="tirar"]').click()); await sleep(200);
    const tirou = await page.evaluate(() => ({ aj: JSON.stringify(S.prioAjustes), cards: Array.prototype.map.call(document.querySelectorAll('#conf-body .conf-card'), c => c.getAttribute('data-code')).join(','),
      ret: Array.prototype.map.call(document.querySelectorAll('#conf-body .conf-li'), l => l.getAttribute('data-code') + ':' + /Retirado das prioridades/.test(l.innerText)).filter(x => x.indexOf('true') >= 0).join(','),
      draft: JSON.parse(localStorage.getItem(DRAFT_KEY)).state.prioAjustes }));
    check('Tirar das prioridades: MO.3 sai, entra F4.4 (próxima fonte), MO.3 volta em Demais com "Retirado das prioridades"', tirou.cards === 'F4.3,MO.6,F4.4' && tirou.ret === 'MO.3:true', JSON.stringify(tirou));
    check('S.prioAjustes gravado no rascunho (saveDraft)', JSON.stringify(tirou.draft) === JSON.stringify({ travados: [], excluidos: ['MO.3'] }), JSON.stringify(tirou.draft));
    await page.screenshot({ path: path.join(G2DIR, 'conferencia_pcl_nr3_retirada_1366x768.png'), fullPage: true });
    // Ver relatório reflete o ajuste
    await page.evaluate(() => document.getElementById('btn-conf-relatorio').click()); await sleep(1200);
    const repAj = await page.evaluate(() => ({ scr: document.querySelector('.screen.active').id, cards: document.querySelectorAll('#screen-report .anchor-gap-card').length, txt: document.getElementById('screen-report').innerText, plan: ptModel('detalhado').criticos.map(c => c.code).join(','), g3: getGapPlan().anchors[2].gap }));
    check('relatório mostra as prioridades ajustadas (F4.3, MO.6, F4.4)', repAj.scr === 'screen-report' && repAj.cards === 3 && repAj.plan === 'F4.3,MO.6,F4.4' && repAj.txt.indexOf(repAj.g3) >= 0 && repAj.txt.indexOf('Estouro') >= 0, repAj.scr + ' ' + repAj.cards + ' ' + repAj.plan);
    // botão ← Conferência no relatório
    await page.evaluate(() => document.querySelector('#screen-report button[onclick="showConfirmacao()"]').click()); await sleep(300);
    check('botão "← Conferência" no relatório volta à Conferência', await active(page) === 'screen-confirmacao');
    // Tornar prioridade em ponto retirado só desfaz a retirada: retirar MO.3 e restaurar devolve as prioridades originais (MO.3 travada como fin)
    await page.evaluate(() => document.querySelector('#conf-body .conf-li[data-code="MO.3"] [data-acao="promover"]').click());
    const p1 = await page.evaluate(() => ({ aj: JSON.stringify(S.prioAjustes), cards: Array.prototype.map.call(document.querySelectorAll('#conf-body .conf-card'), c => c.getAttribute('data-code')).join(',') }));
    check('Tornar prioridade em ponto retirado: sai de excluídos e volta travado fin (3 prioridades, sem fonte duplicada)', p1.aj === JSON.stringify({ travados: [{ code: 'MO.3', tipo: 'fin' }], excluidos: [] }) && p1.cards === 'F4.3,MO.6,MO.3', p1.aj + ' | ' + p1.cards);
    check('restaurar devolve as prioridades originais (F4.3, MO.6, MO.3)', p1.cards === base0.anchors.map(a => a.split(':')[0]).join(','), p1.cards);
    // promove mais dois pontos até o teto de 5
    await page.evaluate(() => document.querySelector('#conf-body .conf-li [data-acao="promover"]').click());
    await page.evaluate(() => document.querySelector('#conf-body .conf-li [data-acao="promover"]').click());
    const p2 = await page.evaluate(() => ({ n: document.querySelectorAll('#conf-body .conf-card').length, dis: Array.prototype.every.call(document.querySelectorAll('#conf-body [data-acao="promover"]'), b => b.disabled), teto: /Teto de 5 prioridades atingido/.test(document.getElementById('conf-body').innerText) }));
    check('com 5 prioridades "Tornar prioridade" fica desabilitado, com a explicação do teto', p2.n === 5 && p2.dis && p2.teto, JSON.stringify(p2));
    await page.screenshot({ path: path.join(G2DIR, 'conferencia_pcl_teto_1366x768.png'), fullPage: true });
    // Voltar da Conferência -> AHA
    await page.evaluate(() => document.getElementById('btn-conf-voltar').click()); await sleep(300);
    check('← Voltar da Conferência -> tela AHA', await active(page) === 'screen-aha');
    // Retomada/admin: showReport direto, com os ajustes salvos aplicados
    await page.evaluate(() => { showReport(); }); await sleep(800);
    check('retomada vai direto ao relatório, com os ajustes salvos', await page.evaluate(() => document.querySelector('.screen.active').id === 'screen-report' && document.querySelectorAll('#screen-report .anchor-gap-card').length === 5));
    // volta ao estado original para os testes seguintes (PDF)
    await page.evaluate(() => { S.prioAjustes = { travados: [], excluidos: [] }; delete S.dores['MO.3']; buildReport(); });
    await sleep(300);

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
