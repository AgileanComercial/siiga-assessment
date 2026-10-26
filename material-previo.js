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

// Os 30 logos do slide de portfólio (2026-10), na ordem do slide; w/h = tamanho do recorte
// original em px, usado para a altura óptica (área constante, limitada pela célula).
var MPV_LOGOS = [
  ['bambui', 'Bambuí', 251, 84], ['fama', 'Construtora Fama', 134, 84], ['ascen', 'Ascen', 350, 69],
  ['jsimoes', 'J.Simões', 256, 82], ['cortez', 'Cortez Engenharia', 288, 84], ['dimas', 'Dimas Construções', 352, 52],
  ['motamachado', 'Mota Machado', 317, 82], ['rb', 'RB Construtora', 268, 83], ['morana', 'Morana', 325, 82],
  ['azur', 'Azur', 234, 82], ['fontanive', 'Grupo Fontanive', 169, 83], ['vortex', 'Vórtex', 351, 77],
  ['bspar', 'BSPAR Incorporações', 351, 68], ['planoeplano', 'Plano&Plano', 352, 74], ['dalle', 'Dallé Incorporadora', 252, 84],
  ['diasdesousa', 'Dias de Sousa', 202, 83], ['trinus', 'Trinus', 235, 83], ['faenge', 'Faenge', 354, 68],
  ['alliance', 'Alliance', 352, 76], ['kprrodan', 'KPRRodan', 125, 86], ['fan', 'FAN Construções', 193, 83],
  ['sbr', 'SBR Empreendimentos', 191, 84], ['atr', 'ATR', 195, 85], ['mcdi', 'MCDI', 206, 82],
  ['doisa', 'DoisA', 274, 82], ['gpl', 'GPL Incorporadora', 163, 84], ['conx', 'CONX', 215, 84],
  ['realiza', 'Realiza Construtora', 281, 83], ['alfa', 'Alfa Construtora', 298, 82], ['cmm', 'CMM Engenharia', 218, 82]
];
var MPV_LOGO_AREA = 104, MPV_LOGO_WMAX = 24, MPV_LOGO_HMAX = 6.6; // mm², mm, mm

var MPV_PILARES = ['Planejamento estratégico do fluxo de produção', 'Proteção e garantia da execução do plano',
  'Gestão integrada da produção', 'Controle real e performance da produção'];

// Depoimentos aprovados, texto literal da proposta (ptpDepoimentos em proposta-prancha.js).
var MPV_DEPOIMENTOS = [
  ['“Uma das maiores vantagens que o Agilean nos trouxe foi a capacidade de rastrear e monitorar o progresso das nossas obras em tempo real, permitindo decisões rápidas com dados confiáveis de canteiro. Aumentamos consideravelmente o cumprimento dos prazos.”',
    'Alessandra Silva', 'Coordenação de Planejamento e Controle · CONX', 'https://www.youtube.com/watch?v=cxprJ6c4Z70'],
  ['“O Agilean nos trouxe praticidade e soluções reais para acompanhar a mão de obra em grandes construções. Nossas obras têm entre 150 e 200 pessoas e era um desafio gerenciar e integrar todos os recursos. Agora tenho tempo para analisar, criar estratégias e focar no que agrega valor.”',
    'Natalia V. de Dios', 'Gerência de Processos e Qualidade · Dimas Construções', 'https://www.youtube.com/watch?v=nkNP6LssCzE']
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
  }).join('');
}

function mpvDocumentoHtml(a) {
  var emp = mpvEsc(a.empresa);
  var quemDecide = a.decisor ? mpvEsc(a.decisor) + (a.decisor_cargo ? ', ' + mpvEsc(a.decisor_cargo) + ',' : '') : 'Quem aprova a contratação';
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
    '<div class="nums"><div><b>70 mi</b><span>m² construídos com Agilean</span></div><div><b>+5.000</b><span>canteiros impactados</span></div>' +
    '<div><b>+5 mil</b><span>gestores usando por dia</span></div><div><b>25%</b><span>de ganho médio de produtividade</span></div></div>' +
    '</div>' + mpvCarimbo(a, 1) + '</div>';

  var pil = MPV_PILARES.map(function (p, i) { return '<div><span>Pilar ' + (i + 1) + '</span>' + p + '</div>'; }).join('');
  var deps = MPV_DEPOIMENTOS.map(function (d) {
    return '<div class="dep"><p>' + d[0] + '</p><div class="quem"><b>' + d[1] + '</b>' + d[2] + '</div>' +
      (d[3] ? '<div class="vid" data-url="' + d[3] + '"><b>Assistir ao vídeo do case</b>' + d[3].replace(/^https:\/\/www\./, '') + '</div>' : '') + '</div>';
  }).join('');
  var p2 = '<div class="page">' + mpvRun(a, 'O Diagnóstico') +
    '<div class="sec row" style="margin-top:7mm"><div class="secnum">02</div><div><div class="sectit">O Diagnóstico SIIGA</div>' +
    '<p class="lead">O Diagnóstico SIIGA avalia a gestão das obras da ' + emp + ' em quatro pilares.</p>' +
    '<div class="pil">' + pil + '</div>' +
    '<p class="txt">As respostas vêm da conversa com a equipe na Reunião 1. Com elas, o diagnóstico mostra os pontos críticos, estima quanto cada obra perde por mês sem tratá-los e organiza o Plano de Transformação Operacional em três Fases de Implementação.</p>' +
    '</div></div>' +
    '<div class="sec row"><div class="secnum">03</div><div><div class="sectit">Como funciona</div></div></div>' +
    '<div class="tl two">' +
      '<div class="m"><h3>Reunião 1 · Diagnóstico</h3><div class="q">' + mpvDataCurta(a.data) + ', ' + mpvHora(a.hora) + ' · cerca de 55 minutos</div>' +
        '<ul><li>Conversa com o responsável pelo planejamento e controle das obras sobre a rotina de vocês.</li>' +
        '<li>Leitura do Relatório do Diagnóstico, enviado em PDF após a reunião: a avaliação por pilar, os pontos críticos com a prioridade de cada um e a perda por mês sem tratamento.</li>' +
        '<li>O Plano de Transformação Operacional e o ganho mensal esperado com ele.</li></ul></div>' +
      '<div class="m sec2"><h3>Reunião 2 · Escopo</h3><div class="q">Data combinada na Reunião 1</div>' +
        '<ul><li>Apresentação do desenho do escopo do programa, para validação com vocês, a partir dos pontos críticos do diagnóstico.</li>' +
        '<li>' + quemDecide + ' participa como decisor.</li></ul></div>' +
    '</div>' +
    '<div class="sec row"><div class="secnum">04</div><div><div class="sectit">Depoimentos de clientes Agilean</div></div></div>' +
    '<div class="deps">' + deps + '</div>' +
    mpvCarimbo(a, 2) + '</div>';
  return p1 + p2;
}

// Clickable areas: the page is an image, so each [data-url] element gets a PDF link at the same place (mm).
function mpvLinks(pdf, page) {
  var pr = page.getBoundingClientRect(), k = 210 / pr.width;
  Array.prototype.forEach.call(page.querySelectorAll('[data-url]'), function (el) {
    var r = el.getBoundingClientRect();
    pdf.link((r.left - pr.left) * k, (r.top - pr.top) * k, r.width * k, r.height * k, { url: el.getAttribute('data-url') });
  });
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
  var emp = String(a.empresa).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 40).replace(/_+$/, '');
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
          mpvLinks(pdf, pages[idx]);
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
// Os textos abaixo são os PADRÕES. Na aba Agendamentos o time pode editá-los
// ("Modelos de mensagem"); o texto editado fica na tabela mensagens_modelos do
// Supabase e vale para todos. Variáveis entre chaves, trocadas sempre em texto puro.
// Linha que contém {link} some inteira quando o agendamento não tem link.
var MPV_MODELOS_CHAVES = ['email_assunto', 'email_corpo', 'whatsapp_agendamento', 'whatsapp_lembrete'];
var MPV_MODELOS_ROTULOS = {
  email_assunto: 'E-mail · assunto', email_corpo: 'E-mail · corpo',
  whatsapp_agendamento: 'WhatsApp de agendamento', whatsapp_lembrete: 'WhatsApp de lembrete (24 h antes)'
};
var MPV_MODELOS_PADRAO = {
  email_assunto: 'Diagnóstico SIIGA — {empresa}, {data_curta} às {hora}',
  email_corpo: '{contato}, confirmado o Diagnóstico SIIGA da {empresa} para {data_longa}, às {hora}.\n' +
    'Videochamada: {link}\n' +
    'A reunião será conduzida por {consultor}, consultor da Agilean.\n\n' +
    'Em anexo está a Preparação para o Diagnóstico: quem é a Agilean, como funciona a reunião e o que vocês recebem depois dela. A leitura leva 3 minutos e nos deixa a reunião inteira para falar das obras de vocês.\n\n' +
    'Ao fim da conversa combinamos a data da reunião de escopo, da qual {quem_aprova_na_empresa} participa como decisor.\n\n' +
    '{pre_vendedor}\nAgilean',
  whatsapp_agendamento: '{contato}, confirmado o Diagnóstico SIIGA da {empresa}: {data_longa}, às {hora}.\n' +
    'Link: {link}\n' +
    'Segue a preparação em PDF (3 minutos de leitura). Quem conduz é {consultor}, consultor da Agilean. Ao fim da conversa combinamos a data da reunião de escopo, com {quem_aprova} como decisor.\n' +
    '{pre_vendedor}, Agilean',
  whatsapp_lembrete: '{contato}, amanhã às {hora} é o Diagnóstico SIIGA da {empresa}.\n' +
    'Link: {link}\n' +
    'Até amanhã. {pre_vendedor}, Agilean'
};
var MPV_VARIAVEIS = [
  ['contato', 'primeiro nome do contato'], ['contato_completo', 'nome completo do contato'], ['empresa', 'empresa'],
  ['data_longa', 'quinta-feira, 29 de outubro'], ['data_curta', '29/10/2026'], ['hora', '14h'], ['link', 'link da videochamada'],
  ['consultor', 'consultor especialista'], ['pre_vendedor', 'quem assina e envia'],
  ['quem_aprova', 'decisor ou "quem aprova a contratação"'],
  ['quem_aprova_na_empresa', 'decisor ou "quem aprova a contratação na {empresa}"']
];

function mpvVariaveis(a) {
  return {
    contato: mpvPrimeiroNome(a.contato), contato_completo: String(a.contato || '').trim(), empresa: a.empresa,
    data_longa: mpvDataLonga(a.data, false), data_curta: mpvDataCurta(a.data), hora: mpvHora(a.hora), link: a.link || '',
    consultor: a.consultor.nome, pre_vendedor: a.pre_vendedor.nome,
    quem_aprova: a.decisor || 'quem aprova a contratação',
    quem_aprova_na_empresa: a.decisor || ('quem aprova a contratação na ' + a.empresa)
  };
}
// Nomes de variável usados no texto que não existem. [] = modelo válido.
function mpvVariaveisDesconhecidas(texto) {
  var conhecidas = MPV_VARIAVEIS.map(function (v) { return v[0]; }), ruins = [];
  String(texto || '').replace(/\{([^{}]*)\}/g, function (m, nome) {
    if (conhecidas.indexOf(nome) < 0 && ruins.indexOf(nome) < 0) ruins.push(nome);
    return m;
  });
  return ruins;
}
// Troca em uma só passagem (o valor inserido nunca é reinterpretado). Variável
// desconhecida fica como está. Sem link, a linha com {link} é removida.
function mpvRender(modelo, vars) {
  var linhas = String(modelo || '').replace(/\r\n?/g, '\n').split('\n');
  if (!vars.link) linhas = linhas.filter(function (l) { return l.indexOf('{link}') < 0; });
  return linhas.join('\n').replace(/\{([^{}]*)\}/g, function (m, nome) {
    return Object.prototype.hasOwnProperty.call(vars, nome) ? vars[nome] : m;
  });
}
// a.pre_vendedor = { nome }; modelos = { chave: texto } (os que faltam usam o padrão).
function mpvMensagens(a, modelos) {
  modelos = modelos || {};
  var vars = mpvVariaveis(a);
  function m(ch) { return mpvRender(typeof modelos[ch] === 'string' && modelos[ch].trim() ? modelos[ch] : MPV_MODELOS_PADRAO[ch], vars); }
  return { assunto: m('email_assunto').replace(/\s*\n\s*/g, ' ').trim(), email: m('email_corpo'),
    whats: m('whatsapp_agendamento'), lembrete: m('whatsapp_lembrete') };
}
