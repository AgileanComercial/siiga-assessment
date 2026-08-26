// Mede a altura renderizada (em mm) do card de Roadmap para os cenários alto/misto/baixo,
// usando o mesmo fluxo de preenchimento do generate_v10_pdf.js, para calibrar o CSS de
// espaçamento sem furar o limite de 1 página do bin-packing do PDF.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');
const SCENARIO = process.env.SCENARIO || 'baixo';

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  let filePath = path.join(BASE_DIR, reqPath);
  if (!fs.existsSync(filePath)) filePath = path.join(ROOT_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404); res.end('Not found');
  }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

server.listen(8098, async () => {
  const executablePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    page.on('dialog', async dialog => { await dialog.dismiss(); });
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
    await page.goto('http://localhost:8098/index.html', { waitUntil: 'networkidle0' });

    await page.type('#c-empresa', 'CONSTRUTORA MEDIDA');
    await page.type('#c-contato', 'Marina Costa');
    await page.type('#c-cargo', 'Diretora de Operações');
    await page.type('#c-email', 'marina@beta.eng.br');
    await page.type('#c-telefone', '(11) 91234-5678');
    await page.type('#c-consultor', 'Lucas Fernandes');
    await page.click('button[onclick="startAssessment()"]');
    await sleep(300);

    for (let i = 0; i < 30; i++) {
      const activeId = await page.evaluate(() => { var el = document.querySelector('.screen.active'); return el ? el.id : null; });
      if (activeId !== 'screen-b0') break;
      const qType = await page.evaluate(() => { var q = B0Q[currentQIdx]; return q ? q.type : null; });
      if (qType === 'roi') {
        await page.evaluate(() => {
          document.getElementById('roi-obras').value = '8';
          document.getElementById('roi-prazo').value = '20';
          var orcInput = document.getElementById('roi-orcamento');
          orcInput.value = '15.000.000';
          orcInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      } else if (qType === 'ferramentas') {
        await page.evaluate(() => {
          document.querySelectorAll('#b0-card input[id^="ferr-"]').forEach(function(el, idx) { el.value = 'Ferramenta ' + (idx + 1); });
        });
      } else {
        const opts = await page.$$('#b0-card .opt');
        if (opts.length) await opts[opts.length - 1].click();
      }
      await page.click('.screen.active .btn-p[onclick="nextQ()"]');
      await sleep(100);
    }

    await sleep(300);
    await page.click('#focus-all .focus-card-header');
    await sleep(200);
    await page.click('#btn-start-diagnosis');
    await sleep(300);

    for (let i = 0; i < 60; i++) {
      const activeScreen = await page.evaluate(() => { var el = document.querySelector('.screen.active'); return el ? el.id : null; });
      if (activeScreen === 'screen-radar') break;
      if (activeScreen === 'screen-phase-result') { await page.click('#result-next-btn'); await sleep(100); continue; }
      if (activeScreen === 'screen-phase') {
        const info = await page.evaluate(() => {
          var bk = phaseOrder[currentPhaseIdx];
          var bd = PQ[bk];
          var filteredQs = getFilteredQs(bd);
          var q = filteredQs[currentQIdx];
          return { phaseKey: bk, qType: q ? q.type : null };
        });
        if (info.qType === 'numgrid') {
          await page.evaluate(() => {
            document.querySelectorAll('#phase-card input[id^="rg-"]').forEach(function(el, idx) { el.value = String(8 + idx * 3); });
          });
        } else {
          const opts = await page.$$('#phase-card .opt');
          if (opts.length) {
            let idx;
            if (SCENARIO === 'baixo') idx = 0;
            else if (SCENARIO === 'alto') idx = opts.length - 1;
            else { const highPhase = (info.phaseKey === 'f1' || info.phaseKey === 'f2'); idx = highPhase ? (opts.length - 1) : 0; }
            await opts[idx].click();
          }
        }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]');
        await sleep(100);
        continue;
      }
      await sleep(150);
    }

    await sleep(1000);
    const modalVisible = await page.evaluate(() => { var m = document.getElementById('save-modal'); return m && getComputedStyle(m).display !== 'none'; });
    if (modalVisible) { await page.click('#save-modal button[onclick="closeSaveModal()"]'); await sleep(200); }

    await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click());
    await sleep(300);
    await page.evaluate(() => document.querySelector('button[onclick="revealAha(\'mid\')"]').click());
    await sleep(300);
    await page.evaluate(() => document.querySelector('button[onclick="showReport()"]').click());
    await sleep(600);

    const info = await page.evaluate(() => {
      var CONTENT_PX_WIDTH = 920;
      var pageW = 210, pageH = 297, margin = 10;
      var contentWMm = pageW - margin * 2;
      var mmPerPx = contentWMm / CONTENT_PX_WIDTH;
      var maxHmm = pageH - margin * 2 - 6;
      var roadmapCard = document.querySelector('[data-section="roadmap"]');
      var h = roadmapCard.getBoundingClientRect().height;
      var numSprints = document.querySelectorAll('.sprint').length;
      return { heightPx: h, heightMm: Math.round(h * mmPerPx), maxHmm: Math.round(maxHmm), numSprints: numSprints };
    });
    console.log('SCENARIO=' + SCENARIO, JSON.stringify(info));

    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    try { await browser.close(); } catch (e) {}
    server.close();
    process.exit(1);
  }
});
