// E2E for the presentation screens (cover > pilares > metodo > B0): navigation, back buttons,
// draft resume and screenshots (1920x1080 and 390x844). Supabase writes and AI calls are blocked.
// Usage: SHOTS="<dir>" node scratch/test_navegacao_apresentacao.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots_apresentacao');
const PORT = 8247;

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  let filePath = path.join(BASE_DIR, reqPath);
  if (!fs.existsSync(filePath)) filePath = path.join(ROOT_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
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
    fs.mkdirSync(SHOTS, { recursive: true });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', r => ((r.url().includes('supabase.co') && r.method() !== 'GET' && r.method() !== 'OPTIONS') || r.url().includes('anthropic')) ? r.abort() : r.continue());
    page.on('pageerror', err => { console.log('PAGE ERROR:', err.message); fails.push('pageerror: ' + err.message); });
    page.on('dialog', d => { console.log('DIALOG:', d.message()); d.dismiss(); });
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto('http://localhost:' + PORT + '/index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

    await page.type('#c-empresa', 'Construtora PCL');
    await page.type('#c-contato', 'Thiago Toscano');
    await page.evaluate(() => { document.getElementById('c-cargo').value = 'Sócio'; });
    await page.type('#c-consultor', 'Adailton');
    await page.type('#c-email', 'contato@empresa-exemplo.com.br');
    await page.type('#c-telefone', '(11) 90000-0000');

    // Cover -> Pilares
    await page.click('button[onclick="startAssessment()"]'); await sleep(700);
    check('capa -> Diagnóstico', await active(page) === 'screen-diagnostico');
    check('nav-step Diagnóstico SIIGA', await page.$eval('#nav-step', e => e.textContent) === 'Diagnóstico SIIGA');
    const txtD = (await page.$eval('#screen-diagnostico', e => e.innerText)).replace(/\s+/g, ' ').toUpperCase();
    check('Diagnóstico: textos do piloto', ['DIAGNÓSTICO SIIGA · CONSTRUTORA PCL', 'O DIAGNÓSTICO SIIGA ACONTECE EM DOIS ENCONTROS', 'PARA A CONSTRUTORA PCL', '1º ENCONTRO', '2º ENCONTRO', 'PROJETO DE IMPLEMENTAÇÃO DE MELHORIAS', 'QUEM DEVE PARTICIPAR', 'AGENDAMENTO DO 2º ENCONTRO', 'OPCIONAL, PODE SER PREENCHIDO DEPOIS', 'SE PREENCHIDO, O AGENDAMENTO SAI NO RELATÓRIO'].every(t => txtD.indexOf(t) >= 0), txtD.slice(0, 160));
    check('Diagnóstico sem travessão', txtD.indexOf('—') < 0 && txtD.indexOf('–') < 0);
    check('1º participante pré-preenchido com o contato e o cargo da capa', await page.evaluate(() => { var r = document.querySelector('#reuniao2-participantes .dg-prow'); return r.querySelector('[data-k=nome]').value === 'Thiago Toscano' && r.querySelector('[data-k=cargo]').value === 'Sócio'; }));
    await page.screenshot({ path: path.join(SHOTS, 'diagnostico_1920x1080.png') });
    // Campos opcionais: avançar sem preencher nada não bloqueia
    // Preenche o agendamento: data, hora, 1º participante editado, 2º com nome e 3º sem nome
    await page.evaluate(() => {
      document.getElementById('reuniao2-data').value = '2026-10-28';
      document.getElementById('reuniao2-hora').value = '14:00';
      document.querySelector('#reuniao2-participantes [data-k=cargo]').value = 'Diretor Comercial';
      addReuniao2Participante('Marina Alves', 'Diretora de Engenharia');
      addReuniao2Participante('', 'Cargo sem nome');
    });
    await page.screenshot({ path: path.join(SHOTS, 'diagnostico_1920x1080_preenchida.png') });
    await page.click('#btn-diagnostico-continuar'); await sleep(700);
    check('Diagnóstico -> Pilares', await active(page) === 'screen-pilares');
    const r2 = await page.evaluate(() => JSON.stringify(S.reuniao2));
    check('S.reuniao2 gravado (nome vazio descartado)', r2 === JSON.stringify({ data: '2026-10-28', hora: '14:00', participantes: [{ nome: 'Thiago Toscano', cargo: 'Diretor Comercial' }, { nome: 'Marina Alves', cargo: 'Diretora de Engenharia' }] }), r2);
    check('S.reuniao2 no rascunho', await page.evaluate(() => JSON.parse(localStorage.getItem(DRAFT_KEY)).state.reuniao2.participantes.length === 2));
    await page.click('#btn-pilares-voltar'); await sleep(500);
    check('Voltar dos Pilares -> Diagnóstico', await active(page) === 'screen-diagnostico');
    check('campos restaurados ao voltar', await page.evaluate(() => document.getElementById('reuniao2-data').value === '2026-10-28' && document.getElementById('reuniao2-hora').value === '14:00' && document.querySelectorAll('#reuniao2-participantes .dg-prow').length === 2));
    await page.click('#btn-diagnostico-continuar'); await sleep(500);
    check('capa -> Pilares', await active(page) === 'screen-pilares');
    check('nav-step Pilares SIIGA', await page.$eval('#nav-step', e => e.textContent) === 'Pilares SIIGA');
    check('4 cards de pilar', (await page.$$('#screen-pilares [id^="pilar-card-"]')).length === 4);
    const txtP = await page.$eval('#screen-pilares', e => e.innerText);
    check('Pilares: textos do slide', ['+10.000', '+25 anos', '+10 anos', 'Lean EAP', 'Reunião de inteligência', 'Controle de produção MO', 'Proteção e garantia da execução do plano'].every(s => txtP.toUpperCase().indexOf(s.toUpperCase()) >= 0), txtP.slice(0,120));
    check('Pilares sem travessão', txtP.indexOf('—') < 0 && txtP.indexOf('–') < 0);
    await page.screenshot({ path: path.join(SHOTS, 'pilares_1920x1080.png') });
    const scr1 = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
    console.log('Pilares 1920x1080 scrollHeight/innerHeight:', JSON.stringify(scr1));

    // Pilares -> Metodo
    await page.click('#btn-pilares-continuar'); await sleep(700);
    check('Pilares -> Método', await active(page) === 'screen-metodo');
    check('nav-step Método SIIGA', await page.$eval('#nav-step', e => e.textContent) === 'Método SIIGA');
    const txtM = (await page.$eval('#screen-metodo', e => e.innerText)).replace(/\s+/g, ' ');
    check('Método: textos do slide', ['Last Planner System', 'Nenhuma big tech tem esses dados', 'O PLANO CHEGA', 'MARGEM PROTEGIDA'].every(s => txtM.toUpperCase().indexOf(s.toUpperCase()) >= 0));
    check('Método sem travessão', txtM.indexOf('—') < 0 && txtM.indexOf('–') < 0);
    check('Método: origem e garantias', !!(await page.$('#metodo-origem')) && !!(await page.$('#metodo-garantias')));
    await page.screenshot({ path: path.join(SHOTS, 'metodo_1920x1080.png') });
    const scr2 = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
    console.log('Método 1920x1080 scrollHeight/innerHeight:', JSON.stringify(scr2));

    // Voltar: Metodo -> Pilares -> capa (campos preenchidos)
    await page.click('#btn-metodo-voltar'); await sleep(500);
    check('Voltar do Método -> Pilares', await active(page) === 'screen-pilares');
    await page.click('#btn-pilares-voltar'); await sleep(500);
    check('Voltar dos Pilares -> Diagnóstico', await active(page) === 'screen-diagnostico');
    await page.click('#btn-diagnostico-voltar'); await sleep(500);
    check('Voltar do Diagnóstico -> capa', await active(page) === 'screen-cover');
    const campos = await page.evaluate(() => ['c-empresa', 'c-contato', 'c-cargo', 'c-consultor', 'c-email', 'c-telefone'].map(id => document.getElementById(id).value));
    check('capa mantém campos preenchidos', campos.every(Boolean), JSON.stringify(campos));

    // Cover -> ... -> B0 first question
    await page.click('button[onclick="startAssessment()"]'); await sleep(500);
    check('campos do agendamento mantidos após voltar à capa e seguir', await page.evaluate(() => document.getElementById('reuniao2-data').value === '2026-10-28'));
    await page.click('#btn-diagnostico-continuar'); await sleep(500);
    await page.click('#btn-pilares-continuar'); await sleep(500);
    await page.click('#btn-metodo-iniciar'); await sleep(500);
    check('Iniciar -> B0', await active(page) === 'screen-b0');
    check('B0 na 1ª pergunta', await page.evaluate(() => currentQIdx === 0 && currentBlock === 'b0'));

    // "Anterior" on first B0 question -> Metodo
    await page.click('.screen.active .btn-s[onclick="prevQ()"]'); await sleep(500);
    check('Anterior na 1ª pergunta do B0 -> Método', await active(page) === 'screen-metodo');
    await page.click('#btn-metodo-iniciar'); await sleep(500);

    // Answer 3 questions (select an option when present, then Próximo)
    for (let i = 0; i < 3; i++) {
      const q = await page.evaluate(() => { var q = B0Q[currentQIdx]; return { type: q.type }; });
      if (q.type === 'roi') {
        await page.evaluate(() => {
          document.getElementById('roi-obras').value = '1'; document.getElementById('roi-prazo').value = '15';
          var o = document.getElementById('roi-orcamento'); o.value = '3.500.000'; o.dispatchEvent(new Event('input', { bubbles: true }));
        });
      } else if (q.type === 'ferramentas') {
        await page.evaluate(() => { var el = document.getElementById('ferr-planejamento'); if (el) el.value = 'Excel'; });
      } else {
        const opts = await page.$$('#b0-card .opt'); if (opts.length) await opts[0].click();
      }
      await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(250);
    }
    const idxBefore = await page.evaluate(() => currentQIdx);
    check('avançou até a 4ª pergunta do B0', idxBefore === 3, idxBefore);
    await sleep(500);

    // Reload and resume the draft: it must land on the 4th question (index 3), where the user stopped
    const draftIdx = await page.evaluate(() => JSON.parse(localStorage.getItem(DRAFT_KEY)).currentQIdx);
    check('rascunho gravou o índice atual do B0 (3)', draftIdx === 3, draftIdx);
    await page.reload({ waitUntil: 'networkidle0' }); await sleep(800);
    const banner = await page.evaluate(() => document.getElementById('resume-banner').style.display);
    check('banner de rascunho visível', banner === 'flex', banner);
    await page.click('#resume-banner .btn-p'); await sleep(700);
    check('retomada cai no B0 (sem telas de apresentação)', await active(page) === 'screen-b0', await active(page));
    check('retomada na pergunta onde parou (B0, índice 3)', await page.evaluate(() => currentBlock === 'b0' && currentQIdx === 3));
    // "Anterior" also saves the draft
    await page.click('.screen.active .btn-s[onclick="prevQ()"]'); await sleep(300);
    check('Anterior no B0 grava o novo índice (2)', await page.evaluate(() => JSON.parse(localStorage.getItem(DRAFT_KEY)).currentQIdx) === 2);

    // Pilar block: enter the phases, answer 2 questions, reload and resume on the 3rd
    await page.evaluate(() => { phaseOrder = ['f1', 'f2', 'f3', 'f4']; beginPhases(); }); await sleep(400);
    for (let i = 0; i < 2; i++) {
      const o = await page.$$('#phase-card .opt'); if (o.length) await o[0].click();
      await page.click('.screen.active .btn-p[onclick="nextQ()"]'); await sleep(250);
    }
    const ph = await page.evaluate(() => { var d = JSON.parse(localStorage.getItem(DRAFT_KEY)); return { b: d.currentBlock, i: d.currentQIdx, p: d.currentPhaseIdx }; });
    check('rascunho gravou bloco de pilar e índice (phase, idx 2)', ph.b === 'phase' && ph.i === 2 && ph.p === 0, JSON.stringify(ph));
    await page.reload({ waitUntil: 'networkidle0' }); await sleep(800);
    await page.click('#resume-banner .btn-p'); await sleep(700);
    check('retomada cai no pilar, na pergunta onde parou', await active(page) === 'screen-phase' && await page.evaluate(() => currentBlock === 'phase' && currentQIdx === 2 && currentPhaseIdx === 0));
    await page.click('.screen.active .btn-s[onclick="prevQ()"]'); await sleep(300);
    check('Anterior no pilar grava o novo índice (1)', await page.evaluate(() => JSON.parse(localStorage.getItem(DRAFT_KEY)).currentQIdx) === 1);
    // Back to a b0 draft with index 2 for the scheduling checks below
    await page.evaluate(() => { var d = JSON.parse(localStorage.getItem(DRAFT_KEY)); d.currentBlock = 'b0'; d.currentQIdx = 2; localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); });
    await page.reload({ waitUntil: 'networkidle0' }); await sleep(800);
    await page.click('#resume-banner .btn-p'); await sleep(700);
    check('retomada com índice 2 cai na pergunta 3 do B0', await active(page) === 'screen-b0' && await page.evaluate(() => currentQIdx) === 2);

    // After resume: S.reuniao2 restored and the screen re-renders it; empty scheduling never blocks advancing
    await page.evaluate(() => showDiagnostico()); await sleep(300);
    check('retomada restaura S.reuniao2 nos campos', await page.evaluate(() => document.getElementById('reuniao2-data').value === '2026-10-28' && document.querySelectorAll('#reuniao2-participantes .dg-prow').length === 2));
    await page.evaluate(() => { document.getElementById('reuniao2-data').value = ''; document.getElementById('reuniao2-hora').value = ''; document.querySelectorAll('#reuniao2-participantes input').forEach(i => i.value = ''); });
    await page.click('#btn-diagnostico-continuar'); await sleep(400);
    check('campos vazios não bloqueiam o avanço', await active(page) === 'screen-pilares' && await page.evaluate(() => S.reuniao2.data === '' && S.reuniao2.participantes.length === 0));
    // Mobile screenshots (fresh page state: go to each presentation screen directly)
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    // setViewport(isMobile) reloads the page: restore S from the draft first
    await page.evaluate(() => { resumeDraft(); document.getElementById('resume-banner').style.display = 'none'; showDiagnostico(); window.scrollTo(0, 0); }); await sleep(800);
    await page.screenshot({ path: path.join(SHOTS, 'diagnostico_390x844.png'), fullPage: true });
    await page.evaluate(() => {
      document.getElementById('reuniao2-data').value = '2026-10-28'; document.getElementById('reuniao2-hora').value = '14:00';
      var ins = document.querySelectorAll('#reuniao2-participantes input'); ins[0].value = 'Thiago Toscano'; ins[1].value = 'Sócio';
      addReuniao2Participante('Marina Alves', 'Diretora de Engenharia'); window.scrollTo(0, 0);
    }); await sleep(500);
    await page.screenshot({ path: path.join(SHOTS, 'diagnostico_390x844_preenchida.png'), fullPage: true });
    await page.evaluate(() => { showPilares(); window.scrollTo(0, 0); }); await sleep(800);
    await page.screenshot({ path: path.join(SHOTS, 'pilares_390x844.png'), fullPage: true });
    await page.evaluate(() => showMetodo()); await sleep(600);
    await page.screenshot({ path: path.join(SHOTS, 'metodo_390x844.png'), fullPage: true });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('mobile sem rolagem horizontal', ov <= 0, ov);
  } catch (e) {
    console.log('ERRO:', e && e.stack || e); fails.push('exception');
  } finally {
    await browser.close(); server.close();
    console.log(fails.length ? ('\nFALHAS: ' + fails.join(' | ')) : '\nTUDO OK');
    process.exit(fails.length ? 1 : 0);
  }
});
