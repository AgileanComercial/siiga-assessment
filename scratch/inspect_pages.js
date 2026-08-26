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
    const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else { res.writeHead(404); res.end('Not found'); }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

server.listen(8097, async () => {
  const executablePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('dialog', async d => { await d.dismiss(); });
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8097/index.html', { waitUntil: 'networkidle0' });

  await page.evaluate(() => {
    S.empresa = 'CONSTRUTORA ALFA'; S.consultor='Lucas'; S.contato='Roberto'; S.cargo='Diretor';
    S.email='a@a.com'; S.telefone='(11)99999-9999'; S.data='2026-08-25';
    S.numObras=6; S.orcamentoMedio=12000000; S.prazoMedio=18;
    S.tipologia='vert'; S.modeloMO='mista'; S.momento='crescimento';
    S.ferramentas={planejamento:'MS Project',medicao:'Excel',qualidade:'FVS',contratos:'Sienge',folha:'Excel'};
    S.scores={ b03:1.5, f1:[1.5,1,1.5,1,1.5,1,1.5], f2:[1.5,1,1.5], f3:[1,1,1.5,1,1.5], mo:{'MO.1':1.5,'MO.2':1,'MO.3':1.5,'MO.4':1,'MO.5':1.5,'MO.6':1,'MO.7':1}, f4:[1.5,1,1.5] };
    S.showMO = true;
    S.roi2 = { folha:16, hDiaAtual:4, hSemQualidade:12, fluxoPlanejar:24, fluxoCurto:8, fluxoMedio:10, fluxoReprogramar:16, fluxoMedir:12, fluxoConferir:14, fluxoERP:8, fluxoCruzar:10 };
    S.mensalidade = 3500; S.captura = 0.5;
    buildAndShowRadar();
    buildReport();
    showScreen('screen-report');
  });
  await sleep(800);

  const info = await page.evaluate(() => {
    var reportEl = document.getElementById('screen-report');
    var wrapper = reportEl.querySelector(':scope > div');
    var sections = wrapper ? Array.prototype.slice.call(wrapper.children) : [];
    var CONTENT_PX_WIDTH = 920;
    var pageW = 210, pageH = 297, margin = 10;
    var contentWMm = pageW - margin*2;
    var mmPerPx = contentWMm / CONTENT_PX_WIDTH;
    var heightsPx = sections.map(function(s){ return s.getBoundingClientRect().height; });
    var PAGE_SAFETY_MM = 6;
    var pageGroups = [];
    var cur = [], curHMm = 0;
    for(var i=0;i<sections.length;i++){
      var hMm = heightsPx[i]*mmPerPx;
      var availMm = (pageGroups.length===0 ? (pageH-margin-10) : (pageH-margin-margin)) - PAGE_SAFETY_MM;
      if(cur.length>0 && (curHMm+hMm)>availMm){ pageGroups.push(cur); cur=[]; curHMm=0; }
      cur.push(i); curHMm += hMm;
    }
    if(cur.length>0) pageGroups.push(cur);

    function titleOf(s) {
      var t = s.querySelector('.rep-sec-title');
      if(t) return t.textContent.trim();
      var strongTitle = s.querySelector('div[style*="font-weight:700"]');
      if(strongTitle) return strongTitle.textContent.trim().substring(0,60);
      return (s.id || s.className || 'no-id').substring(0,60);
    }

    var result = pageGroups.map(function(grp, gi){
      var totalMm = grp.reduce(function(a,i){ return a + heightsPx[i]*mmPerPx; }, 0);
      var availMm = (gi===0 ? (pageH-margin-10) : (pageH-margin-margin)) - PAGE_SAFETY_MM;
      return {
        page: gi+2, // +2 because radar is page 1
        cards: grp.map(function(i){ return titleOf(sections[i]) + ' (' + Math.round(heightsPx[i]*mmPerPx) + 'mm)'; }),
        totalMm: Math.round(totalMm),
        availMm: Math.round(availMm),
        fillPct: Math.round(100*totalMm/availMm)
      };
    });
    return result;
  });

  console.log(JSON.stringify(info, null, 2));

  await browser.close();
  server.close();
  process.exit(0);
});
