// E2E da aba Agendamentos do admin (material prévio do diagnóstico).
// Login -> aba Agendamentos -> formulário -> gerar PDF -> conferir DOM do documento,
// arquivo (páginas, tamanho) e as 3 mensagens. Nada vai ao Supabase de verdade:
// /rest/v1/agendamentos, /rest/v1/mensagens_modelos e /rest/v1/assessments são respondidos com mock; qualquer
// outra chamada ao Supabase é abortada e reprova o teste.
// Uso: node scratch/test_material_previo.js   (PDFs e PNGs em scratch/out_material_previo/)
// Variáveis: BASE_URL=https://siiga.vercel.app roda contra produção (sem servidor local).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let puppeteer;
try { puppeteer = require('puppeteer'); }
catch (e) { puppeteer = require(path.resolve(__dirname, '../../siiga-assessment/node_modules/puppeteer')); }

const BASE_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'out_material_previo');
const PORT = 8251;
const BASE_URL = process.env.BASE_URL || ('http://127.0.0.1:' + PORT);
fs.mkdirSync(OUT_DIR, { recursive: true });

function futuro(dias) {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const CONS_TESTE = { nome: 'Consultor Teste', cargo: '', email: 'consultor.teste@exemplo.com', whatsapp: '5585900000000' };
const CONS_SEM_CONTATO = { nome: 'Consultor Sem Contato', cargo: '', email: '', whatsapp: '' };
const PV_TESTE = { nome: 'Pré-vendedor Teste' };

const CENARIOS = [
  { id: 'completo', tabela: true, f: { empresa: 'Construtora PCL', contato: 'Thiago Toscano', cargo: 'Sócio', email: 'thiago@exemplo.com',
    whatsapp: '85999990000', data: futuro(8), hora: '14:00', link: 'https://meet.google.com/abc-defg-hij',
    decisor: 'Roberto Teste', decisorCargo: 'Diretor de Engenharia' } },
  { id: 'minimo', tabela: true, f: { empresa: 'Horizonte Engenharia', contato: 'Marina Lopes', cargo: '', email: '', whatsapp: '',
    data: futuro(5), hora: '09:30', link: '', decisor: '', decisorCargo: '' } },
  { id: 'longo', tabela: false, f: { empresa: 'Companhia Brasileira de Construções, Incorporações e Empreendimentos Imobiliários do Nordeste S.A.',
    contato: 'Ana Beatriz Cavalcanti de Albuquerque Montenegro Vasconcelos', cargo: 'Gerente Executiva de Planejamento, Controle e Engenharia de Custos de Obras',
    email: 'ana.beatriz@exemplo.com.br', whatsapp: '11988887777', data: futuro(20), hora: '16:45', link: 'https://teams.microsoft.com/l/meetup-join/xyz',
    decisor: 'José Henrique Cavalcanti de Albuquerque Montenegro', decisorCargo: 'Diretor Executivo de Engenharia, Suprimentos e Novos Negócios' } }
];

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const fp = path.join(BASE_DIR, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': types[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  } else { res.writeHead(404); res.end('Not found'); }
});

const falhas = [];
function check(cond, msg) { console.log((cond ? '  ok   ' : '  FALHA ') + msg); if (!cond) falhas.push(msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function abrirAdmin(browser, mock) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (!u.includes('supabase.co')) return req.continue();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
    if (u.includes('/rest/v1/assessments')) {
      mock.calls.push('assessments ' + req.method());
      if (req.method() !== 'GET') { mock.proibidas.push(req.method() + ' ' + u); return req.abort(); }
      return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(mock.assessments) });
    }
    if (u.includes('/rest/v1/mensagens_modelos')) {
      mock.calls.push('modelos ' + req.method());
      if (mock.modelosTabela === false) return req.respond({ status: 404, headers: cors, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.mensagens_modelos' in the schema cache" }) });
      mock.modelos = mock.modelos || [];
      if (req.method() === 'GET') return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(mock.modelos) });
      const body = req.postData() ? JSON.parse(req.postData()) : {};
      if (req.method() === 'POST') {
        const novos = Array.isArray(body) ? body : [body];
        novos.forEach(n => { mock.modelos.push(n); mock.escritasModelos.push('POST ' + n.chave); });
        return req.respond({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify(novos) });
      }
      if (req.method() === 'PATCH') {
        const m = /chave=eq\.([^&]+)/.exec(u); const ch = m && decodeURIComponent(m[1]);
        const row = mock.modelos.find(r => r.chave === ch);
        if (row) Object.assign(row, body);
        mock.escritasModelos.push('PATCH ' + ch);
        return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) });
      }
    }
    if (u.includes('/rest/v1/agendamentos')) {
      mock.calls.push('agendamentos ' + req.method());
      if (!mock.tabela) return req.respond({ status: 404, headers: cors, contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.agendamentos' in the schema cache" }) });
      if (req.method() === 'GET') return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(mock.rows) });
      const body = req.postData() ? JSON.parse(req.postData()) : {};
      if (req.method() === 'POST') {
        const row = Object.assign({ id: 'mock-' + (mock.rows.length + 1), created_at: new Date().toISOString(), status: 'agendado', pdf_gerado_em: null }, Array.isArray(body) ? body[0] : body);
        mock.rows.unshift(row);
        return req.respond({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify([row]) });
      }
      if (req.method() === 'PATCH') {
        const m = /id=eq\.([^&]+)/.exec(u); const id = m && decodeURIComponent(m[1]);
        const row = mock.rows.find(r => r.id === id);
        if (row) Object.assign(row, body);
        return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) });
      }
    }
    mock.proibidas.push(req.method() + ' ' + u);
    return req.abort();
  });
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.goto(BASE_URL + '/admin.html', { waitUntil: 'networkidle0' });
  await page.type('#pass-input', '@Agilean2026');
  await page.click('.login-box .btn');
  await sleep(800);
  return { page, erros };
}

async function abrirEditor(page) {
  await page.click('#ag-btn-modelos');
  await page.waitForSelector('#mod-campo-email_assunto', { timeout: 5000 });
  await sleep(200);
}
async function setCampo(page, chave, valor) {
  await page.$eval('#mod-campo-' + chave, (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, valor);
}
async function msgsTela(page) {
  await page.waitForSelector('#ag-msg-lembrete pre', { timeout: 20000 });
  return page.evaluate(() => ['email', 'whats', 'lembrete'].map(id => document.querySelector('#ag-msg-' + id + ' pre').textContent));
}
async function gerarMinimo(page) {
  await preencher(page, CENARIOS[1].f, CONS_TESTE.nome);
  await page.click('#ag-btn-gerar');
  await page.waitForFunction(() => window.__MPV_LAST || document.getElementById('ag-erros').textContent, { timeout: 90000 });
}

async function preencher(page, f, consultor) {
  await page.click('#ag-btn-novo');
  const set = async (sel, v) => { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, v); };
  await set('#ag-empresa', f.empresa); await set('#ag-contato', f.contato); await set('#ag-cargo', f.cargo);
  await set('#ag-email', f.email); await set('#ag-whatsapp', f.whatsapp);
  await set('#ag-data', f.data); await set('#ag-hora', f.hora); await set('#ag-link', f.link);
  await page.select('#ag-consultor', consultor); await page.select('#ag-prevendedor', PV_TESTE.nome);
  await set('#ag-decisor', f.decisor); await set('#ag-decisor-cargo', f.decisorCargo);
}

server.listen(PORT, async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  try {
    // ---------- regressão: aba Diagnósticos ----------
    console.log('Regressão: aba Diagnósticos');
    const mock0 = { tabela: true, rows: [], calls: [], proibidas: [], assessments: [
      { id: 1, created_at: '2026-10-20T15:00:00Z', data: '2026-10-20', empresa: 'Empresa Mock', nome: 'Contato Mock', contato: 'Contato Mock',
        consultor: 'Consultor Mock', cargo: 'Diretor', email: 'mock@exemplo.com', telefone: '(85) 99999-0000', nivel: 'Incompleto', scores: {}, state: {} }] };
    const s0 = await abrirAdmin(browser, mock0);
    const linhas = await s0.page.$$eval('#table-body tr', trs => trs.map(t => t.textContent));
    check(linhas.some(t => t.includes('Empresa Mock')), 'Diagnósticos lista o registro (mock)');
    check(await s0.page.$eval('#tab-diagnosticos', e => getComputedStyle(e).display !== 'none'), 'Diagnósticos é a aba inicial');
    await s0.page.evaluate(() => handleAction('view', 0));
    await sleep(500);
    check(await s0.page.$eval('#details-modal', e => getComputedStyle(e).display !== 'none' && e.textContent.includes('Empresa Mock')), 'Detalhes do diagnóstico abre');
    check(!mock0.calls.some(c => c.startsWith('agendamentos')), 'Diagnósticos não chama agendamentos');
    check(s0.erros.length === 0, 'Sem erro de JS na aba Diagnósticos ' + JSON.stringify(s0.erros));
    await s0.page.close();

    // ---------- trava: consultor sem contato ----------
    console.log('Trava: consultor sem e-mail/WhatsApp');
    const mockT = { tabela: true, rows: [], calls: [], proibidas: [], assessments: [] };
    const sT = await abrirAdmin(browser, mockT);
    await sT.page.evaluate((c, p) => { CONSULTORES.push(c); PRE_VENDEDORES.push(p); }, CONS_SEM_CONTATO, PV_TESTE);
    await sT.page.click('#tabbtn-agendamentos'); await sleep(500);
    await preencher(sT.page, CENARIOS[1].f, CONS_SEM_CONTATO.nome);
    await sT.page.click('#ag-btn-gerar'); await sleep(800);
    const errT = await sT.page.$eval('#ag-erros', e => e.textContent);
    check(/sem e-mail ou WhatsApp/.test(errT), 'PDF bloqueado sem contato do consultor');
    check(!(await sT.page.evaluate(() => !!window.__MPV_LAST)), 'Nenhum PDF gerado na trava');
    // validação: data no passado
    await sT.page.$eval('#ag-data', el => { el.value = '2020-01-01'; });
    await sT.page.click('#ag-btn-salvar'); await sleep(300);
    check(/no futuro/.test(await sT.page.$eval('#ag-erros', e => e.textContent)), 'Valida data no futuro');
    await sT.page.close();

    // ---------- cenários ----------
    for (const c of CENARIOS) {
      console.log('Cenário: ' + c.id + (c.tabela ? '' : ' (tabela ausente no Supabase)'));
      const mock = { tabela: c.tabela, rows: [], calls: [], proibidas: [], assessments: [] };
      const { page, erros } = await abrirAdmin(browser, mock);
      await page.evaluate((cs, p) => { CONSULTORES.push(cs); PRE_VENDEDORES.push(p); window.__MPV_KEEP_DOM = true; }, CONS_TESTE, PV_TESTE);
      await page.click('#tabbtn-agendamentos'); await sleep(600);
      check(await page.$eval('#tab-agendamentos', e => getComputedStyle(e).display !== 'none'), 'Aba Agendamentos abre');
      if (!c.tabela) check(/ainda não existe/.test(await page.$eval('#ag-aviso', e => e.textContent)), 'Aviso amigável de tabela ausente');
      await preencher(page, c.f, CONS_TESTE.nome);
      await page.click('#ag-btn-gerar');
      await page.waitForFunction(() => window.__MPV_LAST || document.getElementById('ag-erros').textContent, { timeout: 90000 });
      const errForm = await page.$eval('#ag-erros', e => e.textContent);
      check(!errForm, 'Gerou sem erro ' + errForm);
      if (errForm) { await page.close(); continue; }

      // DOM do documento montado (antes da captura)
      const dom = await page.evaluate(() => {
        const r = document.getElementById('mpv-root');
        const imgs = [...r.querySelectorAll('img')];
        return { texto: r.innerText, paginas: r.querySelectorAll(':scope > .page').length,
          logos: r.querySelectorAll('.logos img').length, imgsOk: imgs.every(i => i.complete && i.naturalWidth > 0),
          mapa: !!r.querySelector('.mapa img') && r.querySelector('.mapa img').naturalWidth > 0,
          run: [...r.querySelectorAll('.run span:first-child')].map(s => s.textContent),
          fonts: document.fonts.check('700 10px "Bai Jamjuree"') && document.fonts.check('400 10px "Manrope"'),
          fit: [...r.querySelectorAll('.page')].map(p => p.getAttribute('data-fit')) };
      });
      const T = dom.texto.replace(/\s+/g, ' ');
      check(dom.paginas === 2, '2 páginas montadas');
      check(dom.logos === 29 && dom.imgsOk && dom.mapa, '29 logos + mapa + carimbos carregados');
      check(dom.fonts, 'Fontes Bai Jamjuree e Manrope carregadas');
      check(T.includes(c.f.empresa), 'Empresa no documento');
      check(T.includes(c.f.contato), 'Contato no documento');
      check(T.includes('consultor.teste@exemplo.com · (85) 90000-0000'), 'Contato do consultor na capa, WhatsApp formatado');
      check(T.toUpperCase().includes('PRESENTES EM 22 ESTADOS') && T.includes('70 mi') && T.includes('Alessandra Silva') && T.includes('Natalia V. de Dios'), 'Portfólio, números e depoimentos');
      check(!/PENDENTE|gap|Jornada|R\$/i.test(T), 'Sem [PENDENTE], "gap", "Jornada" ou preço');
      check(c.f.link ? T.includes('· videochamada') : !T.includes('videochamada'), 'Videochamada só com link');
      if (c.f.decisor) check(T.includes('Nos 15 minutos finais, com ' + c.f.decisor + ', ' + c.f.decisorCargo) && T.includes(c.f.decisor + ' participa.'), 'Decisor no documento');
      else check(T.includes('Nos 15 minutos finais, com quem aprova a contratação') && T.includes('Quem aprova a contratação participa.'), 'Sem decisor: "quem aprova a contratação"');
      console.log('       encaixe por folha: ' + dom.fit.join(', ') + ' · cabeçalho: ' + dom.run[0]);

      // arquivo
      const last = await page.evaluate(() => window.__MPV_LAST);
      const buf = Buffer.from(last.data.split(',')[1], 'base64');
      const out = path.join(OUT_DIR, last.nome.replace('.pdf', '_' + c.id + '.pdf'));
      fs.writeFileSync(out, buf);
      check(/^SIIGA_Preparacao_Diagnostico_[A-Za-z0-9_]+_\d{4}-\d{2}-\d{2}\.pdf$/.test(last.nome), 'Nome do arquivo: ' + last.nome);
      const parteEmp = last.nome.replace(/^SIIGA_Preparacao_Diagnostico_/, '').replace(/_\d{4}-\d{2}-\d{2}\.pdf$/, '');
      check(parteEmp.length <= 40 && !parteEmp.endsWith('_'), 'Parte da empresa no nome ≤ 40 caracteres, sem "_" no fim (' + parteEmp.length + ')');
      if (c.id === 'longo') check(parteEmp.length >= 30 && parteEmp.startsWith('Companhia_Brasileira'), 'Nome do PDF truncado no cenário longo: ' + parteEmp);
      check(buf.length <= 2 * 1024 * 1024, 'PDF ≤ 2 MB (' + Math.round(buf.length / 1024) + ' KB)');
      const py = execFileSync('python', ['-c', [
        'import sys, pymupdf', 'd = pymupdf.open(sys.argv[1])', 'print(len(d))',
        'for i, p in enumerate(d): p.get_pixmap(dpi=130).save(sys.argv[1].replace(".pdf", "_p%d.png" % (i + 1)))'].join('\n'), out]).toString().trim();
      check(py === '2', 'PDF com 2 páginas');

      // mensagens
      const msg = await page.evaluate(() => ['email', 'whats', 'lembrete'].map(id => {
        const el = document.getElementById('ag-msg-' + id); return el ? el.querySelector('pre').textContent : '';
      }));
      const nome1 = c.f.contato.split(' ')[0];
      check(msg[0].startsWith('Assunto: Diagnóstico SIIGA — ' + c.f.empresa + ', ') && msg[0].includes(nome1 + ', confirmado o Diagnóstico SIIGA'), 'E-mail: assunto e saudação');
      check(msg[0].includes('A reunião será conduzida por Consultor Teste, consultor da Agilean.') && /Pré-vendedor Teste\nAgilean$/.test(msg[0]), 'E-mail: consultor citado, assinado pelo pré-vendedor');
      check(msg.every(m => m.length > 0), '3 mensagens exibidas');
      if (c.f.link) check(msg[0].includes(c.f.link) && msg[1].includes('Link: ' + c.f.link) && msg[2].includes('Link: ' + c.f.link), 'Link nas 3 mensagens');
      else check(!/Link:|videochamada:/.test(msg.join(' ')), 'Sem link: linha do link some');
      if (c.f.decisor) check(msg.every(m => m.includes(c.f.decisor)), 'Decisor nas 3 mensagens');
      else check(msg[0].includes('quem aprova a contratação na ' + c.f.empresa) && msg[1].includes('Peço que quem aprova a contratação') && msg[2].includes('Conto com quem aprova a contratação'), 'Sem decisor: "quem aprova a contratação"');
      check(/Pré-vendedor Teste, Agilean$/.test(msg[1]) && /Pré-vendedor Teste, Agilean$/.test(msg[2]), 'WhatsApps assinados pelo pré-vendedor');
      const nBotoes = await page.$$eval('#ag-msgs button', bs => bs.filter(b => b.textContent === 'Copiar').length);
      check(nBotoes === 3, '3 botões Copiar');
      if (c.f.whatsapp) check(await page.$eval('#ag-msg-whats a', a => a.href.startsWith('https://wa.me/55' + '')), 'Link wa.me com DDI 55');

      // persistência
      if (c.tabela) {
        check(mock.rows.length === 1 && mock.rows[0].empresa === c.f.empresa && mock.rows[0].consultor_whatsapp === CONS_TESTE.whatsapp, 'Agendamento inserido (mock)');
        check(!!mock.rows[0].pdf_gerado_em, 'pdf_gerado_em marcado');
        await page.select('#ag-body select', 'realizado'); await sleep(400);
        check(mock.rows[0].status === 'realizado', 'Status alterado na lista');
        await page.type('#ag-busca', 'zzz-nada'); await sleep(200);
        check(/Nenhum agendamento/.test(await page.$eval('#ag-body', e => e.textContent)), 'Busca filtra a lista');
      } else {
        check(mock.rows.length === 0, 'Sem tabela: nada gravado, PDF gerado mesmo assim');
      }
      check(mock.proibidas.length === 0, 'Nenhuma chamada proibida ao Supabase ' + JSON.stringify(mock.proibidas));
      check(erros.length === 0, 'Sem erro de JS ' + JSON.stringify(erros));
      await page.close();
    }

    // ---------- modelos de mensagem ----------
    console.log('Modelos de mensagem: editar muda a mensagem gerada');
    const mockM = { tabela: true, rows: [], calls: [], proibidas: [], assessments: [], modelos: [], escritasModelos: [] };
    const sM = await abrirAdmin(browser, mockM);
    await sM.page.evaluate((cs, p) => { CONSULTORES.push(cs); PRE_VENDEDORES.push(p); window.__MPV_KEEP_DOM = true; }, CONS_TESTE, PV_TESTE);
    await sM.page.click('#tabbtn-agendamentos'); await sleep(600);
    await gerarMinimo(sM.page);
    const base = await msgsTela(sM.page);
    check(base[1].includes('Link: ') === false && !/Videochamada:/.test(base[0]), 'Padrão sem link: linha do link some');
    await abrirEditor(sM.page);
    check(await sM.page.$eval('#mod-aviso', e => e.textContent === ''), 'Sem aviso quando a tabela existe');
    check(await sM.page.$eval('#mod-campo-email_corpo', e => e.value.includes('{quem_aprova_na_empresa}')), 'Editor mostra o padrão (tabela sem linhas)');
    const prev = await sM.page.$eval('#mod-prev', e => e.textContent);
    check(prev.includes('Horizonte Engenharia') && prev.includes('Marina,'), 'Prévia usa o agendamento aberto');
    // chip insere no cursor
    await sM.page.focus('#mod-campo-email_assunto');
    await sM.page.$eval('#mod-campo-email_assunto', e => { e.value = 'Oi X'; e.setSelectionRange(3, 3); });
    await sM.page.evaluate(() => { [...document.querySelectorAll('.ag-chip')].find(b => b.textContent === '{hora}').click(); });
    check(await sM.page.$eval('#mod-campo-email_assunto', e => e.value === 'Oi {hora}X'), 'Chip insere a variável no cursor');
    // variável inválida bloqueia
    await setCampo(sM.page, 'whatsapp_lembrete', 'Oi {contato}, {inexistente} às {hora}');
    check(/inexistente/.test(await sM.page.$eval('#mod-campo-whatsapp_lembrete', e => e.parentNode.querySelector('.err').textContent)), 'Variável inválida sinalizada no campo');
    await sM.page.type('#mod-por', 'Tester');
    await sM.page.click('#mod-btn-salvar'); await sleep(400);
    check(/variável desconhecida \{inexistente\}/.test(await sM.page.$eval('#mod-erros', e => e.textContent)), 'Salvar bloqueado dizendo qual variável');
    check(mockM.escritasModelos.length === 0, 'Nada gravado com variável inválida');
    check(await sM.page.$eval('#mod-modal', e => getComputedStyle(e).display !== 'none'), 'Modal continua aberto');
    // edição válida
    await setCampo(sM.page, 'email_assunto', 'Reunião {empresa} em {data_curta} <b>{hora}</b>');
    await setCampo(sM.page, 'whatsapp_lembrete', 'Lembrete {contato_completo}: {hora}\n{link}\n{quem_aprova_na_empresa}');
    await setCampo(sM.page, 'email_corpo', 'Olá {contato}.\nLink {link}\nAss. {pre_vendedor}');
    await sM.page.click('#mod-btn-salvar'); await sleep(600);
    check(await sM.page.$eval('#mod-modal', e => getComputedStyle(e).display === 'none'), 'Modal fecha ao salvar');
    check(mockM.escritasModelos.sort().join() === 'POST email_assunto,POST email_corpo,POST whatsapp_lembrete', 'Só os modelos alterados foram gravados (POST) ' + mockM.escritasModelos.join());
    check(mockM.modelos.every(m => m.updated_by === 'Tester'), 'updated_by gravado');
    const depois = await msgsTela(sM.page);
    check(depois[0].startsWith('Assunto: Reunião Horizonte Engenharia em ') && depois[0].includes('<b>9h30</b>'), 'Mensagem do e-mail regenerada com o novo assunto (texto puro, sem HTML)');
    check(depois[0].endsWith('Ass. Pré-vendedor Teste') && !depois[0].includes('Link'), 'Corpo novo; linha com {link} some sem link');
    check(depois[2] === 'Lembrete Marina Lopes: 9h30\nquem aprova a contratação na Horizonte Engenharia', 'Lembrete regenerado: ' + JSON.stringify(depois[2]));
    check(depois[1] === base[1], 'WhatsApp de agendamento intacto (padrão)');
    // reabre: mostra "última alteração" e valores salvos
    await abrirEditor(sM.page);
    check(/Última alteração em .* por Tester/.test(await sM.page.$eval('#mod-meta', e => e.textContent)), 'Mostra última alteração e autor');
    check(await sM.page.$eval('#mod-campo-email_assunto', e => e.value.startsWith('Reunião {empresa}')), 'Reabrir traz o texto salvo');
    // restaurar padrão
    await sM.page.click('#mod-rest-email_assunto');
    check(await sM.page.$eval('#mod-campo-email_assunto', e => e.value === 'Diagnóstico SIIGA — {empresa}, {data_curta} às {hora}'), 'Restaurar padrão do assunto');
    await sM.page.click('#mod-btn-salvar'); await sleep(600);
    check(mockM.escritasModelos.includes('PATCH email_assunto') && mockM.modelos.find(m => m.chave === 'email_assunto').texto.startsWith('Diagnóstico SIIGA — {empresa}'), 'Padrão restaurado gravado (PATCH)');
    check((await msgsTela(sM.page))[0].startsWith('Assunto: Diagnóstico SIIGA — Horizonte Engenharia, '), 'Mensagem volta ao padrão');
    // nova sessão lê do Supabase
    await sM.page.close();
    const sM2 = await abrirAdmin(browser, mockM);
    await sM2.page.evaluate((cs, p) => { CONSULTORES.push(cs); PRE_VENDEDORES.push(p); window.__MPV_KEEP_DOM = true; }, CONS_TESTE, PV_TESTE);
    await sM2.page.click('#tabbtn-agendamentos'); await sleep(600);
    await gerarMinimo(sM2.page);
    check((await msgsTela(sM2.page))[0].endsWith('Ass. Pré-vendedor Teste'), 'Nova sessão gera com o modelo do Supabase');
    check(mockM.proibidas.length === 0 && sM.erros.length === 0 && sM2.erros.length === 0, 'Sem chamada proibida nem erro de JS ' + JSON.stringify(mockM.proibidas.concat(sM.erros, sM2.erros)));
    await sM2.page.close();

    console.log('Modelos de mensagem: tabela ausente usa os padrões');
    const mockN = { tabela: true, modelosTabela: false, rows: [], calls: [], proibidas: [], assessments: [], escritasModelos: [] };
    const sN = await abrirAdmin(browser, mockN);
    await sN.page.evaluate((cs, p) => { CONSULTORES.push(cs); PRE_VENDEDORES.push(p); window.__MPV_KEEP_DOM = true; }, CONS_TESTE, PV_TESTE);
    await sN.page.click('#tabbtn-agendamentos'); await sleep(600);
    await gerarMinimo(sN.page);
    check(!(await sN.page.$eval('#ag-erros', e => e.textContent)), 'Gerou normalmente sem a tabela de modelos');
    check((await msgsTela(sN.page))[0].startsWith('Assunto: Diagnóstico SIIGA — Horizonte Engenharia, '), 'Mensagens com os textos padrão');
    await abrirEditor(sN.page);
    check(/mensagens_modelos\.sql/.test(await sN.page.$eval('#mod-aviso', e => e.textContent)), 'Aviso discreto no editor');
    await setCampo(sN.page, 'email_assunto', 'Novo {empresa}');
    await sN.page.type('#mod-por', 'Tester');
    await sN.page.click('#mod-btn-salvar'); await sleep(400);
    check(/ainda não criada/.test(await sN.page.$eval('#mod-erros', e => e.textContent)) && mockN.escritasModelos.length === 0, 'Salvar avisa que a tabela não existe');
    check(sN.erros.length === 0 && mockN.proibidas.length === 0, 'Sem erro de JS ' + JSON.stringify(sN.erros));
    await sN.page.close();
  } catch (e) {
    console.error(e); falhas.push('exceção: ' + e.message);
  } finally {
    await browser.close(); server.close();
    console.log(falhas.length ? '\n' + falhas.length + ' FALHA(S)' : '\nTODOS OS TESTES PASSARAM');
    console.log('Saída: ' + OUT_DIR);
    process.exit(falhas.length ? 1 : 0);
  }
});
