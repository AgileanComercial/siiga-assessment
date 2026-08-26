const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(__dirname, '../..');

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

server.listen(8099, async () => {
  console.log('Static server on http://localhost:8099');
  const executablePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('dialog', async dialog => { console.log('DIALOG:', dialog.message()); await dialog.dismiss(); });
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });

    await page.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle0' });

    // 1. Cover screen
    console.log('Filling cover screen...');
    await page.type('#c-empresa', 'CONSTRUTORA BETA TESTE V3');
    await page.type('#c-contato', 'Marina Costa');
    await page.type('#c-cargo', 'Diretora de Operações');
    await page.type('#c-email', 'marina@beta.eng.br');
    await page.type('#c-telefone', '(11) 91234-5678');
    await page.type('#c-consultor', 'Lucas Fernandes');
    await page.click('button[onclick="startAssessment()"]');
    await sleep(300);

    // Global counter to cycle through option indices 0,1,2,3 (scores 0,1,1.5,3)
    // deliberately, so gap severities (Crítico AND Oportunidade) both show up,
    // instead of always picking a mid-range/uniform answer.
    let qCounter = 0;

    // 2. Bloco 0 (perfil da operação)
    console.log('Answering Bloco 0...');
    for (let i = 0; i < 30; i++) {
      const activeId = await page.evaluate(() => {
        var el = document.querySelector('.screen.active');
        return el ? el.id : null;
      });
      if (activeId !== 'screen-b0') break;
      const qType = await page.evaluate(() => {
        var q = B0Q[currentQIdx];
        return q ? q.type : null;
      });
      console.log('b0 iter', i, 'qType', qType, 'currentQIdx', await page.evaluate(() => currentQIdx));
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
          document.querySelectorAll('#b0-card input[id^="ferr-"]').forEach(function(el, idx) {
            el.value = 'Ferramenta ' + (idx + 1);
          });
        });
      } else {
        const opts = await page.$$('#b0-card .opt');
        if (opts.length) {
          const idx = qCounter % opts.length;
          qCounter++;
          await opts[idx].click();
        }
      }
      await page.click('.screen.active .btn-p[onclick="nextQ()"]');
      await sleep(120);
    }

    // 3. Transition/bifurcation screen — choose "Diagnóstico Completo"
    console.log('Choosing Diagnostico Completo...');
    await sleep(300);
    await page.click('#focus-all .focus-card-header');
    await sleep(200);
    await page.click('#btn-start-diagnosis');
    await sleep(300);

    // 4. Phase questions loop (F1..F4, MO if applicable) until radar screen appears.
    // Cycles opts index 0,1,2,3,0,1,2,3... across all questions in reading order —
    // guarantees every one of the 4 score levels (0, 1, 1.5, 3) appears repeatedly,
    // spread across phases, instead of a uniform "middle" answer everywhere.
    console.log('Answering phase questions with varied (0/1/1.5/3) responses...');
    for (let i = 0; i < 60; i++) {
      const activeScreen = await page.evaluate(() => {
        var el = document.querySelector('.screen.active');
        return el ? el.id : null;
      });
      if (activeScreen === 'screen-radar') break;

      if (activeScreen === 'screen-phase-result') {
        await page.click('#result-next-btn');
        await sleep(150);
        continue;
      }

      if (activeScreen === 'screen-phase') {
        const qType = await page.evaluate(() => {
          var bk = phaseOrder[currentPhaseIdx];
          var bd = PQ[bk];
          var filteredQs = getFilteredQs(bd);
          var q = filteredQs[currentQIdx];
          return q ? q.type : null;
        });
        if (qType === 'numgrid') {
          await page.evaluate(() => {
            document.querySelectorAll('#phase-card input[id^="rg-"]').forEach(function(el, idx) {
              el.value = String(8 + idx * 3);
            });
          });
        } else {
          const opts = await page.$$('#phase-card .opt');
          if (opts.length) {
            const idx = qCounter % opts.length;
            qCounter++;
            await opts[idx].click();
          }
        }
        await page.click('.screen.active .btn-p[onclick="nextQ()"]');
        await sleep(120);
        continue;
      }

      await sleep(200);
    }

    console.log('Reached radar screen. Waiting for autosave modal...');
    await sleep(1200);

    // 5. Save modal — click Cancelar (NOT confirmSave), never touch Supabase
    const modalVisible = await page.evaluate(() => {
      var m = document.getElementById('save-modal');
      return m && getComputedStyle(m).display !== 'none';
    });
    if (modalVisible) {
      console.log('Save modal visible — clicking Cancelar (discarding, no Supabase writes).');
      await page.click('#save-modal button[onclick="closeSaveModal()"]');
      await sleep(200);
    } else {
      console.log('Save modal not visible (ok) — continuing.');
    }

    // 6. Radar -> Aha screen -> Report
    console.log('Navigating Radar -> Aha -> Report...');
    await page.evaluate(() => document.querySelector('button[onclick="showAhaScreen()"]').click());
    await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="revealAha(\'mid\')"]').click());
    await sleep(400);
    await page.evaluate(() => document.querySelector('button[onclick="showReport()"]').click());
    await sleep(800);

    const onReport = await page.evaluate(() => {
      var el = document.querySelector('.screen.active');
      return el ? el.id : null;
    });
    console.log('Active screen:', onReport);

    // Sanity check: dump opps severities before generating the PDF, so we can
    // confirm both 'critico' and 'oportunidade' show up in this run's data.
    const oppsDump = await page.evaluate(() => {
      var opps = generateOpportunities();
      return opps.map(function(o){ return { gap: o.gap, score: o.score, severity: o.severity }; });
    });
    console.log('OPPS:', JSON.stringify(oppsDump, null, 2));

    // 7. Generate PDF (dark mode default button)
    console.log('Generating PDF via generatePDF(false)...');
    const pdfDataUri = await page.evaluate(async () => {
      return new Promise((resolve) => {
        generatePDF(false);
        const interval = setInterval(() => {
          const loadDiv = document.getElementById('pdf-loading');
          if (!loadDiv && window.__LAST_PDF_DATA) {
            clearInterval(interval);
            resolve(window.__LAST_PDF_DATA);
          }
        }, 300);
        setTimeout(() => {
          clearInterval(interval);
          resolve(window.__LAST_PDF_DATA || null);
        }, 90000);
      });
    });

    if (pdfDataUri && pdfDataUri.startsWith('data:application/pdf')) {
      const base64Data = pdfDataUri.replace(/^data:application\/pdf;filename=[^;]+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
      const targetPath = path.join(ROOT_DIR, 'SIIGA_Assessment_PROTOTIPO_V3_2026-08-25.pdf');
      fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
      console.log('SUCCESS: PDF saved to', targetPath);
    } else {
      console.error('FAILED to get PDF data URI');
    }

    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    try { await browser.close(); } catch(e) {}
    server.close();
    process.exit(1);
  }
});
