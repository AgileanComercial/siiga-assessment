// ═══════════════════════════════════════════════════════════════════════
//  SIIGA report PDF - Direction A "Prancha técnica"
//  Reproduces the approved pilot (revisao_relatorio/piloto_v3) from the live
//  diagnostic state S. PDF engine stays html2canvas + jsPDF (image PDF).
//
//  Calculation logic is NOT touched here: every number comes from the
//  existing engines in script.js (getMaturityScoreSummary, calculateROI,
//  getGapPlan, calcROIReal). The only new derivations are display-only:
//    - loss per month without treatment = source loss ÷ project months
//    - total Map loss ÷ project months (context line)
//  Formulas appear only in the DETALHADO variant.
//  Depends on globals from script.js; loaded after it in index.html.
// ═══════════════════════════════════════════════════════════════════════

// ── Display tables (labels only, no calculation) ─────────────────────────

// Practice name per question code, written to read after
// "Implantação " (score 0) or "Digitalização " (score > 0).
var PT_PRATICA = {
  'F1.1':'da aprovação da linha de base do planejamento',
  'F1.2':'da técnica de planejamento',
  'F1.3':'do cálculo de duração dos pacotes por produtividade',
  'F1.4':'do vínculo entre orçamento e planejamento',
  'F1.5':'do cronograma de compras vinculado ao planejamento',
  'F1.6':'do acompanhamento da Curva S',
  'F1.7':'do cronograma bancário',
  'F2.1':'do lookahead e da antecipação de restrições',
  'F2.2':'do lookahead de mão de obra',
  'F2.3':'da reprogramação com base no avanço apontado',
  'F3.1':'da programação semanal',
  'F3.2':'de check-out, check-in e causa raiz diária',
  'F3.3':'da coleta do avanço',
  'F3.4':'da FVS vinculada ao avanço físico',
  'F3.5':'da análise intermediária de PPC e prazo',
  'F4.1':'do fechamento técnico de período',
  'F4.2':'dos indicadores da reunião executiva com diretoria',
  'F4.3':'do painel integrado de indicadores',
  'F4.4':'do controle financeiro do fechamento (ERP)',
  'MO.1':'do quadro de metas das equipes',
  'MO.2':'do registro de improdutividade',
  'MO.3':'da gestão de aditivos de verba',
  'MO.4':'do fechamento de folha',
  'MO.5':'do acompanhamento de metas dos empreiteiros',
  'MO.6':'da comunicação de bloqueios de pagamento',
  'MO.7':'do fechamento de medição'
};

// Consequence shown in the critical-point block (neutral tone, from GAP_INFO).
var PT_CONSEQ = {
  'F1.1':'Sem aprovação formal antes do início, decisões que deveriam estar fechadas na largada ficam para a execução.',
  'F1.2':'Sem Linha de Balanço por lotes, os gargalos não ficam visíveis com antecedência e o dimensionamento de equipes depende da experiência individual.',
  'F1.3':'Sem cálculo por quantidade e produtividade, a duração de cada pacote nasce de estimativa e o desvio só aparece quando o atraso já aconteceu.',
  'F1.4':'Com orçamento e planejamento desconectados, o desvio de custo só aparece no fechamento.',
  'F1.5':'Sem cronograma de compras ligado ao planejamento, as compras ficam reativas e aumentam as paradas por falta de material.',
  'F1.6':'Sem leitura da Curva S com projeção de término, o desvio de prazo é identificado semanas depois e sem decisão estruturada de recuperação.',
  'F1.7':'Com o cronograma bancário fora do planejamento, cada reprogramação é refeita em dois documentos e a exposição de caixa não fica visível.',
  'F2.1':'Sem antecipação de restrições, problemas de material, projeto ou frente liberada aparecem quando já pararam a produção.',
  'F2.2':'Equipe não confirmada para as próximas semanas é risco de parada por falta de mão de obra.',
  'F2.3':'Sem ciclo formal de reprogramação, os mesmos desvios se acumulam de mês em mês sem correção.',
  'F3.1':'Sem programação semanal ligada ao médio prazo, a semana começa sem metas por equipe e a decisão atrasa um ciclo.',
  'F3.2':'Sem rotina diária com registro de causa, os desvios do canteiro chegam à engenharia de forma descoordenada e se repetem.',
  'F3.3':'Com o avanço físico coletado com baixa frequência, o dado chega semanas depois e a improdutividade fica invisível até o fechamento.',
  'F3.4':'Sem vínculo entre inspeção e avanço, o avanço registrado pode incluir serviço que ainda precisa de retrabalho.',
  'F3.5':'Sem análise intermediária de PPC, o desvio de prazo só é identificado no fechamento, quando já não há tempo de recuperação.',
  'F4.1':'Sem fechamento técnico estruturado, os dados do período não alimentam a reprogramação seguinte.',
  'F4.2':'Sem relatório executivo consolidado, a reunião com a diretoria se baseia em relatos e não termina com plano validado.',
  'F4.3':'Sem painel único, é preciso compilar manualmente prazo, custo e qualidade antes de cada reunião.',
  'F4.4':'Sem fluxo de aprovação integrado ao ERP, o fechamento é pago por estimativa ou negociação, sem rastreabilidade.',
  'MO.1':'Sem o valor da tarefa definido antes do início, a equipe não tem meta clara para se comprometer.',
  'MO.2':'Sem relatório de produção por funcionário, o custo da improdutividade não tem responsável.',
  'MO.3':'Verba extra aprovada só depois de executada distorce o custo real de cada serviço e cria passivo de ajuste.',
  'MO.4':'Cada dia de engenharia no fechamento de folha é um dia a menos de gestão da obra.',
  'MO.5':'Sem meta formal ligada ao planejamento, o empreiteiro trabalha no próprio ritmo, não no ritmo da obra.',
  'MO.6':'O empreiteiro descobre a pendência de qualidade só no fechamento, o que gera conflito na medição.',
  'MO.7':'Medição de empreiteiros que leva dias para fechar é definida por negociação, não por registro.'
};

// Implementation Phase per question code (I = routines 1, 2 + Pilar 4;
// II = routines 3 and 6; III = routines 4 and 5). Used for critical and
// "imediata/programada" points; points in ACOMPANHAMENTO get no phase.
var PT_FASE = {
  'F1.1':'I','F1.2':'I','F1.3':'I','F1.4':'I','F1.5':'I','F1.6':'I','F1.7':'II',
  'F2.1':'I','F2.2':'I','F2.3':'I',
  'F3.1':'I','F3.2':'I','F3.3':'I','F3.4':'II','F3.5':'I',
  'F4.1':'I','F4.2':'I','F4.3':'I','F4.4':'II',
  'MO.1':'III','MO.2':'III','MO.3':'III','MO.4':'III','MO.5':'III','MO.6':'III','MO.7':'III'
};

var PT_FONTE_LABEL = {
  time:'Horas do time de gestão', retrabalho:'Retrabalho', velocidade:'Custos proporcionais ao prazo',
  erros:'Erros de medição e folha', mo:'Estouro de mão de obra'
};
// Basis of each loss source, without formula (allowed in RESUMIDO: data + rates).
var PT_FONTE_BASE = {
  time:'Horas de gestão informadas e hora técnica de referência (R$ 115/h).',
  timeRef:'Referência de mercado de horas de gestão (horas não informadas) e hora técnica de referência (R$ 115/h).',
  retrabalho:'Orçamento da obra informado e referência de mercado de retrabalho (10%).',
  velocidade:'Orçamento da obra informado e referência de mercado de ganho de prazo (10%).',
  erros:'Orçamento da obra informado, mão de obra como 45% do custo e desvio médio de medição e folha (5%).',
  mo:'Orçamento da obra informado, mão de obra como 45% do custo e estouro médio de mercado (15%).'
};
var PT_PILAR_NOME = { f1:'Planejamento estratégico', f2:'Proteção da execução', f3:'Gestão da produção', f4:'Controle e performance' };
var PT_MERCADO = { f1:0.70, f2:0.62, f3:0.55, f4:0.58 }; // same values as the radar benchmark
var PT_TIPOLOGIA = { vert:'Residencial vertical', horiz:'Residencial horizontal', mcmv:'MCMV / Habitação popular', com:'Comercial / industrial', div:'Portfólio diversificado' };
var PT_NUM_EXT = { 1:'um', 2:'dois', 3:'três', 4:'quatro', 5:'cinco' };

var PT_FASES = [
  { id:'I', nome:'Planejamento e Controle Integrado com o Canteiro', rot:'Rotinas 1 e 2 e Pilar 4 (painéis)',
    dur:'até 60 dias (dia 0 a 60)', fd:'Até 60 dias. Linha de Balanço, apontamento diário, lookahead e painéis de indicadores.' },
  { id:'II', nome:'Integração com o ERP e o Sistema de Qualidade', rot:'Rotinas 3 e 6',
    dur:'até 60 dias, em paralelo à Fase I', fd:'Até 60 dias, em paralelo à Fase I. FVS digital vinculada ao avanço e integração com o sistema de gestão.' },
  { id:'III', nome:'Controle de Pagamento da Mão de Obra Integrado', rot:'Rotinas 4 e 5',
    dur:'até 90 dias, após as Fases I e II (cerca do dia 60 ao 150)', fd:'Até 90 dias, após as Fases I e II. Medição de empreiteiros e fechamento de folha por evidência de avanço.' }
];

var PT_VERSAO = '1.0';
var PT_LOGO = 'img/agilean_logo_relatorio.png';

// ── Formatting helpers (pt-BR) ───────────────────────────────────────────
function ptEsc(t) { return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ptNum(v, minD, maxD) { return (Math.round((v || 0) * Math.pow(10, maxD)) / Math.pow(10, maxD)).toLocaleString('pt-BR', { minimumFractionDigits: minD, maximumFractionDigits: maxD }); }
// "R$ 172,5 mil" / "R$ 10,25 mil" / "R$ 1,25 mi" (min 1 decimal)
function ptMil(v, maxD) {
  maxD = maxD == null ? 1 : maxD;
  if (Math.abs(v) >= 1e6) return 'R$ ' + ptNum(v / 1e6, 1, 2) + ' mi';
  if (Math.abs(v) >= 1000) return 'R$ ' + ptNum(v / 1000, 1, maxD) + ' mil';
  return 'R$ ' + ptNum(v, 0, 0);
}
// "R$ 526 mil" / "R$ 1,2 mi" (rounded, for leads)
function ptMilInt(v) {
  if (Math.abs(v) >= 1e6) return 'R$ ' + ptNum(v / 1e6, 0, 1) + ' mi';
  if (Math.abs(v) >= 1000) return 'R$ ' + ptNum(v / 1000, 0, 0) + ' mil';
  return 'R$ ' + ptNum(v, 0, 0);
}
// "R$ 3,5 mi" / "R$ 100 mil" (informed amounts)
function ptMilVar(v) {
  if (Math.abs(v) >= 1e6) return 'R$ ' + ptNum(v / 1e6, 0, 2) + ' mi';
  if (Math.abs(v) >= 1000) return 'R$ ' + ptNum(v / 1000, 0, 1) + ' mil';
  return 'R$ ' + ptNum(v, 0, 0);
}
function ptPct(p) { return Math.round(p * 100) + '%'; }
function ptHoras(h) { return ptNum(h, 0, 1) + ' h'; }
function ptMult(x) { return ptNum(x, 1, 1) + '×'; }
function ptPad(n) { return (n < 10 ? '0' : '') + n; }
function ptCap(t) { t = String(t || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
function ptLow(t) { t = String(t || '').trim(); return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
function ptDataBR(d) {
  if (!d) return '';
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : String(d);
}
// List "04, 05 e 06"
function ptLista(arr) { return arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1]; }
// Non-breaking space between currency/number and unit (text nodes only).
function ptNb(html) {
  return html.split(/(<[^>]+>)/).map(function(p) {
    if (p.charAt(0) === '<') return p;
    return p.replace(/R\$ (?=\d)/g, 'R$$&nbsp;').replace(/(\d) (mil|mi|h\/mês|h|meses|dias|%)(?![\wÀ-ú])/g, '$1&nbsp;$2');
  }).join('');
}
// "para a Construtora X" / "para Empresa Y"
function ptArtigo(nome) { return /^(construtora|incorporadora|empresa)\b/i.test(nome) ? 'a ' : ''; }
// Display-only: the app stores the company name in uppercase (input mask).
// Only when the whole name is uppercase: connectors lowercase, words of up to
// 3 letters kept as acronyms (PCL, MRV), other words capitalized.
function ptNomeEmpresa(nome) {
  nome = String(nome || '').trim().replace(/\s+/g, ' ');
  if (!nome || nome !== nome.toUpperCase() || !/[A-ZÀ-Ú]/.test(nome)) return nome;
  var conect = { DE:1, DA:1, DO:1, DAS:1, DOS:1, E:1 };
  return nome.split(' ').map(function(w, i) {
    if (i > 0 && conect[w]) return w.toLowerCase();
    if (w.replace(/[^A-ZÀ-Ú]/g, '').length <= 3) return w;
    return w.charAt(0) + w.slice(1).toLowerCase();
  }).join(' ');
}
function ptToken(name) {
  var el = document.querySelector('.ptr') || document.documentElement;
  return (getComputedStyle(el).getPropertyValue(name) || '').trim();
}

// ── Data model (read-only use of the existing engines) ───────────────────
function ptModel(mode) {
  var det = (mode !== 'resumido');
  var roi = calculateROI();
  var plan = getGapPlan(roi);
  var obras = S.numObras || 5, orc = S.orcamentoMedio || 8000000, prazo = S.prazoMedio || 18;
  var mo = S.modeloMO || '';
  var score = getMaturityScoreSummary();
  var cons = calcROIReal(ROI_CAPTURA_FIXA), pleno = calcROIReal(1.0), pess = calcROIReal(0.30);
  var empresa = ptNomeEmpresa(S.empresa || 'Empresa');

  // Pillars and most critical pillar (lowest % of max score, one rule everywhere)
  var pilares = ['f1','f2','f3','f4'].map(function(k, i) {
    var arr = S.scores[k];
    var pts = Array.isArray(arr) ? arr.reduce(function(a,b){ return a + (b || 0); }, 0) : 0;
    var max = SCORE_MAX_PILAR[k];
    return { k:k, n:i + 1, nome:PT_PILAR_NOME[k], pts:pts, max:max, pct:max ? pts / max : 0, mkt:PT_MERCADO[k] };
  });
  var worst = pilares.slice().sort(function(a,b){ return (a.pct - b.pct) || (a.n - b.n); })[0];

  // Loss sources (per project, raw = baseValue; capturable = porObra)
  var fontes = {};
  roi.items.forEach(function(it) {
    var label = PT_FONTE_LABEL[it.key] || it.label;
    var labelTab = (it.key === 'mo' && mo === 'mista') ? label + ' (50% própria)' : label;
    fontes[it.key] = { key:it.key, label:label, labelTab:labelTab, perda:it.baseValue, cap:it.porObra, fator:it.fator,
      mes:it.baseValue / prazo, basis:it.basis };
  });

  // Points: critical (anchors), imediata/programada (rest), acompanhamento (attention)
  var top3 = plan.top3;
  var prio = function(o) { return top3.indexOf(o.fonte) >= 0 ? 'IMEDIATA' : 'PROGRAMADA'; };
  var pilarLbl = function(o, longo) { return o.bk === 'mo' ? 'Mão de obra' : (longo ? 'Pilar ' : 'P') + o.bk.charAt(1); };
  var titulo = function(o) { return (o.score === 0 ? 'Implantação ' : 'Digitalização ') + (PT_PRATICA[o.code] || ('de ' + ptLow(o.gap))); };
  var fonteVista = {};
  var criticos = plan.anchors.map(function(o, i) {
    var f = fontes[o.fonte];
    var first = !fonteVista[o.fonte];
    fonteVista[o.fonte] = fonteVista[o.fonte] || (i + 1);
    var q = findQ(o.bk, o.code);
    var opt = q && q.opts ? q.opts.filter(function(x){ return x.score === o.score; })[0] : null;
    var situacao = opt ? (ptCap(opt.l) + (opt.s ? '; ' + ptLow(opt.s) : '')).replace(/\s+—\s+/g, ', ').replace(/[.;,\s]+$/, '') + '.' : '';
    var frase = o.frase ? ptCap(o.frase).replace(/[.\s]+$/, '') + '.' : '';
    var cs = FONTE_CASE[o.fonte];
    return {
      n:i + 1, code:o.code, titulo:titulo(o), pilar:pilarLbl(o, true), fase:PT_FASE[o.code] || '',
      prioridade:prio(o), star:o.star, frase:frase, situacao:situacao,
      conseq:PT_CONSEQ[o.code] || (GAP_INFO[o.code] || {}).impact || '',
      fonte:f, mes:first ? f.mes : null,
      base:(o.fonte === 'time' && !roi.horasDoCliente) ? PT_FONTE_BASE.timeRef : (PT_FONTE_BASE[o.fonte] || ''),
      dep:(cs && cs.quote) ? cs.quote.replace(/^…\s*([a-zà-ú])/, function(m, c){ return '…' + c.toUpperCase(); }) : '',
      depA:(cs && cs.quote) ? (cs.nome + ' · ' + cs.papel) : ''
    };
  });
  var nCrit = criticos.length;
  var demais = plan.rest.map(function(o, i) {
    return { n:nCrit + i + 1, code:o.code, titulo:titulo(o), pilar:pilarLbl(o, false), fonte:fontes[o.fonte],
      prioridade:o.prioridade === 'Alta' ? 'IMEDIATA' : 'PROGRAMADA', fase:PT_FASE[o.code] || '' };
  });
  var acomp = plan.attention.map(function(o, i) {
    return { n:nCrit + demais.length + i + 1, titulo:titulo(o), pilar:pilarLbl(o, false) };
  });
  var critFonteKeys = Object.keys(fonteVista);
  var critPerda = critFonteKeys.reduce(function(a, k){ return a + fontes[k].perda; }, 0);
  var critMes = critPerda / prazo;

  // Monthly loss x gain (ROI model): full scenario as the loss, 50% as the gain
  var comp = function(r) { return { horas:r.estrategica.valorCapacidade, retr:r.estrategica.rec2, indev:r.estrategica.rec3,
    total:r.estrategica.valorCapacidade + r.estrategica.recTotal }; };

  var f = S.ferramentas || {};
  return {
    det:det, empresa:empresa, art:ptArtigo(empresa), data:ptDataBR(S.data), versao:PT_VERSAO,
    entrevistado:[S.contato, S.cargo].filter(Boolean).join(', '), contato:S.contato || '', cargo:S.cargo || '',
    consultor:S.consultor || '', obras:obras, orc:orc, prazo:prazo, mo:mo,
    moTxt:mo === 'propria' ? 'MO própria' : (mo === 'mista' ? 'MO mista' : (mo === 'terceirizada' ? 'MO terceirizada' : '')),
    moLongo:mo === 'propria' ? 'mão de obra própria' : (mo === 'mista' ? 'mão de obra mista' : (mo === 'terceirizada' ? 'mão de obra terceirizada' : '')),
    tipologia:PT_TIPOLOGIA[S.tipologia] || '',
    score:score, pilares:pilares, worst:worst, roi:roi, plan:plan, fontes:fontes,
    criticos:criticos, demais:demais, acomp:acomp, totalAvaliados:plan.all.length,
    critPerda:critPerda, critMes:critMes, mapaMes:roi.totalBase / prazo,
    cons:cons, pleno:pleno, pess:pess, perdaMes:comp(pleno), ganhoMes:comp(cons), ganhoPess:comp(pess),
    folha:(S.roi2 && S.roi2.folha) || 0, horasInf:cons.operacional.horasInformadas, horasPot:cons.operacional.potPleno,
    ferr:f
  };
}

// ── Page fragments ───────────────────────────────────────────────────────
function ptSt(cls, word) { return '<span class="st ' + cls + '"><i></i>' + word + '</span>'; }
function ptStCls(p) { return p < 0.40 ? 'c' : (p < 0.90 ? 'a' : 'o'); }
function ptStWord(p) { return p < 0.40 ? 'Crítico' : (p < 0.90 ? 'Parcial' : 'Estruturado'); }
function ptSec(num, titulo, first) {
  return '<div class="row sec' + (first ? ' first' : '') + '"><div class="secnum">' + num + '</div><div class="sectit">' + titulo + '</div></div>';
}
function ptDocNome(M) { return M.det ? 'Relatório detalhado' : 'Relatório resumido'; }
function ptCarimbo(M, n, total) {
  return '<div><img src="' + PT_LOGO + '" alt="Agilean"></div>' +
    '<div><span class="k">Documento</span><b>Diagnóstico SIIGA · ' + ptEsc(M.empresa) + '</b> · ' + ptDocNome(M) + '</div>' +
    '<div><span class="k">Classificação</span>Confidencial · uso restrito ' + ptEsc(M.empresa) + '</div>' +
    '<div><span class="k">Versão</span>' + M.versao + '</div><div><span class="k">Data</span>' + M.data + '</div>' +
    '<div><span class="k">Folha</span><b>' + ptPad(n) + '</b> / ' + ptPad(total) + '</div>';
}
function ptObrasTxt(M) { return M.obras === 1 ? '1 obra' : M.obras + ' obras'; }
function ptPorObra(M) { return M.obras === 1 ? 'na obra' : 'por obra'; }
function ptPlano06(M) { return 'Plano de Transformação Operacional para ' + M.art + ptEsc(M.empresa); }

// ── Sections (each returns a list of flow blocks) ─────────────────────────
// Block: { sec, html | rows+render, breakBefore, cls }
function ptSecResumo(M) {
  var bars = M.pilares.map(function(p) {
    var w = p === M.worst;
    var pct = Math.round(p.pct * 100);
    return '<div class="bar"><div class="nm"><span class="pn' + (w ? ' b6' : '') + '">' + p.nome + '</span>' +
      '<span class="ps">Pilar ' + p.n + ' · ' + ptNum(p.pts, 0, 1) + ' de ' + p.max + '</span></div>' +
      '<div class="trk"><div class="fill" style="width:' + Math.min(100, pct) + '%"></div><div class="mkt" style="left:' + Math.round(p.mkt * 100) + '%"></div></div>' +
      '<div class="val">' + (w ? '<b class="b6">' + pct + '%</b>' : pct + '%') + '</div>' +
      '<div class="stt">' + ptSt(ptStCls(p.pct), ptStWord(p.pct)) + '</div></div>';
  }).join('');
  var nC = M.criticos.length;
  var ext = PT_NUM_EXT[nC] || String(nC);
  var crit = M.criticos.map(function(c) {
    return '<tr><td>' + c.n + '</td><td><span class="b6">' + c.titulo + '</span>' + (c.frase ? '<span class="q">“' + ptEsc(c.frase.replace(/\.$/, '')) + '.”</span>' : '') + '</td>' +
      '<td>' + c.pilar + '</td><td>' + (c.fase ? 'Fase ' + c.fase : '—') + '</td><td><b class="b6">' + c.prioridade + '</b></td>' +
      '<td class="n">' + (c.mes != null ? ptMil(c.mes, 1) : '—') + '</td></tr>';
  }).join('');
  var pctCrit = M.roi.totalBase ? Math.round(M.critPerda / M.roi.totalBase * 100) : 0;
  var lead = 'A perda estimada ' + ptPorObra(M) + ' é de <b>' + ptMilInt(M.roi.totalBase) + '</b> em ' + M.prazo + ' meses' +
    (M.obras > 1 ? ' (' + ptMilInt(M.roi.totalBase * M.obras) + ' no portfólio de ' + M.obras + ' obras)' : '') +
    '; as fontes de perda ligadas a ' + (nC === 1 ? 'um ponto crítico respondem' : ext + ' pontos críticos respondem') +
    ' por <b>' + ptMilInt(M.critPerda) + '</b> (' + pctCrit + '%).';
  var escopo = [ptObrasTxt(M), ptMilVar(M.orc) + (M.obras > 1 ? ' por obra' : ''), M.prazo + ' meses', M.moTxt].filter(Boolean).join(' · ');
  var srcCrit = M.det
    ? 'Perda por mês = perda da fonte em ' + M.prazo + ' meses ÷ ' + M.prazo + ' (seção 05); valor mostrado no ponto crítico que recebe a fonte.'
    : 'Perda mensal estimada da fonte de perda associada a cada ponto crítico (seção 05).';
  var nDemais = M.demais.length + M.acomp.length;
  if (nDemais) srcCrit += ' Demais pontos avaliados (' + nDemais + '): seção 04.';
  var frase = 'Cada mês sem tratar ' + (nC === 1 ? 'o ponto crítico' : 'os ' + nC + ' pontos críticos') + ' custa ' + ptMilInt(M.critMes) + (M.obras > 1 ? ' a cada obra.' : ' à obra.');
  var meta = '<div class="meta" style="margin-top:5mm">' +
    (M.entrevistado ? '<div><span class="lbl">Entrevistado</span>' + ptEsc(M.entrevistado) + '</div>' : '') +
    (M.consultor ? '<div><span class="lbl">Consultor</span>' + ptEsc(M.consultor) + ', Agilean</div>' : '') +
    (M.data ? '<div><span class="lbl">Data</span>' + M.data + '</div>' : '') +
    '<div><span class="lbl">Escopo</span>' + escopo + '</div></div>';

  var b1 = ptSec('01', 'Resumo executivo', true) +
    '<div class="row" style="margin-top:5mm"><div>' +
      '<div class="lbl">Score de maturidade</div>' +
      '<div class="score">' + ptNum(M.score.score, 0, 1) + '<small>/' + M.score.max + '</small></div>' +
      '<div style="margin-top:1mm">' + ptSt(ptStCls(M.score.pct), M.score.nivel) + '</div>' +
      '<div class="note" style="margin-top:.6mm">' + ptPct(M.score.pct) + ' da pontuação máxima</div>' + meta +
    '</div><div>' +
      '<p class="lead">' + lead + '</p>' +
      '<div style="margin-top:6mm">' +
        '<div class="chart-t">' + M.worst.nome + ' é o pilar de menor maturidade, com ' + Math.round(M.worst.pct * 100) + '% da pontuação máxima</div>' +
        '<div class="bars">' + bars + '</div>' +
        '<div class="axis"><div></div><div class="ticks"><span style="left:0">0</span><span style="left:25%">25</span><span style="left:50%">50</span><span style="left:75%">75</span><span style="left:100%">100%</span></div><div></div><div></div></div>' +
        '<div class="leg"><span><i class="sw-cli"></i>' + ptEsc(M.empresa) + '</span><span><i class="sw-mkt"></i>Média de mercado</span><span><i class="sw-ref"></i>Referência SIIGA (100%)</span></div>' +
        '<div class="src">Unidade: % da pontuação máxima de cada pilar. Pilar mais crítico: menor percentual da pontuação máxima. Fonte: entrevista de diagnóstico' + (M.data ? ', ' + M.data : '') + '. Mercado: base SIIGA, construtoras de porte similar.</div>' +
      '</div></div></div>';
  var blocks = [{ sec:'01', html:b1 }];
  if (nC) {
    blocks.push({ sec:'01', html:'<div class="row sec"><div><div class="lbl rule">Pontos críticos</div><div class="note" style="margin-top:1.5mm">' + nC + ' de ' + M.totalAvaliados + ' pontos avaliados</div></div><div>' +
      '<table><thead><tr><th style="width:5mm">#</th><th>Ponto crítico</th><th style="width:15mm">Pilar / tema</th><th style="width:17mm">Fase de Implementação</th><th style="width:21mm">Prioridade</th><th class="n wrap" style="width:24mm">Perda por mês sem tratamento</th></tr></thead>' +
      '<tbody>' + crit + '<tr class="tot"><td></td><td>Total ' + (nC === 1 ? 'do ponto crítico' : 'dos ' + nC + ' pontos críticos') + '</td><td></td><td></td><td></td><td class="n">' + ptMil(M.critMes, 1) + '/mês</td></tr></tbody></table>' +
      '<p class="note" style="margin-top:2mm"><b class="b6">' + frase + '</b></p><div class="src">' + srcCrit + '</div></div></div>' });
  }
  blocks.push({ sec:'01', html:'<div class="row sec"><div><div class="lbl rule">Perda e ganho mensal</div></div><div>' +
    '<div class="strip"><div><div class="lbl">Perda em horas de gestão e folha</div><div class="big p">' + ptMil(M.perdaMes.total, 2) + '/mês</div></div>' +
    '<div><div class="lbl">Ganho mensal (' + ptPct(ROI_CAPTURA_FIXA) + ')</div><div class="big g">' + ptMil(M.ganhoMes.total, 2) + '</div></div>' +
    '<div><div class="lbl">× mensalidade ref.</div><div class="big">' + ptMult(M.ganhoMes.total / M.cons.mensalidade) + '</div></div></div>' +
    '<div class="src">Detalhamento e cenários: seção 02. Mensalidade de referência: ' + ptRefBRL(M.cons.mensalidade) + ' por obra.</div></div></div>' });
  return blocks;
}
function ptRefBRL(v) { return 'R$ ' + Math.round(v).toLocaleString('pt-BR'); }

function ptSecPerdaGanho(M) {
  var P = M.perdaMes, G = M.ganhoMes;
  var temFolha = (P.retr + P.indev) > 0;
  var cap = ptPct(ROI_CAPTURA_FIXA);
  var hRec = M.horasPot, hRecC = M.cons.operacional.hMes;
  var custoH = ROI_REAL_K.CUSTO_HORA_TECNICA;
  // chart: same scale for loss and gain bars
  var chart = '';
  if (P.total > 0) {
    var mx = P.total / 1000;
    var scale = mx * 1.366;
    // largest "nice" step (1, 2, 5 x 10^n) that still gives at least 5 ticks
    var mag = Math.pow(10, Math.floor(Math.log10(scale))), step = mag / 10;
    [10, 5, 2, 1, 0.5, 0.2, 0.1].some(function(m) { if (scale / (m * mag) >= 4.5) { step = m * mag; return true; } return false; });
    var w = function(v) { return (v / 1000 / scale * 100).toFixed(2) + '%'; };
    var stack = function(vals, cls) {
      var off = 0, out = '';
      vals.forEach(function(v, k) {
        if (v <= 0) return;
        var lab = ptNum(v / 1000, 1, 2);
        out += '<div class="seg ' + cls + (k + 1) + '" style="left:' + w(off) + ';width:' + w(v) + '">' + (k === 1 ? '<b>' + lab + '</b>' : lab) + '</div>';
        off += v;
      });
      return out;
    };
    var ticks = '';
    for (var t = 0; t <= scale + 1e-9; t += step) ticks += '<span style="left:' + (t / scale * 100).toFixed(2) + '%">' + ptNum(t, 0, 2) + '</span>';
    var comps = [[1, 'Horas do time técnico']];
    if (temFolha) comps.push([2, 'Retrabalho pago'], [3, 'Pagamentos indevidos']);
    var leg = comps.map(function(c){ return '<span class="pair"><i class="sw r' + c[0] + '"></i><i class="sw g' + c[0] + '"></i>' + c[1] + '</span>'; }).join('');
    chart = '<div style="margin-top:6mm;position:relative">' +
      '<div class="chart-t">Metade da perda em horas de gestão e folha é recuperável no cenário conservador</div>' +
      '<div class="sb"><div class="nm">Perda hoje<span>100% da base</span></div><div class="plot">' + stack([P.horas, P.retr, P.indev], 'r') + '</div></div>' +
      '<div class="sb"><div class="nm">Ganho<span>captura de ' + cap + '</span></div><div class="plot">' + stack([G.horas, G.retr, G.indev], 'g') + '</div></div>' +
      '<div class="ticks2">' + ticks + '</div>' +
      '<div class="leg2"><div><span class="pair"><i class="sw r1"></i>Vermelho: perda hoje</span><span class="pair"><i class="sw g1"></i>Verde: ganho no cenário conservador</span></div><div style="margin-top:1mm">' + leg + '</div></div>' +
      '<div class="src">Unidade: R$ mil por mês, 1 obra. Fonte: dados informados no diagnóstico' + (M.data ? ' (' + M.data + ')' : '') + ' e referências de mercado da seção 07.</div></div>';
  }
  var folhaTxt = ptMilVar(M.folha);
  var linhaHoras = M.horasInf > 0 ? ptHoras(M.horasInf).replace(' h', ' h/mês') + ' informadas, ' + ptHoras(hRec) + ' recuperáveis' : 'Horas não informadas no diagnóstico';
  var rows = [['Horas do time técnico em rotinas manuais', linhaHoras,
      'Cálculo: ' + ptHoras(hRec) + ' × R$ ' + custoH + '/h (ganho: ' + ptHoras(hRecC) + ' × R$ ' + custoH + '/h)', P.horas, G.horas]];
  if (temFolha) {
    rows.push(['Retrabalho pago na folha', 'Folha de ' + folhaTxt + '/mês', 'Cálculo: ' + folhaTxt + ' × 5% (ganho: × ' + cap + ')', P.retr, G.retr]);
    rows.push(['Pagamentos indevidos na folha', 'Folha de ' + folhaTxt + '/mês', 'Cálculo: ' + folhaTxt + ' × 5% × 80% (ganho: × ' + cap + ')', P.indev, G.indev]);
  }
  var compRows = rows.map(function(r) {
    return '<tr><td>' + r[0] + '</td><td>' + r[1] + (M.det ? '<span class="q">' + r[2] + '</span>' : '') + '</td><td class="n">' + ptMil(r[3], 2) + '</td><td class="n">' + ptMil(r[4], 2) + '</td></tr>';
  }).join('');
  var baseInf = '<div class="meta"><div class="lbl rule" style="margin-bottom:2.4mm">Base informada</div>' +
    '<div><span class="lbl">Horas de gestão</span>' + (M.horasInf > 0 ? ptNum(M.horasInf, 0, 1) + ' h/mês em 5 rotinas' : 'Não informadas') + '</div>' +
    (M.folha > 0 ? '<div><span class="lbl">Folha de produção</span>' + folhaTxt + '/mês</div>' : '') +
    '<div><span class="lbl">Hora técnica</span>R$ ' + custoH + '/h, referência de mercado</div>' +
    '<div><span class="lbl">Obra</span>' + (M.obras === 1 ? '1' : M.obras + ' obras') + ' · ' + M.prazo + ' meses' + (M.moTxt ? ' · ' + M.moTxt : '') + '</div></div>';
  var b1 = ptSec('02', 'Perda e ganho mensal', true) +
    '<div class="row" style="margin-top:5mm">' + baseInf + '<div>' +
      '<div class="strip two"><div><div class="lbl">Perda em horas de gestão e folha</div><div class="big xl p">' + ptMil(P.total, 2) + '/mês</div></div>' +
      '<div><div class="lbl">Ganho mensal (' + cap + ')</div><div class="big xl g">' + ptMil(G.total, 2) + '</div></div></div>' +
      '<p class="note" style="margin-top:2mm">Contexto: a perda total do Mapa é de ' + ptMil(M.roi.totalBase, 1) + ' em ' + M.prazo + ' meses' + (M.obras > 1 ? ' por obra' : '') +
        ', cerca de ' + ptMil(M.mapaMes, 1) + ' por mês (seção 05). Os ' + ptMil(P.total, 2) + ' são a parte em horas de gestão e folha.</p>' +
      chart + '</div></div>';
  var b2 = '<div class="row sec"><div><div class="lbl rule">Composição</div></div><div><table><thead><tr><th>Componente</th><th>Base informada</th>' +
    '<th class="n wrap" style="width:24mm">Perda/mês (horas e folha)</th><th class="n" style="width:26mm">Ganho/mês (' + cap + ')</th></tr></thead><tbody>' + compRows +
    '<tr class="tot"><td>Total</td><td></td><td class="n perda">' + ptMil(P.total, 2) + '</td><td class="n ganho">' + ptMil(G.total, 2) + '</td></tr></tbody></table></div></div>';
  var cen = [['Pessimista', 0.30, M.pess], ['Conservador (adotado)', ROI_CAPTURA_FIXA, M.cons]];
  var cenRows = cen.map(function(c, i) {
    var g = c[2].estrategica.valorCapacidade + c[2].estrategica.recTotal;
    return '<tr' + (i === 1 ? ' class="sel"' : '') + '><td>' + c[0] + '</td><td class="n">' + ptPct(c[1]) + '</td><td class="n">' + ptHoras(c[2].operacional.hMes) + '</td><td class="n">' + ptMil(g, 2) + '</td><td class="n">' + ptMult(g / c[2].mensalidade) + '</td></tr>';
  }).join('');
  var b3 = '<div class="row sec"><div><div class="lbl rule">Retorno por cenário</div></div><div><table><thead><tr><th>Cenário</th><th class="n" style="width:16mm">Captura</th><th class="n" style="width:22mm">Horas/mês</th><th class="n" style="width:26mm">Ganho mensal</th><th class="n" style="width:28mm">× mensalidade ref.</th></tr></thead><tbody>' + cenRows + '</tbody></table>' +
    '<p class="note" style="margin-top:3mm">Mensalidade de referência: ' + ptRefBRL(M.cons.mensalidade) + ' por obra, base de cálculo e não proposta comercial. Estimativa a partir dos dados informados; não representa garantia contratual. Perda por fonte no prazo da obra: seção 05.</p></div></div>';
  return [{ sec:'02', html:b1 }, { sec:'02', html:b2 }, { sec:'02', html:b3 }];
}

function ptSecCriticos(M) {
  var head = ptSec('03', 'Pontos críticos', true) +
    '<div class="row" style="margin-top:5mm"><div class="lbl rule">Pilar mais crítico</div>' +
    '<div style="border-top:.75pt solid var(--tinta);padding-top:2mm"><span class="b6">Pilar ' + M.worst.n + ', ' + M.worst.nome + '</span> · ' + ptNum(M.worst.pts, 0, 1) + ' de ' + M.worst.max + ' pontos (' + Math.round(M.worst.pct * 100) + '%), menor percentual</div></div>';
  var blocks = [];
  M.criticos.forEach(function(c, i) {
    var f = c.fonte;
    var html = '<div class="pc row"' + (i === 0 ? ' style="margin-top:4mm"' : '') + '>' +
      '<div><div class="lbl">Ponto crítico ' + c.n + '</div><div class="note" style="margin-top:1mm">' + c.pilar + (c.fase ? '<br>Fase de Implementação ' + c.fase : '') + '</div>' +
        (c.star ? '<div class="note" style="margin-top:1mm">Dor declarada pelo cliente</div>' : '') + '</div>' +
      '<div><div class="tt">' + c.titulo + '</div><div class="in"><div>' +
        '<div class="kv"><span class="lbl">Situação registrada</span><div class="txt">' + ptEsc(c.situacao) + '</div>' + (c.frase ? '<span class="q" style="margin-bottom:1.6mm">“' + ptEsc(c.frase) + '”</span>' : '') + '</div>' +
        '<div class="kv"><span class="lbl">Consequência</span><div class="txt">' + ptEsc(c.conseq) + '</div></div>' +
        (c.mes != null ? '<div class="mes">Perda por mês sem tratamento: <b>' + ptMil(c.mes, 1) + '</b></div>' : '') +
      '</div><div>' +
        '<div class="kv"><span class="lbl">Fonte de perda</span><div class="txt b6">' + f.label + '</div>' +
          '<div class="vals"><div>' + ptMil(f.perda, 1) + '<small>Perda, ' + M.prazo + ' meses</small></div><div class="ganho">' + ptMil(f.cap, 1) + '<small>Capturável</small></div></div>' +
          '<div class="note">' + c.base + '</div></div>' +
        (c.dep ? '<div class="kv"><span class="lbl">Depoimento de Cliente Agilean</span><div class="dep">“' + ptEsc(c.dep) + '”</div><div class="dep-a">' + ptEsc(c.depA) + '</div></div>' : '') +
      '</div></div></div></div>';
    blocks.push({ sec:'03', html:(i === 0 ? head : '') + html });
  });
  if (!blocks.length) blocks.push({ sec:'03', html:head });
  var distintas = M.criticos.every(function(c){ return c.mes != null; });
  var top3 = M.criticos.length === 3 && distintas && M.criticos.every(function(c){ return M.plan.top3.indexOf(c.fonte.key) >= 0; });
  blocks.push({ sec:'03', html:'<div class="row"><div></div><div class="src">Valores por fonte de perda, ' + (M.obras === 1 ? '1 obra' : 'por obra') + ' (seção 05). ' +
    (top3 ? 'Um ponto crítico por fonte, entre as três de maior perda.' : 'Pontos críticos escolhidos por fonte de perda, da maior para a menor, com prioridade para as dores declaradas pelo cliente.') + '</div></div>' });
  return blocks;
}

function ptSecDemais(M) {
  var tot = M.demais.length + M.acomp.length;
  if (!tot) return [];
  var head = ptSec('04', 'Demais pontos avaliados', true);
  var blocks = [];
  if (M.demais.length) {
    blocks.push({ sec:'04', head:head, rows:M.demais, render:function(rows, first, last) {
      var tr = rows.map(function(d) {
        return '<tr><td>' + ptPad(d.n) + '</td><td class="b6">' + d.titulo + '</td><td>' + d.pilar + '</td><td>' + d.fonte.label + '</td><td><b class="b6">' + d.prioridade + '</b></td><td class="n">—</td></tr>';
      }).join('');
      return '<div style="margin-top:5mm">' + (first ? '<div class="lbl" style="margin-bottom:2mm">Imediata e programada · ' + M.demais.length + ' de ' + tot + '</div>' : '') +
        '<table><thead><tr><th style="width:7mm">#</th><th>Ponto</th><th style="width:20mm">Pilar / tema</th><th style="width:42mm">Fonte de perda</th><th style="width:24mm">Prioridade</th><th class="n wrap" style="width:26mm">Perda por mês sem tratamento</th></tr></thead><tbody>' + tr + '</tbody></table>' +
        (last ? '<div class="src">Pilares: P1 Planejamento estratégico, P2 Proteção da execução, P3 Gestão da produção, P4 Controle e performance. Mão de obra: tema fora dos 4 pilares e do score /57.<br>Perda por mês: valor mostrado só no ponto crítico que recebe a fonte (seção 03); a fonte não é dividida nem somada em duplicidade (valores por fonte: seção 05).</div>' : '') + '</div>';
    }});
  }
  if (M.acomp.length) {
    var lst = function(items) {
      return '<table><thead><tr><th style="width:6mm">#</th><th>Ponto em acompanhamento</th><th class="n" style="width:22mm">Pilar / tema</th></tr></thead><tbody>' +
        items.map(function(a){ return '<tr><td>' + ptPad(a.n) + '</td><td>' + a.titulo + '</td><td class="n">' + a.pilar + '</td></tr>'; }).join('') + '</tbody></table>';
    };
    blocks.push({ sec:'04', head:M.demais.length ? '' : head, rows:M.acomp, render:function(rows, first) {
      var half = Math.ceil(rows.length / 2);
      return '<div style="margin-top:' + (M.demais.length ? '9mm' : '5mm') + '">' + '<div class="lbl" style="margin-bottom:2mm">ACOMPANHAMENTO · ' + M.acomp.length + ' de ' + tot + (first ? ' · perda por mês sem tratamento: —' : ' · continuação') + '</div>' +
        '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:8mm">' + lst(rows.slice(0, half)) + (rows.length > half ? lst(rows.slice(half)) : '<div></div>') + '</div></div>';
    }});
  }
  return blocks;
}

function ptFerrLabel(v) { v = (v || '').trim(); return v ? ptEsc(v) : '—'; }
function ptRotinas(M) {
  var f = M.ferr || {};
  var ERP = { sienge:'Sienge', totvs:'TOTVS', informakon:'Informakon', mega:'Mega', uau:'UAU' };
  var erpV = f.erp || '', erpNome, erpSit, erpEnt;
  if (ERP[erpV]) {
    erpNome = ERP[erpV];
    erpSit = 'ERP com integração nativa disponível, mas isolado do canteiro; dados só sobem no fechamento.';
    erpEnt = 'Integração nativa com o ' + ERP[erpV] + ': orçamento, medição e folha sincronizados, sem digitação duplicada.';
  } else if (erpV === 'outro') {
    erpNome = (f.erpOutro || '').trim() || '—';
    erpSit = 'Sistema de gestão sem integração automática com o canteiro; dados lançados manualmente.';
    erpEnt = 'Conector via API ou exportação estruturada sincroniza o sistema com a execução da obra.';
  } else {
    erpNome = erpV === 'nenhum' ? 'Não utiliza ERP' : '—';
    erpSit = 'Sem sistema de gestão integrado; controle disperso em planilhas, sem rastreabilidade entre obras.';
    erpEnt = 'Integração do orçamento e do fechamento ao SIIGA.';
  }
  var planSit = 'Alimentação manual, desconectada do orçamento e da EAP.';
  var planEnt = 'Linha de Balanço vinculada ao orçamento; reprogramação atualiza o físico-financeiro.';
  if (/prevision/i.test(f.planejamento || '') && erpV === 'sienge') {
    planSit = 'Planejamento e medição conectados, sem integração com os fluxos de qualidade e mão de obra.';
    planEnt = 'Planejamento, qualidade e mão de obra numa única plataforma integrada ao Sienge.';
    erpSit = 'Sienge integrado ao planejamento, sem integração com os fluxos de qualidade e mão de obra.';
    erpEnt = 'Integração do planejamento também com qualidade e mão de obra.';
  }
  var f43 = getScoreByCode('f4', 'F4.3');
  var p4Sit = { 0:'Cada indicador em uma fonte diferente; sem visão simultânea de prazo, custo e qualidade.',
    1:'Indicadores compilados manualmente antes de cada reunião.',
    1.5:'Painel parcial com prazo e custo; qualidade e ritmo de produção fora do painel.',
    3:'Painel integrado com prazo, ritmo, restrições, qualidade e custo.' }[f43] || 'Indicadores compilados manualmente antes de cada reunião.';
  var semErp = (erpV === 'nenhum');
  return {
    I:[['1 · Planejamento & Reprogramação', ptFerrLabel(f.planejamento), planSit, planEnt],
       ['2 · Medição de Avanço Físico', ptFerrLabel(f.medicao), 'Sistemas desconectados; avanço apurado manualmente, sem rastreio diário.', 'Apontamento diário via app; lookahead de 4 semanas com remoção de restrições medida pelo IRR.'],
       ['Pilar 4 · Painéis de indicadores', '—', p4Sit, 'Painéis de indicadores e reunião executiva com dados consolidados.']],
    II:[['3 · Qualidade (FVS)', ptFerrLabel(f.qualidade), 'Retrabalhos identificados tarde; qualidade tratada como auditoria separada do pagamento.', 'FVS digital vinculada ao avanço físico.'],
        ['6 · ERP / Sistema de Gestão', ptEsc(erpNome), erpSit, erpEnt]],
    III:[['4 · Controle de Contratos / Empreiteiros', ptFerrLabel(f.contratos), 'Negociação de medição desgastante; sem evidência objetiva para liberar pagamento.', 'Medição de empreiteiros baseada em avanço apontado e FVS aprovada.'],
         ['5 · Folha de Produção / Fechamento de MO', ptFerrLabel(f.folha), 'Fechamento manual e lento; produtividade por equipe sem rastreabilidade.', 'Fechamento de folha e produtividade por HH em horas' + (semErp ? '.' : ', integrado ao ERP.')]]
  };
}
var PT_PLANO_THEAD = '<thead><tr><th style="width:34mm">Rotina</th><th style="width:30mm">Ferramenta hoje</th><th>Situação observada</th><th>Entrega prevista</th></tr></thead>';
// Phase II drops the ERP wording when the client explicitly has no ERP
function ptFaseNome(fase, M) {
  if (fase.id === 'II' && M && (M.ferr || {}).erp === 'nenhum') return 'Integração com o Sistema de Gestão e Qualidade';
  return fase.nome;
}
function ptFaseGroup(fase, linhas, M) {
  return '<tr class="grp"><td colspan="4"><span class="gl">Fase de Implementação ' + fase.id + '</span><b class="b6">' + ptFaseNome(fase, M) + '</b>' +
    '<div class="gsub">' + fase.rot + ' · ' + fase.dur + '</div></td></tr>' +
    linhas.map(function(l){ return '<tr><td class="b6">' + l[0] + '</td><td>' + l[1] + '</td><td>' + l[2] + '</td><td>' + l[3] + '</td></tr>'; }).join('');
}
function ptRegua() {
  var D = 150, x = function(v){ return (v / D * 100).toFixed(2) + '%'; };
  var ticks = [0, 30, 60, 90, 120, 150].map(function(v){ return '<span style="left:' + x(v) + '">' + v + '</span>'; }).join('');
  var lines = [0, 30, 60, 90, 120, 150].map(function(v){ return '<i style="left:' + x(v) + '"></i>'; }).join('');
  var row = function(nome, a, b, cls, txt) { return '<div class="tl"><div class="nm">' + nome + '</div><div class="tp"><div class="tb ' + cls + '" style="left:' + x(a) + ';width:' + x(b - a) + '">' + txt + '</div></div></div>'; };
  return '<div class="chart-t">As Fases I e II ocupam os primeiros 60 dias; a Fase III vai até cerca do dia 150</div>' +
    '<div style="position:relative"><div class="tgrid">' + lines + '</div>' +
    row('Fase de Implementação I', 0, 60, 'a', 'até 60 dias') + row('Fase de Implementação II', 0, 60, 'b', 'até 60 dias, em paralelo') + row('Fase de Implementação III', 60, 150, 'c', 'até 90 dias, após I e II') +
    '</div><div class="tticks">' + ticks + '</div><div class="src">Unidade: dias corridos a partir do início do projeto. Duração total estimada: cerca de 150 dias.</div>';
}
function ptResolve(M, faseId) {
  var cr = M.criticos.filter(function(c){ return c.fase === faseId; }).map(function(c){ return String(c.n); });
  var dm = M.demais.filter(function(d){ return d.fase === faseId; }).map(function(d){ return ptPad(d.n); });
  var parts = [];
  if (cr.length) parts.push((cr.length === 1 ? 'ponto crítico ' : 'pontos críticos ') + ptLista(cr));
  if (dm.length) parts.push((dm.length === 1 ? 'ponto ' : 'pontos ') + ptLista(dm));
  return parts.length ? 'Resolve: ' + parts.join('; ') + '.' : '';
}

function ptSecFontes(M) {
  var linked = {};
  M.criticos.forEach(function(c){ (linked[c.fonte.key] = linked[c.fonte.key] || []).push(c.n); });
  var rows = M.roi.items.map(function(it) {
    var f = M.fontes[it.key], l = linked[it.key];
    return '<tr><td>' + f.labelTab + '</td><td class="n">' + ptMil(f.perda, 1) + '</td><td class="n">' + ptPct(f.fator) + '</td><td class="n">' + ptMil(f.cap, 1) + '</td><td style="padding-left:8mm">' +
      (l ? (l.length === 1 ? 'Ponto crítico ' : 'Pontos críticos ') + ptLista(l.map(String)) : '—') + '</td></tr>';
  }).join('');
  var totLbl = M.obras === 1 ? 'Total, 1 obra' : 'Total por obra';
  var portf = M.obras > 1 ? '<tr class="tot"><td>Total no portfólio (' + M.obras + ' obras)</td><td class="n">' + ptMil(M.roi.totalBase * M.obras, 1) + '</td><td class="n"></td><td class="n">' + ptMil(M.roi.totalPortfolio, 1) + '</td><td></td></tr>' : '';
  var b5 = ptSec('05', 'Perda por fonte e ganho capturável', true) +
    '<div style="margin-top:5mm"><table><thead><tr><th>Fonte de perda</th><th class="n" style="width:28mm">Perda (' + M.prazo + ' meses)</th><th class="n" style="width:24mm">Fator de captura</th><th class="n" style="width:30mm">Ganho capturável</th><th class="wrap" style="width:34mm;padding-left:8mm">Ponto crítico ligado</th></tr></thead>' +
    '<tbody>' + rows + '<tr class="tot"><td>' + totLbl + '</td><td class="n">' + ptMil(M.roi.totalBase, 1) + '</td><td class="n"></td><td class="n">' + ptMil(M.roi.totalPorObra, 1) + '</td><td></td></tr>' + portf + '</tbody></table>' +
    '<div class="src">Base: ' + (M.obras === 1 ? '1 obra, orçamento ' : M.obras + ' obras, orçamento médio de ') + ptMilVar(M.orc) + (M.obras > 1 ? ' por obra' : '') + ', prazo ' + M.prazo + ' meses. Valores em R$ mil, arredondados; totais calculados antes do arredondamento. Perda por fonte (' + M.prazo + ' meses) e retorno mensal (seção 02) são estimativas de modelos diferentes e não são somáveis.</div></div>';
  var R = ptRotinas(M);
  var blocks = [{ sec:'05', html:b5 }];
  // Phases I+II, timeline, Phase III, action card, signatures (pilot order)
  blocks.push({ sec:'06', head:ptSec('06', ptPlano06(M)), rows:[0, 1], render:function(rows) {
    return '<div style="margin-top:5mm"><table>' + PT_PLANO_THEAD + '<tbody>' + rows.map(function(i){ return ptFaseGroup(PT_FASES[i], R[PT_FASES[i].id], M); }).join('') + '</tbody></table></div>';
  }});
  blocks.push({ sec:'06', html:'<div style="margin-top:7mm">' + ptRegua() + '</div>' });
  blocks.push({ sec:'06', html:'<div style="margin-top:7mm"><table>' + PT_PLANO_THEAD + '<tbody>' + ptFaseGroup(PT_FASES[2], R.III, M) + '</tbody></table></div>' });
  var perfil = [ptObrasTxt(M) + (M.tipologia ? ' no perfil <i class="it">' + M.tipologia + '</i>' : ''), M.moLongo ? 'com <i class="it">' + M.moLongo + '</i>' : ''].filter(Boolean).join(', ');
  var frentes = PT_FASES.map(function(fz, i) {
    var res = ptResolve(M, fz.id);
    return '<div class="fr"><div class="nn">0' + (i + 1) + '</div><div><div class="ft">Fase de Implementação ' + fz.id + ' · ' + ptFaseNome(fz, M) + '</div><div class="fd">' + fz.fd + '</div>' + (res ? '<div class="fz">' + res + '</div>' : '') + '</div></div>';
  }).join('');
  blocks.push({ sec:'06', html:'<div style="margin-top:9mm" class="plano"><div class="kk sq">Plano de ação executivo</div><h3>Fases de Implementação e pontos atendidos</h3>' +
    '<p>Com base no diagnóstico ' + (M.art ? 'da ' : 'de ') + '<b>' + ptEsc(M.empresa) + '</b> (' + perfil + '), o plano de ação se organiza em três Fases de Implementação.</p>' + frentes + '</div>' });
  var sig = [];
  if (M.consultor) sig.push('<div><span class="lbl">Elaborado por (Agilean)</span><b class="b6">' + ptEsc(M.consultor) + '</b><br>Consultor Agilean</div>');
  if (M.contato) sig.push('<div><span class="lbl">Responsável pela empresa</span><b class="b6">' + ptEsc(M.contato) + '</b>' + (M.cargo ? '<br>' + ptEsc(M.cargo) : '') + '</div>');
  if (sig.length) blocks.push({ sec:'06', html:'<div class="sign">' + sig.join('') + '</div>' });
  return blocks;
}

function ptSecBases(M) {
  var refs = [['Mão de obra como % do custo da obra', '45%']];
  if (M.mo !== 'terceirizada') refs.push(['Estouro médio de mão de obra', '15%']);
  refs.push(['Retrabalhos (referência de mercado)', ptPct(M.roi.pctRetrabalho || 0.10) + ' do portfólio'], ['Ganho de velocidade de produção', '10% do prazo'],
    ['Custo de referência da hora técnica', 'R$ ' + ROI_REAL_K.CUSTO_HORA_TECNICA + '/h'],
    ['Média de mercado por pilar (P1 a P4)', ['f1','f2','f3','f4'].map(function(k){ return ptPct(PT_MERCADO[k]); }).join(' · ')]);
  var oper = [['Obras em andamento', String(M.obras)], [M.obras === 1 ? 'Orçamento da obra' : 'Orçamento médio por obra', ptMilVar(M.orc)], ['Prazo da obra', M.prazo + ' meses'],
    ['Horas de gestão informadas', M.horasInf > 0 ? ptNum(M.horasInf, 0, 1) + ' h/mês' : 'Não informadas']];
  if (M.folha > 0) oper.push(['Folha de produção', ptMilVar(M.folha) + '/mês']);
  oper.push(['Cenário adotado', ptPct(ROI_CAPTURA_FIXA) + ' · ' + roiCapturaLabel(ROI_CAPTURA_FIXA)]);
  var glos = [['EAP','Estrutura analítica do projeto.'],['FVS','Ficha de verificação de serviço.'],['HH','Homem-hora.'],['IRR','Índice de remoção de restrições.'],
    ['Lookahead','Planejamento de médio prazo, com janela de semanas à frente da execução.'],['MO','Mão de obra.'],['PPC','Percentual de planos concluídos.'],
    ['Fator de captura','Fração da perda de cada fonte que se estima recuperar, conforme a maturidade dos pilares ligados à fonte.'],
    ['Mensalidade de referência', ptRefBRL(MENSALIDADE_ROI_POR_OBRA) + ' por obra; base de cálculo, não é proposta comercial.']];
  var t2 = function(rows) { return rows.map(function(r){ return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>'; }).join(''); };
  return [
    { sec:'07', breakBefore:true, html:ptSec('07', 'Bases do diagnóstico', true) + '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Referências de mercado</div></div><div><table><thead><tr><th>Parâmetro</th><th class="n">Valor</th></tr></thead><tbody>' + t2(refs) + '</tbody></table></div></div>' },
    { sec:'07', html:'<div class="row sec"><div><div class="lbl rule">Dados da operação</div></div><div><table><thead><tr><th>Dado</th><th class="n">Valor</th></tr></thead><tbody>' + t2(oper) + '</tbody></table>' +
      '<div class="src">Fonte: entrevista de diagnóstico' + (M.data ? ', ' + M.data : '') + '.</div></div></div>' },
    { sec:'07', html:'<div class="row sec"><div><div class="lbl rule">Glossário</div></div><div><table><tbody>' + glos.map(function(g){ return '<tr><td class="b6" style="width:44mm">' + g[0] + '</td><td>' + g[1] + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="note" style="margin-top:3mm">Estimativa a partir dos dados informados no diagnóstico e de referências de mercado; não representa garantia contratual.</p></div></div>' }
  ];
}

function ptSecAnexo(M) {
  var orcT = ptMilVar(M.orc), P = M.prazo, F = M.fontes, cap = ptPct(ROI_CAPTURA_FIXA), custoH = ROI_REAL_K.CUSTO_HORA_TECNICA;
  var hasMo = !!F.mo;
  var pres = [['Mão de obra como % do custo da obra', '45%']];
  if (hasMo) pres.push(['Estouro médio de mão de obra', '15%'], ['Redução do estouro com o SIIGA', '70%']);
  pres.push(['Retrabalho de referência de mercado', '10% do portfólio'], ['Redução do retrabalho com o SIIGA', '40%'], ['Ganho de velocidade', '10% do prazo × 15% dos custos proporcionais'],
    ['Desvio médio de medição e folha', '5%'], ['Horas de gestão recuperáveis', ptNum(M.roi.horasRecup, 0, 1) + ' h/mês' + (M.roi.horasDoCliente ? '' : ' (referência de mercado)')], ['Prazo da obra', P + ' meses'], ['Hora técnica', 'R$ ' + custoH + '/h']);
  var a1 = ptSec('A', 'Anexo A · Memória de cálculo', true) + '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">A.1 Pressupostos</div></div><div><table class="ax"><thead><tr><th>Parâmetro</th><th class="n">Valor</th></tr></thead><tbody>' +
    pres.map(function(r){ return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  var hR = ptNum(M.roi.horasRecup, 0, 1);
  var form = {
    time: hR + ' h/mês × R$ ' + custoH + '/h × ' + P + ' meses; ' + (M.roi.horasDoCliente ? hR + ' h = horas informadas × % de economia de cada rotina (40% planejar, 90% demais)' : 'referência de mercado de 12,25 dias × 8 h (horas não informadas)'),
    retrabalho: 'Orçamento ' + orcT + ' × 10% × 40%',
    velocidade: 'Orçamento ' + orcT + ' × 10% × 15%',
    erros: 'Orçamento ' + orcT + ' × 45% × 5%',
    mo: M.mo === 'mista' ? 'Orçamento ' + orcT + ' × 45% × 50% × 15% × 70%' : 'Orçamento ' + orcT + ' × 45% × 15% × 70%'
  };
  var a2rows = M.roi.items.map(function(it){ var f = F[it.key]; return '<tr><td>' + f.labelTab + '</td><td class="f">' + form[it.key] + '</td><td class="n">' + ptMil(f.perda, 1) + '</td></tr>'; }).join('');
  var mesRows = M.criticos.filter(function(c){ return c.mes != null; }).map(function(c, i) {
    return '<tr><td>Ponto crítico ' + c.n + ' (' + c.fonte.label + ')</td><td class="f">' + (i === 0 ? 'Perda da fonte ÷ meses de obra: ' : '') + ptMil(c.fonte.perda, 1) + ' ÷ ' + P + '</td><td class="n">' + ptMil(c.mes, 1) + '</td></tr>';
  }).join('');
  var nC = M.criticos.length;
  var a2 = '<div class="row sec"><div><div class="lbl rule">A.2 Perda por fonte</div></div><div><table class="ax"><thead><tr><th style="width:44mm">Fonte de perda</th><th>Fórmula (' + P + ' meses)</th><th class="n" style="width:20mm">Valor</th></tr></thead><tbody>' + a2rows +
    '<tr class="tot"><td>Total</td><td></td><td class="n">' + ptMil(M.roi.totalBase, 1) + '</td></tr></tbody></table>' +
    (nC ? '<table class="ax" style="margin-top:6mm"><thead><tr><th style="width:44mm">Perda por mês sem tratamento</th><th>Fórmula</th><th class="n" style="width:24mm">Valor</th></tr></thead><tbody>' + mesRows +
      '<tr class="tot"><td>Total ' + (nC === 1 ? 'do ponto crítico' : 'dos ' + nC + ' pontos críticos') + '</td><td class="f">' + ptMil(M.critPerda, 1) + ' ÷ ' + P + '</td><td class="n">' + ptMil(M.critMes, 1) + '</td></tr>' +
      '<tr><td>Perda total do Mapa (contexto)</td><td class="f">' + ptMil(M.roi.totalBase, 1) + ' ÷ ' + P + '</td><td class="n">' + ptMil(M.mapaMes, 1) + '</td></tr></tbody></table>' : '') + '</div></div>';
  var a3rows = M.roi.items.map(function(it){ var f = F[it.key]; return '<tr><td>' + f.labelTab + '</td><td class="f">' + ptMil(f.perda, 1) + ' × ' + ptPct(f.fator) + '</td><td class="n">' + ptMil(f.cap, 1) + '</td></tr>'; }).join('');
  var a3 = '<div class="row sec"><div><div class="lbl rule">A.3 Fator de captura</div></div><div><table class="ax"><thead><tr><th style="width:44mm">Fonte de perda</th><th>Fórmula</th><th class="n" style="width:20mm">Ganho</th></tr></thead><tbody>' + a3rows +
    '<tr class="tot"><td>Total</td><td></td><td class="n">' + ptMil(M.roi.totalPorObra, 1) + '</td></tr></tbody></table>' +
    '<div class="src">Fator: % da perda de cada fonte que se estima capturar, conforme a maturidade dos pilares ligados ao ganho; quanto menor a maturidade, maior o fator. Varia de 20% a 100% por fonte e é calculado individualmente. Fatores exibidos arredondados; valores calculados com o fator exato.</div></div></div>';
  var Pm = M.perdaMes, G = M.ganhoMes, temFolha = (Pm.retr + Pm.indev) > 0;
  var hPot = M.horasPot, hMes = M.cons.operacional.hMes;
  var compR = '<tr><td>Horas do time técnico</td><td class="f">' + ptHoras(hPot) + ' × R$ ' + custoH + '/h; ganho: horas recuperadas (' + ptHoras(hMes) + ') × R$ ' + custoH + '/h</td><td class="n">' + ptMil(Pm.horas, 2) + '</td><td class="n">' + ptMil(G.horas, 2) + '</td></tr>' +
    (temFolha ? '<tr><td>Retrabalho pago na folha</td><td class="f">Folha de MO própria × 5% de retrabalho; ganho: × captura do cenário (' + cap + ')</td><td class="n">' + ptMil(Pm.retr, 2) + '</td><td class="n">' + ptMil(G.retr, 2) + '</td></tr>' +
      '<tr><td>Pagamentos indevidos na folha</td><td class="f">Folha de MO própria × 5% indevidos × 80% sem sobreposição; ganho: × ' + cap + '</td><td class="n">' + ptMil(Pm.indev, 2) + '</td><td class="n">' + ptMil(G.indev, 2) + '</td></tr>' : '');
  var mens = M.cons.mensalidade;
  var gp = M.ganhoPess.total;
  var ind = [['Potencial pleno de horas', 'Horas informadas em cada rotina × % de economia da rotina (40% planejar, 90% demais)', ptNum(hPot, 0, 1) + ' h/mês'],
    ['Horas recuperadas por mês', 'Potencial pleno × captura do cenário (' + cap + ')', ptNum(hMes, 0, 1) + ' h/mês'],
    ['Horas recuperadas por obra', 'Horas recuperadas por mês × prazo da obra (' + P + ' meses)', ptHoras(M.cons.operacional.hObra)],
    ['Múltiplo da mensalidade de referência', ptMil(G.total, 2) + ' ÷ ' + ptRefBRL(mens), ptMult(G.total / mens)],
    ['Horas recuperadas no mês de 1 profissional', ptHoras(hMes) + ' ÷ ' + ROI_REAL_K.JORNADA + ' h úteis por mês', ptNum(M.cons.operacional.pctJornada * 100, 1, 1) + '%'],
    ['Cenário Pessimista (30%)', ptHoras(M.pess.operacional.hMes) + '; ganho ' + ptMil(gp, 2) + ' ÷ ' + ptRefBRL(mens), ptMult(gp / mens)]];
  var a4 = '<div class="row sec"><div><div class="lbl rule">A.4 Retorno mensal</div></div><div><p class="note" style="margin-top:4mm">Premissas: mensalidade de referência ' + ptRefBRL(mens) + ' por obra; captura do cenário ' + cap + ' (Conservador)' +
      (M.folha > 0 ? '; folha de MO própria ' + ptMilVar(M.folha) + '/mês' : '') + '; hora técnica R$ ' + custoH + '/h; horas de gestão informadas ' + ptNum(M.horasInf, 0, 1) + ' h/mês.</p>' +
    '<div style="margin-top:4mm"><table class="ax"><thead><tr><th style="width:44mm">Componente</th><th>Fórmula</th><th class="n wrap" style="width:22mm">Perda/mês (horas e folha)</th><th class="n" style="width:20mm">Ganho/mês</th></tr></thead><tbody>' + compR +
      '<tr class="tot"><td>Total</td><td></td><td class="n">' + ptMil(Pm.total, 2) + '</td><td class="n">' + ptMil(G.total, 2) + '</td></tr></tbody></table></div>' +
    '<div style="margin-top:5mm"><table class="ax"><thead><tr><th style="width:44mm">Indicador</th><th>Fórmula</th><th class="n" style="width:24mm">Valor</th></tr></thead><tbody>' +
      ind.map(function(r){ return '<tr><td>' + r[0] + '</td><td class="f">' + r[1] + '</td><td class="n">' + r[2] + '</td></tr>'; }).join('') + '</tbody></table>' +
    '<div class="src">Estimativa a partir dos dados informados pelo cliente; não representa garantia contratual.</div></div></div></div>';
  return [{ sec:'A', breakBefore:true, html:a1 }, { sec:'A', html:a2 }, { sec:'A', html:a3 }, { sec:'A', html:a4 }];
}

// Section meta: running-header title, page density class, page break rule.
var PT_SECOES = {
  '01':{ run:'Resumo executivo', toc:'Resumo executivo', cls:'tight dense' },
  '02':{ run:'Perda e ganho mensal', toc:'Perda e ganho mensal', cls:'' },
  '03':{ run:'Pontos críticos', toc:'Pontos críticos', cls:'tight' },
  '04':{ run:'Demais pontos avaliados', toc:'Demais pontos avaliados', cls:'tight dense' },
  '05':{ run:'Perda por fonte e ganho capturável', toc:'Perda por fonte e ganho capturável', cls:'' },
  '06':{ run:'Plano de Transformação Operacional', toc:null, cls:'', flow:true },
  '07':{ run:'Bases do diagnóstico', toc:'Bases do diagnóstico', cls:'tight' },
  'A':{ run:'Anexo A · Memória de cálculo', toc:'Anexo A · Memória de cálculo', cls:'', noCont:true }
};

// ── Paginator: flows blocks into A4 pages, measuring in the live DOM ─────
function ptPaginate(root, M, blocks) {
  var pages = [];
  var secStart = {}; // section -> 1-based index (within flow pages) of the page holding its first block
  var cur = null;
  var MM = 96 / 25.4;
  var minGap = 10 * MM; // keep at least 10 mm above the stamp
  function newPage(sec, cont) {
    var meta = PT_SECOES[sec];
    var pg = document.createElement('div');
    pg.className = 'page ' + (meta.cls || '');
    pg.innerHTML = '<div class="run"><span><b>Diagnóstico SIIGA</b> · ' + ptEsc(M.empresa) + '</span><span>' + sec + ' ' + meta.run + '</span></div>' +
      '<div class="body"></div><div class="carimbo">' + ptCarimbo(M, 0, 0) + '</div>';
    root.appendChild(pg);
    cur = { el:pg, body:pg.querySelector('.body'), sec:sec, n:0 };
    pages.push(cur);
    if (cont && !meta.noCont) {
      var t = sec === '06' ? ptPlano06(M) : meta.run;
      cur.body.insertAdjacentHTML('beforeend', '<div class="row sec first"><div class="lbl rule">' + sec + ' · continuação</div><div class="lbl rule contsub">' + t + '</div></div>');
    }
  }
  function fits() {
    var stamp = cur.el.querySelector('.carimbo').getBoundingClientRect().top;
    var kids = cur.body.children, bottom = 0;
    for (var i = 0; i < kids.length; i++) bottom = Math.max(bottom, kids[i].getBoundingClientRect().bottom);
    return bottom <= stamp - minGap;
  }
  function add(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = ptNb(html);
    var nodes = Array.prototype.slice.call(wrap.childNodes);
    nodes.forEach(function(n){ cur.body.appendChild(n); });
    return nodes;
  }
  function remove(nodes) { nodes.forEach(function(n){ if (n.parentNode) n.parentNode.removeChild(n); }); }
  blocks.forEach(function(b) {
    var meta = PT_SECOES[b.sec];
    var secChange = !cur || cur.sec !== b.sec;
    if (!cur || b.breakBefore === true || (secChange && !meta.flow)) newPage(b.sec, false);
    if (!b.rows) {
      var nodes = add((b.head || '') + b.html);
      if (!fits() && cur.n > 0) { remove(nodes); newPage(b.sec, true); add((b.head || '') + b.html); }
      if (!secStart[b.sec]) secStart[b.sec] = pages.length;
      cur.n++;
      return;
    }
    // Row-splittable block: place as many rows as fit, continue on new pages.
    var rest = b.rows.slice(), first = true;
    while (rest.length) {
      var k = rest.length, placed = null;
      for (; k >= 1; k--) {
        var nd = add((first ? (b.head || '') : '') + b.render(rest.slice(0, k), first, k === rest.length));
        if (fits()) { placed = nd; break; }
        remove(nd);
      }
      if (!placed) {
        if (cur.n > 0) { newPage(b.sec, true); continue; }
        k = 1; add((first ? (b.head || '') : '') + b.render(rest.slice(0, 1), first, rest.length === 1));
      }
      if (!secStart[b.sec]) secStart[b.sec] = pages.length;
      cur.n++;
      rest = rest.slice(k);
      first = false;
      if (rest.length) newPage(b.sec, true);
    }
  });
  return { pages:pages, secStart:secStart };
}

function ptCapa(M, tocRows, total) {
  var pg = document.createElement('div');
  pg.className = 'page cover';
  var idt = [];
  if (M.entrevistado) idt.push(['Entrevistado', ptEsc(M.entrevistado)]);
  if (M.consultor) idt.push(['Consultor', ptEsc(M.consultor) + ', Agilean']);
  if (M.data) idt.push(['Data do diagnóstico', M.data]);
  idt.push(['Versão', M.versao], ['Documento', ptDocNome(M)]);
  pg.innerHTML = ptNb('<img class="logo" src="' + PT_LOGO + '" alt="Agilean">' +
    '<div class="ctit"><div class="lbl sq">' + ptDocNome(M) + '</div><h1 style="margin-top:2mm">Diagnóstico <span class="o">SIIGA</span></h1><div class="cco">' + ptEsc(M.empresa) + '</div></div>' +
    '<table class="idt">' + idt.map(function(r, i){ return '<tr><td class="lbl"' + (i === 0 ? ' style="width:42mm"' : '') + '>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
    '<div class="classif">Confidencial · uso restrito ' + ptEsc(M.empresa) + '</div>' +
    '<div class="toc"><div class="lbl rule" style="margin-bottom:2mm">Sumário</div><table><thead><tr><th style="width:10mm">Seção</th><th>Título</th><th class="n">Folha</th></tr></thead><tbody>' +
      tocRows.map(function(r){ return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td class="n">' + ptPad(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>');
  return pg;
}

// Builds every page of the report into an off-screen root and returns it.
function ptBuild(mode) {
  var M = ptModel(mode);
  var old = document.getElementById('ptr-root');
  if (old) old.parentNode.removeChild(old);
  var root = document.createElement('div');
  root.id = 'ptr-root';
  root.className = 'ptr';
  document.body.appendChild(root);
  var blocks = [].concat(ptSecResumo(M), ptSecPerdaGanho(M), ptSecCriticos(M), ptSecDemais(M), ptSecFontes(M), ptSecBases(M), M.det ? ptSecAnexo(M) : []);
  var pg = ptPaginate(root, M, blocks);
  var pages = pg.pages;
  var total = pages.length + 1;
  pages.forEach(function(p, i) { p.el.querySelector('.carimbo').innerHTML = ptNb(ptCarimbo(M, i + 2, total)); });
  var toc = [];
  ['01','02','03','04','05','06','07','A'].forEach(function(s) {
    if (!pg.secStart[s]) return;
    toc.push([s, s === '06' ? ptPlano06(M) : PT_SECOES[s].toc, pg.secStart[s] + 1]);
  });
  root.insertBefore(ptCapa(M, toc, total), root.firstChild);
  ptHatch(root);
  return { root:root, model:M, total:total };
}

// html2canvas does not paint repeating-linear-gradient: hatched areas get a
// canvas-generated tile instead, with colors read from the CSS tokens.
var PT_HATCH = [['.seg.r2, .sw.r2', '--critico', '--critico-m'], ['.seg.g2, .sw.g2', '--ok', '--ok-m'], ['.tb.b', '--tinta', '--hatch-neutro']];
function ptHatchTile(c1, c2, T) {
  var cv = document.createElement('canvas');
  cv.width = cv.height = T * 4; // drawn at 4x for a sharp raster
  var g = cv.getContext('2d'), U = T * 4, w = U / 2;
  g.fillStyle = c2; g.fillRect(0, 0, U, U);
  g.fillStyle = c1;
  for (var k = -2 * U; k <= U; k += U) {
    // "/" band (CSS 135deg stripes), tileable horizontally and vertically
    g.beginPath(); g.moveTo(k, U); g.lineTo(k + w, U); g.lineTo(k + w + U, 0); g.lineTo(k + U, 0); g.closePath(); g.fill();
  }
  return cv.toDataURL('image/png');
}
function ptHatch(root) {
  var T = parseFloat(ptToken('--hatch')) || 12;
  PT_HATCH.forEach(function(h) {
    var url = ptHatchTile(ptToken(h[1]), ptToken(h[2]), T);
    Array.prototype.forEach.call(root.querySelectorAll(h[0]), function(el) {
      el.style.background = 'url(' + url + ') repeat';
      el.style.backgroundSize = T + 'px ' + T + 'px';
    });
  });
}

// Faces used by the report: every weight is loaded explicitly before measuring
// and rasterizing (otherwise html2canvas draws with the fallback font).
var PT_FONT_FACES = ['400 10px "Bai Jamjuree"', '500 10px "Bai Jamjuree"', '600 10px "Bai Jamjuree"', '700 10px "Bai Jamjuree"',
  '400 10px "Manrope"', '500 10px "Manrope"', '600 10px "Manrope"', '700 10px "Manrope"'];
function ptFontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  var sample = 'Ação R$ 0123456789 ÷×—';
  var faces = PT_FONT_FACES;
  return Promise.all(faces.map(function(f){ return document.fonts.load(f, sample).catch(function(){}); }))
    .then(function(){ return document.fonts.ready; });
}
function ptImagesReady(root) {
  var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
  return Promise.all(imgs.map(function(im) {
    return (im.complete && im.naturalWidth) ? Promise.resolve() : new Promise(function(res){ im.onload = res; im.onerror = res; });
  }));
}

// Entry point: builds the Direction A report and saves the PDF (light theme only).
function generateRelatorioPrancha(mode) {
  mode = (mode === 'resumido') ? 'resumido' : 'detalhado';
  var loadDiv = document.createElement('div');
  loadDiv.id = 'pdf-loading';
  loadDiv.style.cssText = 'position:fixed;inset:0;background:rgba(15,16,21,0.95);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
  loadDiv.innerHTML = '<div style="width:48px;height:48px;border:3px solid rgba(255,255,255,0.1);border-top-color:#ea580c;border-radius:50%;animation:spin 0.8s linear infinite"></div>' +
    '<div style="font-family:Bai Jamjuree;font-size:14px;color:white">Gerando PDF...</div><div style="font-size:12px;color:var(--gray2)">Aguarde alguns segundos</div>';
  document.body.appendChild(loadDiv);
  if (!document.getElementById('spin-style')) {
    var st = document.createElement('style'); st.id = 'spin-style'; st.textContent = '@keyframes spin{to{transform:rotate(360deg)}}'; document.head.appendChild(st);
  }
  var built = null;
  function cleanup() {
    if (loadDiv.parentNode) loadDiv.parentNode.removeChild(loadDiv);
    if (built && built.root.parentNode && !window.__PT_KEEP_DOM) built.root.parentNode.removeChild(built.root);
  }
  // Fonts first (a probe root triggers the lazy @font-face loads), then layout.
  var probe = document.createElement('div');
  probe.className = 'ptr';
  probe.innerHTML = '<div class="page">' + PT_FONT_FACES.map(function(f) {
    var m = /^(\d+) 10px "(.+)"$/.exec(f);
    return '<span style="font-family:&quot;' + m[2] + '&quot;;font-weight:' + m[1] + '">Ação</span>';
  }).join('') + '</div>';
  document.body.appendChild(probe);
  ptFontsReady().then(function() {
    probe.parentNode.removeChild(probe);
    built = ptBuild(mode);
    return ptImagesReady(built.root).then(ptFontsReady);
  }).then(function() {
    var jsPDFNS = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var pdf = new jsPDFNS({ orientation:'portrait', unit:'mm', format:'a4', compress:true });
    var M = built.model;
    pdf.setProperties({ title:'Diagnóstico SIIGA · ' + M.empresa + ' · ' + ptDocNome(M), author:'Agilean',
      subject:'Diagnóstico de maturidade SIIGA · ' + M.empresa, keywords:'SIIGA, diagnóstico', creator:'SIIGA Assessment' });
    var pageEls = Array.prototype.slice.call(built.root.querySelectorAll(':scope > .page'));
    var paper = ptToken('--papel') || '#FFFFFF';
    var idx = 0;
    return new Promise(function(resolve, reject) {
      function next() {
        if (idx >= pageEls.length) { resolve(pdf); return; }
        html2canvas(pageEls[idx], { scale:2.5, useCORS:true, allowTaint:true, backgroundColor:paper, logging:false }).then(function(canvas) {
          if (idx > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
          idx++;
          next();
        }).catch(reject);
      }
      next();
    });
  }).then(function(pdf) {
    var M = built.model;
    var empresa = (M.empresa || 'diagnostico').replace(/[^a-zA-Z0-9]/g, '_');
    var data = (S.data || new Date().toISOString().split('T')[0]);
    window.__LAST_PDF_DATA = pdf.output('datauristring');
    pdf.save('SIIGA_Diagnostico_' + empresa + (M.det ? '_DETALHADO' : '_RESUMIDO') + '_' + data + '.pdf');
    cleanup();
    if (typeof showToast === 'function') showToast('PDF ' + (M.det ? 'Detalhado' : 'Resumido') + ' gerado com sucesso!');
  }).catch(function(err) {
    cleanup();
    console.error('PDF error:', err);
    alert('Erro ao gerar PDF. Tente novamente.');
  });
}
