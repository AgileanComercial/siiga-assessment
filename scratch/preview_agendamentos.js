// Capturas da aba Agendamentos para revisão (Supabase todo mockado; nada é gravado).
const path0 = require('path'); let puppeteer; try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = require(path0.resolve(__dirname, '../../siiga-assessment/node_modules/puppeteer')); }
const http = require('http'); const fs = require('fs'); const path = require('path');
const BASE = path.join(__dirname, '..'); const OUT = path.join(__dirname, 'preview'); const PORT = 8791;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/admin.html';
  const fp = path.join(BASE, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    const t = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
    res.writeHead(200, { 'Content-Type': t[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(res);
  } else { res.writeHead(404); res.end(); }
});
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const rows = [
  { id: 'r1', created_at: new Date().toISOString(), empresa: 'Horizonte Engenharia', contato: 'Marina Lopes', cargo: 'Coordenadora de Obras', data_reuniao: d(3), hora_reuniao: '10:00:00', consultor: 'Felipe Façanha', pre_vendedor: 'Hermeson Xavier', status: 'agendado', pdf_gerado_em: new Date().toISOString() },
  { id: 'r2', created_at: new Date().toISOString(), empresa: 'Construtora Exemplo', contato: 'Carlos Mendes', cargo: 'Diretor', data_reuniao: d(-2), hora_reuniao: '15:30:00', consultor: 'Israel Chacon', pre_vendedor: 'Thifany Araujo', status: 'realizado', pdf_gerado_em: new Date().toISOString() }];
server.listen(PORT, async () => {
  const br = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
  const pg = await br.newPage(); await pg.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
  await pg.setRequestInterception(true);
  pg.on('request', r => {
    const u = r.url(); if (!u.includes('supabase.co')) return r.continue();
    const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: h });
    if (u.includes('/rest/v1/assessments') && r.method() === 'GET') return r.respond({ status: 200, headers: h, contentType: 'application/json', body: '[]' });
    if (u.includes('/rest/v1/agendamentos')) {
      if (r.method() === 'GET') return r.respond({ status: 200, headers: h, contentType: 'application/json', body: JSON.stringify(rows) });
      const b = JSON.parse(r.postData() || '{}'); const row = Object.assign({ id: 'r' + (rows.length + 1), created_at: new Date().toISOString(), status: 'agendado' }, Array.isArray(b) ? b[0] : b);
      if (r.method() === 'POST') rows.unshift(row);
      return r.respond({ status: r.method() === 'POST' ? 201 : 200, headers: h, contentType: 'application/json', body: JSON.stringify([row]) });
    }
    if (u.includes('/rest/v1/mensagens_modelos')) return r.respond({ status: 200, headers: h, contentType: 'application/json', body: '[]' });
    return r.abort();
  });
  const w = ms => new Promise(r => setTimeout(r, ms));
  await pg.goto(`http://127.0.0.1:${PORT}/admin.html`, { waitUntil: 'networkidle0' });
  await pg.type('#pass-input', '@Agilean2026'); await pg.click('.login-box .btn'); await w(800);
  await pg.click('#tabbtn-agendamentos'); await w(800);
  await pg.screenshot({ path: path.join(OUT, '1_lista.png'), fullPage: true });
  await pg.click('#ag-btn-novo'); await w(300);
  const set = (s, v) => pg.$eval(s, (e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }, v);
  await set('#ag-empresa', 'Construtora PCL'); await set('#ag-contato', 'Thiago Toscano'); await set('#ag-cargo', 'Sócio');
  await set('#ag-email', 'thiago@exemplo.com'); await set('#ag-whatsapp', '(85) 99999-0000'); await set('#ag-data', d(8)); await set('#ag-hora', '14:00');
  await set('#ag-link', 'https://meet.google.com/abc-defg-hij'); await pg.select('#ag-consultor', 'Adailton Azevedo'); await pg.select('#ag-prevendedor', 'Thifany Araujo');
  await pg.screenshot({ path: path.join(OUT, '2_formulario.png'), fullPage: true });
  await pg.click('#ag-btn-gerar');
  await pg.waitForFunction(() => document.getElementById('ag-msgs-card').style.display !== 'none', { timeout: 60000 }); await w(800);
  const card = await pg.$('#ag-msgs-card'); await card.screenshot({ path: path.join(OUT, '3_mensagens.png') });
  await pg.screenshot({ path: path.join(OUT, '4_tela_completa_depois.png'), fullPage: true });
  await pg.click('#ag-btn-modelos'); await pg.waitForSelector('#mod-campo-email_corpo'); await w(300);
  await pg.$eval('.ag-mod-body', e => { e.scrollTop = 0; });
  await pg.screenshot({ path: path.join(OUT, '5_modelos.png') });
  await br.close(); server.close(); console.log('ok', fs.readdirSync(OUT));
});
