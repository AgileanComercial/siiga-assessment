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
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT_DIR, reqPath);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8099, async () => {
  console.log('Static server listening on http://localhost:8099');

  try {
    const executablePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

    const browser = await puppeteer.launch({
      executablePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    console.log('Navigating to http://localhost:8099/index.html...');
    await page.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle0' });

    console.log('Injecting realistic assessment data & disabling auto-save modal...');
    await page.evaluate(() => {
      // Disable autoSave prompt
      window.autoSave = function() {};
      window.promptSave = function() {};

      // Hide modals defensively
      const style = document.createElement('style');
      style.textContent = '#modal-save, #modal-import, #api-modal, #modal-load-confirm, #modal-overlay { display: none !important; }';
      document.head.appendChild(style);

      // Set comprehensive test state
      S = {
        empresa: 'CONSTRUTORA ALFA',
        consultor: 'Lucas Fernandes',
        contato: 'Roberto Silva',
        cargo: 'Diretor de Engenharia',
        email: 'roberto@alfa.eng.br',
        telefone: '(11) 98765-4321',
        data: '2026-08-25',
        numObras: 6,
        orcamentoMedio: 12000000,
        prazoMedio: 20,
        numObrasRange: '5 a 10',
        orcamentoRange: 'R$ 10M a R$ 20M',
        tipologia: 'vert',
        modeloMO: 'mista',
        momento: 'crescimento',
        ferramentas: {
          planejamento: 'MS Project + Excel',
          medicao: 'Planilhas Excel em rede',
          qualidade: 'FVS impressas em papel',
          contratos: 'Sienge ERP',
          folha: 'Excel'
        },
        scores: {
          b03: 1.5,
          f1: [1.5, 1, 1.5, 1, 1.5, 1, 1.5],
          f2: [1.5, 1, 1.5],
          f3: [1, 1, 1.5, 1, 1.5],
          mo: { 'MO.1': 1.5, 'MO.2': 1, 'MO.3': 1.5, 'MO.4': 1, 'MO.5': 1.5, 'MO.6': 1, 'MO.7': 1 },
          f4: [1.5, 1, 1.5]
        },
        showMO: true,
        roi2: {
          folha: 16,
          hDiaAtual: 4,
          hSemQualidade: 12,
          fluxoPlanejar: 24,
          fluxoCurto: 8,
          fluxoMedio: 10,
          fluxoReprogramar: 16,
          fluxoMedir: 12,
          fluxoConferir: 14,
          fluxoERP: 8,
          fluxoCruzar: 10
        },
        mensalidade: 3500,
        captura: 0.50
      };

      // Build radar and report
      buildAndShowRadar();
      buildReport();
      showScreen('screen-report');
    });

    console.log('Waiting for charts and report DOM to render...');
    await new Promise(r => setTimeout(r, 1200));

    console.log('Generating in-page Dark Mode PDF with jsPDF & html2canvas...');
    const pdfDataUri = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        // Trigger dark mode PDF generation
        generatePDF(false, 'dark');

        // Check when #pdf-loading is removed
        const interval = setInterval(() => {
          const loadDiv = document.getElementById('pdf-loading');
          if (!loadDiv && window.__LAST_PDF_DATA) {
            clearInterval(interval);
            resolve(window.__LAST_PDF_DATA);
          }
        }, 300);

        // Safety timeout
        setTimeout(() => {
          clearInterval(interval);
          resolve(window.__LAST_PDF_DATA || null);
        }, 25000);
      });
    });

    if (pdfDataUri && pdfDataUri.startsWith('data:application/pdf')) {
      const base64Data = pdfDataUri.replace(/^data:application\/pdf;filename=[^;]+;base64,/, '').replace(/^data:application\/pdf;base64,/, '');
      const targetPdfPath = path.join(ROOT_DIR, 'SIIGA_Assessment_DARK_MODE_PROTOTIPO.pdf');
      fs.writeFileSync(targetPdfPath, Buffer.from(base64Data, 'base64'));
      console.log('✅ Successfully wrote authentic multi-page Dark Mode PDF to:', targetPdfPath);
      
      // Also save in siiga-assessment folder for convenience
      fs.writeFileSync(path.join(BASE_DIR, 'SIIGA_Assessment_DARK_MODE_PROTOTIPO.pdf'), Buffer.from(base64Data, 'base64'));
    } else {
      console.error('Failed to capture PDF data URI from in-page generator:', pdfDataUri ? pdfDataUri.substring(0, 100) : 'null');
    }

    // Capture visual previews
    // 1. Radar screen in dark mode
    await page.evaluate(() => { showScreen('screen-radar'); });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ROOT_DIR, 'preview_radar_dark.png') });

    // 2. Report screen in dark mode
    await page.evaluate(() => {
      showScreen('screen-report');
      applyPdfDarkTheme(document.getElementById('screen-report'));
    });
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ROOT_DIR, 'preview_report_dark.png'), fullPage: true });

    console.log('✅ Previews saved to preview_radar_dark.png and preview_report_dark.png');

    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Error generating PDF:', err);
    server.close();
    process.exit(1);
  }
});
