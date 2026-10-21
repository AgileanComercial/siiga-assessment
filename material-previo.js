// ═══════════════════════════════════════════
//  MATERIAL PRÉVIO DO DIAGNÓSTICO
// ═══════════════════════════════════════════
// "Preparação para o Diagnóstico SIIGA": PDF de 2 páginas enviado ao cliente
// quando a reunião é agendada (aba Agendamentos do admin). Porte do piloto
// aprovado em Projeto SIIGA/material_previo/piloto (r4): mesmo texto, mesma
// grade, mesmos degraus de encaixe. PDF por html2canvas + jsPDF (imagem), como
// o relatório. Todo dado digitado passa por mpvEsc() antes de entrar no HTML.

var MPV_DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
var MPV_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Os 29 logos do slide de portfólio, na ordem do slide; w/h = tamanho do recorte
// original em px, usado para a altura óptica (área constante, limitada pela célula).
var MPV_LOGOS = [
  ['mda', 'MDA Construções', 109, 54], ['fama', 'Construtora Fama', 84, 54], ['ascen', 'Ascen', 117, 24],
  ['bambui', 'Bambuí', 111, 36], ['kallas', 'Grupo Kallas', 113, 41], ['longitude', 'Longitude', 136, 30],
  ['conx', 'CONX', 112, 43], ['cortez', 'Cortez Engenharia', 131, 38], ['crolim', 'C. Rolim Engenharia', 134, 30],
  ['dimas', 'Dimas Construções', 122, 26], ['planoeplano', 'Plano&Plano', 137, 29], ['constel', 'Constel', 133, 47],
  ['rb', 'RB Construtora', 128, 40], ['morana', 'Morana', 137, 35], ['patriani', 'Patriani', 130, 18],
  ['fontanive', 'Grupo Fontanive', 131, 34], ['tack', 'Tack', 122, 33], ['silvabranco', 'Grupo Silvabranco', 138, 24],
  ['vortex', 'Vórtex', 122, 31], ['pacto', 'Pacto Engenharia', 100, 48], ['mirantes', 'Mirantes', 125, 39],
  ['grifo', 'Grifo Engenharia', 134, 42], ['normatel', 'Normatel Engenharia', 126, 39], ['afonsofranca', 'Afonso França Engenharia', 124, 48],
  ['marquise', 'Marquise', 80, 67], ['jsimoes', 'J.Simões', 90, 69], ['motamachado', 'Mota Machado', 60, 65],
  ['azur', 'Azur', 50, 71], ['bspar', 'BSPAR Incorporações', 76, 74]
];
var MPV_LOGO_AREA = 104, MPV_LOGO_WMAX = 24, MPV_LOGO_HMAX = 6.6; // mm², mm, mm

var MPV_PILARES = ['Planejamento estratégico do fluxo de produção', 'Proteção e garantia da execução do plano',
  'Gestão integrada da produção', 'Controle real e performance da produção'];

// Depoimentos aprovados, texto literal da proposta (buildPropostaDepoimentos em script.js).
var MPV_DEPOIMENTOS = [
  ['“Uma das maiores vantagens que o Agilean nos trouxe foi a capacidade de rastrear e monitorar o progresso das nossas obras em tempo real, permitindo decisões rápidas com dados confiáveis de canteiro. Aumentamos consideravelmente o cumprimento dos prazos.”',
    'Alessandra Silva', 'Coordenação de Planejamento e Controle · CONX'],
  ['“O Agilean nos trouxe praticidade e soluções reais para acompanhar a mão de obra em grandes construções. Nossas obras têm entre 150 e 200 pessoas e era um desafio gerenciar e integrar todos os recursos. Agora tenho tempo para analisar, criar estratégias e focar no que agrega valor.”',
    'Natalia V. de Dios', 'Gerência de Processos e Qualidade · Dimas Construções']
];

function mpvEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function mpvDate(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function mpvHora(h) { var p = h.split(':'); return parseInt(p[0], 10) + 'h' + (p[1] === '00' ? '' : p[1]); }
function mpvDataLonga(iso, comAno) {
  var d = mpvDate(iso);
  return MPV_DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MPV_MESES[d.getMonth()] + (comAno === false ? '' : ' de ' + d.getFullYear());
}
function mpvDataCurta(iso) {
  var d = mpvDate(iso);
  return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
}
function mpvHojeIso() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function mpvPrimeiroNome(n) { return String(n || '').trim().split(/\s+/)[0]; }
// Telefone guardado só com dígitos (com ou sem DDI 55) -> "(11) 97811-9471".
function mpvFone(digitos) {
  var d = String(digitos || '').replace(/\D/g, '');
  if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return String(digitos || '');
}

// ---------- documento ----------
// a = { empresa, contato, cargo, data (AAAA-MM-DD), hora (HH:MM), link, decisor, decisor_cargo,
//       consultor: { nome, email, whatsapp (dígitos) }, emissao (AAAA-MM-DD) }
function mpvRun(a, sec) {
  return '<div class="run"><span><b>Diagnóstico SIIGA</b> · ' + mpvEsc(a.empresa) + '</span><span>' + sec + '</span></div>';
}
function mpvCarimbo(a, folha) {
  return '<div class="carimbo"><div><img src="img/agilean_logo_relatorio.png" alt="Agilean"></div>' +
    '<div><span class="k">Documento</span><b>Preparação para o Diagnóstico SIIGA</b> · ' + mpvEsc(a.empresa) + '</div>' +
    '<div><span class="k">Emissão</span>' + mpvDataCurta(a.emissao) + '</div>' +
    '<div><span class="k">Folha</span><b>' + folha + '</b> / 2</div></div>';
}
function mpvLogosHtml() {
  return MPV_LOGOS.map(function (l) {
    var ar = l[2] / l[3];
    var h = Math.min(Math.sqrt(MPV_LOGO_AREA / ar), MPV_LOGO_HMAX, MPV_LOGO_WMAX / ar);
    return '<div><img src="img/portfolio/logos/' + l[0] + '.png" alt="' + mpvEsc(l[1]) + '" style="height:' +
      h.toFixed(2) + 'mm;width:' + (h * ar).toFixed(2) + 'mm"></div>';
  }).join('') + '<div class="vazio"></div>';
}

function mpvDocumentoHtml(a) {
  var emp = mpvEsc(a.empresa);
  var quemAprova = a.decisor ? mpvEsc(a.decisor) + (a.decisor_cargo ? ', ' + mpvEsc(a.decisor_cargo) : '') : 'quem aprova a contratação';
  var quemAprovaR2 = a.decisor ? mpvEsc(a.decisor) : 'Quem aprova a contratação';
  var contato = mpvEsc(a.contato) + (a.cargo ? '<small>' + mpvEsc(a.cargo) + '</small>' : '');
  var reuniao = mpvDataLonga(a.data) + ', ' + mpvHora(a.hora) + (a.link ? ' · videochamada' : '');
  var cons = a.consultor;

  var p1 = '<div class="page">' + mpvRun(a, 'A Agilean') +
    '<div class="ctit"><h1>Preparação para<br>o Diagnóstico SIIGA</h1></div>' +
    '<div class="meta">' +
      '<div class="lbl">Preparado para</div><div class="v emp">' + emp + '</div>' +
      '<div class="lbl">Contato</div><div class="v">' + contato + '</div>' +
      '<div class="lbl">Reunião</div><div class="v">' + reuniao + '</div>' +
      '<div class="lbl">Consultor</div><div class="v">' + mpvEsc(cons.nome) + ', Agilean<small>' +
        mpvEsc(cons.email) + ' · ' + mpvEsc(mpvFone(cons.whatsapp)) + '</small></div>' +
    '</div>' +
    '<div class="sec row"><div class="secnum">01</div><div><div class="sectit">A Agilean</div>' +
    '<p class="txt">A Agilean desenvolve o SIIGA, método de gestão de obras que redesenha como a construtora planeja e executa: planejamento do fluxo de produção, proteção do plano por análise de restrições e controle da produção. A plataforma Agilean sustenta esse processo e se integra de forma nativa aos principais ERPs do mercado.</p></div></div>' +
    '<div class="sec"><div class="lbl" style="border-top:.75pt solid var(--fio-forte);padding-top:2mm">Construtoras que trabalham com a Agilean</div>' +
    '<div class="port"><div class="mapa"><img src="img/portfolio/mapa_pinos.svg" alt="Mapa do Brasil com a presença da Agilean"><div class="leg lbl">Presentes em 22 estados</div></div>' +
    '<div class="logos">' + mpvLogosHtml() + '</div></div>' +
    '<div class="nums"><div><b>70 mi</b><span>m² construídos com Agilean</span></div><div><b>+1.500</b><span>canteiros impactados</span></div>' +
    '<div><b>+5 mil</b><span>gestores usando por dia</span></div><div><b>15%</b><span>de ganho médio de produtividade</span></div></div>' +
    '</div>' + mpvCarimbo(a, 1) + '</div>';

  var pil = MPV_PILARES.map(function (p, i) { return '<div><span>Pilar ' + (i + 1) + '</span>' + p + '</div>'; }).join('');
  var deps = MPV_DEPOIMENTOS.map(function (d) {
    return '<div class="dep"><p>' + d[0] + '</p><div class="quem"><b>' + d[1] + '</b>' + d[2] + '</div></div>';
  }).join('');
  var p2 = '<div class="page">' + mpvRun(a, 'O Diagnóstico') +
    '<div class="sec row" style="margin-top:7mm"><div class="secnum">02</div><div><div class="sectit">O Diagnóstico SIIGA</div>' +
    '<p class="lead">O Diagnóstico SIIGA avalia a gestão das obras da ' + emp + ' em quatro pilares.</p>' +
    '<div class="pil">' + pil + '</div>' +
    '<p class="txt">As respostas vêm da conversa com a equipe na Reunião 1. Com elas, o diagnóstico mostra os pontos críticos, estima quanto cada obra perde por mês sem tratá-los e organiza o Plano de Transformação Operacional em três Fases de Implementação.</p>' +
    '</div></div>' +
    '<div class="sec row"><div class="secnum">03</div><div><div class="sectit">Como funciona</div></div></div>' +
    '<div class="tl">' +
      '<div class="m"><h3>Reunião 1 · Diagnóstico</h3><div class="q">' + mpvDataCurta(a.data) + ', ' + mpvHora(a.hora) + ' · cerca de 55 minutos</div>' +
        '<ul><li>Conversa com o responsável pelo planejamento e controle das obras sobre a rotina de vocês.</li>' +
        '<li>Leitura dos resultados: os pilares, os pontos críticos e quanto cada obra perde por mês sem tratá-los.</li>' +
        '<li>O ganho mensal esperado com o plano.</li>' +
        '<li>Nos 15 minutos finais, com ' + quemAprova + ': definição da data da Reunião 2.</li></ul></div>' +
      '<div class="m"><h3>Relatório do diagnóstico</h3><div class="q">Enviado após a Reunião 1</div>' +
        '<ul><li>A avaliação por pilar.</li><li>Os pontos críticos, com a prioridade de cada um.</li><li>A perda por mês sem tratamento.</li><li>O Plano de Transformação Operacional.</li></ul></div>' +
      '<div class="m sec2"><h3>Reunião 2 · Escopo</h3><div class="q">Data definida na Reunião 1</div>' +
        '<ul><li>Desenho do escopo do programa junto com vocês, a partir dos pontos críticos do diagnóstico.</li>' +
        '<li>' + quemAprovaR2 + ' participa.</li></ul></div>' +
    '</div>' +
    '<div class="sec row"><div class="secnum">04</div><div><div class="sectit">Depoimentos de clientes Agilean</div></div></div>' +
    '<div class="deps">' + deps + '</div>' +
    mpvCarimbo(a, 2) + '</div>';
  return p1 + p2;
}

// ---------- encaixe ----------
// A página tem overflow:hidden e o carimbo é absolute: texto que passa da área
// útil sumiria sem aviso. mpvFit() aperta em degraus (fit1..fit3) e devolve erro
// se ainda não couber; também corta o cabeçalho corrido com "…".
var MPV_FOLGA_MIN_MM = 3;
function mpvFolgaMm(page) {
  var c = page.querySelector('.carimbo').getBoundingClientRect().top, b = 0;
  Array.prototype.forEach.call(page.querySelectorAll(':scope > *:not(.carimbo)'), function (e) {
    b = Math.max(b, e.getBoundingClientRect().bottom);
  });
  return (c - b) / 3.7795;
}
function mpvCortaRun(page) {
  var s = page.querySelector('.run span:first-child');
  if (!s || s.scrollWidth <= s.clientWidth) return;
  var t = s.textContent;
  while (t.length > 10 && s.scrollWidth > s.clientWidth) { t = t.slice(0, -2); s.textContent = t.replace(/[\s·.,]+$/, '') + '…'; }
}
function mpvFit(root) {
  var erros = [];
  Array.prototype.forEach.call(root.querySelectorAll('.page'), function (page, i) {
    mpvCortaRun(page);
    var nivel = 0;
    while (mpvFolgaMm(page) < MPV_FOLGA_MIN_MM && nivel < 3) {
      if (nivel) page.classList.remove('fit' + nivel);
      nivel++; page.classList.add('fit' + nivel);
    }
    var f = mpvFolgaMm(page);
    if (f < MPV_FOLGA_MIN_MM) erros.push('Folha ' + (i + 1) + ': o conteúdo não cabe (' + f.toFixed(1) + ' mm de folga).');
    page.setAttribute('data-fit', nivel);
  });
  return erros;
}

// ---------- fontes e imagens ----------
var MPV_FONT_FACES = ['400 10px "Bai Jamjuree"', '500 10px "Bai Jamjuree"', '600 10px "Bai Jamjuree"', '700 10px "Bai Jamjuree"',
  '400 10px "Manrope"', '500 10px "Manrope"', '600 10px "Manrope"', '700 10px "Manrope"'];
function mpvFontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all(MPV_FONT_FACES.map(function (f) { return document.fonts.load(f, 'Ação 0123456789').catch(function () {}); }))
    .then(function () { return document.fonts.ready; });
}
function mpvImagensProntas(root) {
  return Promise.all(Array.prototype.map.call(root.querySelectorAll('img'), function (im) {
    return (im.complete && im.naturalWidth) ? Promise.resolve() : new Promise(function (res) { im.onload = res; im.onerror = res; });
  }));
}

function mpvNomeArquivo(a) {
  var emp = String(a.empresa).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return 'SIIGA_Preparacao_Diagnostico_' + (emp || 'Empresa') + '_' + a.data + '.pdf';
}

// Monta, encaixa e exporta. Resolve com { pdf, nome, paginas, fit }; rejeita com
// Error(mensagem) se o documento não couber. opts.salvar === false não baixa o arquivo.
function gerarMaterialPrevio(a, opts) {
  opts = opts || {};
  var root = document.createElement('div');
  root.className = 'mpv';
  root.id = 'mpv-root';
  var antigo = document.getElementById('mpv-root');
  if (antigo) antigo.parentNode.removeChild(antigo);
  // Sonda: força o carregamento preguiçoso dos @font-face antes de medir.
  root.innerHTML = '<div class="page">' + MPV_FONT_FACES.map(function (f) {
    var m = /^(\d+) 10px "(.+)"$/.exec(f);
    return '<span style="font-family:&quot;' + m[2] + '&quot;;font-weight:' + m[1] + '">Ação</span>';
  }).join('') + '</div>';
  document.body.appendChild(root);
  function limpa() { if (root.parentNode && !window.__MPV_KEEP_DOM) root.parentNode.removeChild(root); }

  return mpvFontsReady().then(function () {
    root.innerHTML = mpvDocumentoHtml(a);
    return mpvImagensProntas(root).then(mpvFontsReady);
  }).then(function () {
    var erros = mpvFit(root);
    if (erros.length) throw new Error(erros.join(' '));
    var jsPDFNS = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var pdf = new jsPDFNS({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    pdf.setProperties({ title: 'Preparação para o Diagnóstico SIIGA · ' + a.empresa, author: 'Agilean',
      subject: 'Diagnóstico SIIGA · ' + a.empresa, creator: 'SIIGA Admin' });
    var pages = Array.prototype.slice.call(root.querySelectorAll(':scope > .page'));
    var fit = pages.map(function (p) { return +p.getAttribute('data-fit'); });
    var idx = 0;
    return new Promise(function (resolve, reject) {
      function next() {
        if (idx >= pages.length) { resolve({ pdf: pdf, paginas: pages.length, fit: fit }); return; }
        html2canvas(pages[idx], { scale: 2, useCORS: true, backgroundColor: '#FFFFFF', logging: false }).then(function (cv) {
          if (idx) pdf.addPage();
          pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
          idx++; next();
        }).catch(reject);
      }
      next();
    });
  }).then(function (r) {
    r.nome = mpvNomeArquivo(a);
    if (opts.salvar !== false) r.pdf.save(r.nome);
    limpa();
    return r;
  }, function (err) { limpa(); throw err; });
}

// ---------- mensagens (aprovadas no GATE 3; assinadas pelo pré-vendedor) ----------
// a.pre_vendedor = { nome }
function mpvMensagens(a) {
  var nome = mpvPrimeiroNome(a.contato);
  var quando = mpvDataLonga(a.data, false);
  var hora = mpvHora(a.hora);
  var cons = a.consultor.nome;
  var pv = a.pre_vendedor.nome;
  var decisorEmail = a.decisor || ('quem aprova a contratação na ' + a.empresa);
  var decisorCurto = a.decisor || 'quem aprova a contratação';

  var assunto = 'Diagnóstico SIIGA — ' + a.empresa + ', ' + mpvDataCurta(a.data) + ' às ' + hora;
  var email = nome + ', confirmado o Diagnóstico SIIGA da ' + a.empresa + ' para ' + quando + ', às ' + hora +
      (a.link ? ', por videochamada: ' + a.link : '.') + '\n' +
    'A reunião será conduzida por ' + cons + ', consultor da Agilean.\n\n' +
    'Em anexo está a Preparação para o Diagnóstico: quem é a Agilean, como funciona a reunião e o que vocês recebem depois dela. A leitura leva 3 minutos e nos deixa a reunião inteira para falar das obras de vocês.\n\n' +
    'Um pedido: que ' + decisorEmail + ' participe dos 15 minutos finais. É nesse momento que definimos juntos a data da reunião de escopo.\n\n' +
    pv + '\nAgilean';
  var whats = nome + ', confirmado o Diagnóstico SIIGA da ' + a.empresa + ': ' + quando + ', às ' + hora + '.' +
      (a.link ? ' Link: ' + a.link : '') + '\n' +
    'Segue a preparação em PDF (3 minutos de leitura). Peço que ' + decisorCurto + ' participe dos 15 minutos finais, para definirmos a reunião de escopo. Quem conduz é ' + cons + ', consultor da Agilean.\n' +
    pv + ', Agilean';
  var lembrete = nome + ', amanhã às ' + hora + ' é o Diagnóstico SIIGA da ' + a.empresa + '.' + (a.link ? ' Link: ' + a.link : '') + '\n' +
    'Conto com ' + decisorCurto + ' nos 15 minutos finais. Até amanhã. ' + pv + ', Agilean';
  return { assunto: assunto, email: email, whats: whats, lembrete: lembrete };
}
