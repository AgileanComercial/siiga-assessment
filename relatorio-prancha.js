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

// Implementation Phase per question code (PT_FASE) and the priority derived from it
// (prioridadeDaFase) live in script.js, the single source shared with the tool.

// PT_FONTE_LABEL (loss source names) and PT_MO_PILAR live in script.js, the single source shared with the tool.
// Basis of each loss source, without formula (allowed in RESUMIDO: data + rates).
var PT_FONTE_BASE = {
  time:'Horas de gestão informadas e hora técnica de referência (R$ 115/h). Ajustado pela maturidade.',
  timeRef:'Referência de mercado: 98 h/mês nas rotinas de gestão × 80% de economia média (horas não informadas) e hora técnica de referência (R$ 115/h). Ajustado pela maturidade.',
  retrabalho:'Orçamento da obra informado e referência de mercado de retrabalho (10%). Ajustado pela maturidade.',
  velocidade:'Orçamento da obra informado, custos indiretos de 15% do orçamento e redução de prazo de 10% com o SIIGA (referência SIIGA). Ajustado pela maturidade.',
  erros:'Orçamento da obra informado, mão de obra como 45% do custo e desvio médio de medição e folha (5%). Ajustado pela maturidade.',
  errosTerc:'Orçamento da obra informado, mão de obra como 45% do custo e desvio médio de medição (5%). Ajustado pela maturidade.',
  mo:'Orçamento da obra informado, mão de obra como 45% do custo e estouro médio de mercado (15%). Ajustado pela maturidade.'
};
// Same names as the Pilares screen of the tool (sales slide)
var PT_PILAR_NOME = { f1:'Planejamento estratégico do fluxo de produção', f2:'Proteção e garantia da execução do plano', f3:'Gestão integrada da produção', f4:'Controle real e performance da produção' };
var PT_MERCADO = { f1:0.70, f2:0.62, f3:0.55, f4:0.58 }; // same values as the radar benchmark
var PT_TIPOLOGIA = { vert:'Residencial vertical', horiz:'Residencial horizontal', mcmv:'MCMV / Habitação popular', com:'Comercial / industrial', div:'Portfólio diversificado' };
var PT_NUM_EXT = { 1:'um', 2:'dois', 3:'três', 4:'quatro', 5:'cinco' };
var PT_NUM_EXT_F = { 1:'uma', 2:'duas', 3:'três', 4:'quatro', 5:'cinco' };
// "Prioridade 1" / "Prioridades 1 e 2"
function ptPrioLista(ns) { return (ns.length === 1 ? 'Prioridade ' : 'Prioridades ') + ptLista(ns.map(String)); }

var PT_FASES = [
  { id:'I', nome:'Planejamento e Controle Integrado com o Canteiro',
    dur:'até 60 dias (dia 0 a 60)', fd:'Até 60 dias. Linha de Balanço, apontamento diário, lookahead e painéis de indicadores.' },
  { id:'II', nome:'Integração com o ERP e o Sistema de Qualidade',
    dur:'até 60 dias, em paralelo à Fase I', fd:'Até 60 dias, em paralelo à Fase I. FVS digital vinculada ao avanço e integração com o sistema de gestão.' }
];
// Phase III fronts, both from day 60: outsourced labor -> Controle de Empreiteiros (30 days),
// own labor -> Folha de Produção (90 days), mixed (or not informed) -> both.
var PT_FRENTES_III = {
  terc:{ nome:'Controle de Empreiteiros', art:'o ', ini:60, fim:90, oque:'medição de empreiteiros por evidência de avanço' },
  propria:{ nome:'Folha de Produção', art:'a ', ini:60, fim:150, oque:'fechamento de folha por evidência de avanço' }
};
function ptFrentesIII(mo) {
  var F = PT_FRENTES_III;
  return mo === 'terceirizada' ? [F.terc] : (mo === 'propria' ? [F.propria] : [F.terc, F.propria]);
}
// Phases I, II and III for the labor model (report and tool); Phase III texts follow its fronts.
function ptFases(mo) {
  var fr = ptFrentesIII(mo).map(function(f){ return Object.assign({ dias:f.fim - f.ini, rot:(f.fim - f.ini) + ' dias, após I e II' }, f); });
  var em = function(f){ return f.nome + ' em ' + f.dias + ' dias'; };
  return PT_FASES.concat([{ id:'III', nome:'Controle de Pagamento da Mão de Obra Integrado', prazo:'A partir do dia 60', frentes:fr,
    dur:'após as Fases I e II, a partir do dia 60: ' + ptLista(fr.map(function(f){ return em(f) + ' (até o dia ' + f.fim + ')'; })),
    fd:'A partir do dia 60, após as Fases I e II. ' + ptLista(fr.map(function(f){ return em(f) + ' (' + f.oque + ')'; })) + '.' }]);
}

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
// Title and pillar of a point, shared by the report and the Conferência screen (script.js)
function ptPilarGap(o, longo) {
  var n;
  if (o.bk === 'mo') {
    n = PT_MO_PILAR[o.code];
    if (!n) throw new Error('PT_MO_PILAR: código de mão de obra sem pilar mapeado: ' + o.code);
  } else { n = o.bk.charAt(1); }
  return (longo ? 'Pilar ' : 'P') + n;
}
function ptTituloGap(o) { return (o.score === 0 ? 'Implantação ' : 'Digitalização ') + (PT_PRATICA[o.code] || ('de ' + ptLow(o.gap))); }
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
    var label = fonteLabel(it.key) || it.label;
    var labelTab = (it.key === 'mo' && mo === 'mista') ? label + ' (50% própria)' : label;
    fontes[it.key] = { key:it.key, label:label, labelTab:labelTab, perda:it.baseValue, cap:it.porObra, fator:it.fator, reducao:(it.reducao == null ? 1 : it.reducao),
      capEf:(it.baseValue ? it.porObra / it.baseValue : 0),
      mes:it.baseValue / prazo, basis:it.basis };
  });

  // Points: critical (anchors); the rest and attention share one table
  var pilarLbl = ptPilarGap;
  var titulo = ptTituloGap;
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
      n:i + 1, code:o.code, titulo:titulo(o), pilar:pilarLbl(o, true), fase:PT_FASE[o.code] || '', alerta:o.severity !== 'critico',
      faseCurta:faseCurtaDoGap(o.code), star:o.star, frase:frase, situacao:situacao,
      conseq:PT_CONSEQ[o.code] || (GAP_INFO[o.code] || {}).impact || '',
      fonte:f, mes:first ? f.mes : null,
      base:(o.fonte === 'time' && !roi.horasDoCliente) ? PT_FONTE_BASE.timeRef : ((o.fonte === 'erros' && semMOPropria()) ? PT_FONTE_BASE.errosTerc : (PT_FONTE_BASE[o.fonte] || '')),
      dep:(cs && cs.quote) ? cs.quote.replace(/^…\s*([a-zà-ú])/, function(m, c){ return '…' + c.toUpperCase(); }) : '',
      depA:(cs && cs.quote) ? (cs.nome + ' · ' + cs.papel) : ''
    };
  });
  var nCrit = criticos.length;
  // Source only when the engine computes it (o.fonte); otherwise a dash, never invented.
  // Remaining critical points (score 0 or 1) only, grouped by loss source; same rule as the tool's
  // Gaps table (gapsNumerados in script.js). Points in alert (score 1.5) are only counted.
  var demais = gapsNumerados(plan).map(function(o) {
      return { code:o.code, titulo:titulo(o), pilar:pilarLbl(o, false), fonteKey:o.fonte,
        fonte:(o.fonte && fontes[o.fonte]) || { label:'—' }, fase:PT_FASE[o.code] || '', faseCurta:faseCurtaDoGap(o.code) };
    });
  demais.forEach(function(d, i){ d.n = nCrit + i + 1; d.grpFirst = !i || demais[i - 1].fonteKey !== d.fonteKey; });
  var nGrp = {};
  demais.forEach(function(d){ nGrp[d.fonteKey] = (nGrp[d.fonteKey] || 0) + 1; });
  var alertaFase = {};
  plan.attention.forEach(function(o){ var fz = PT_FASE[o.code] || ''; alertaFase[fz] = (alertaFase[fz] || 0) + 1; });
  var critFonteKeys = Object.keys(fonteVista);
  var critPerda = critFonteKeys.reduce(function(a, k){ return a + fontes[k].perda; }, 0);
  var critMes = critPerda / prazo;
  var critCapMes = critFonteKeys.reduce(function(a, k){ return a + fontes[k].cap; }, 0) / prazo;

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
    reuniao2:S.reuniao2 || { data:'', hora:'', participantes:[] },
    criticos:criticos, demais:demais, totalAvaliados:plan.all.length, nGrp:nGrp,
    nCritTot:criticos.filter(function(c){ return !c.alerta; }).length + demais.length, nAlerta:plan.attention.length, alertaFase:alertaFase,
    nPrioAlerta:criticos.filter(function(c){ return c.alerta; }).length,
    critPerda:critPerda, critMes:critMes, critCapMes:critCapMes, mapaMes:roi.totalBase / prazo,
    cons:cons, pleno:pleno, pess:pess, perdaMes:comp(pleno), ganhoMes:comp(cons), ganhoPess:comp(pess),
    folha:folhaPropria(), horasInf:cons.operacional.horasInformadas, horasPot:cons.operacional.potPleno,
    ferr:f
  };
}

// ── Page fragments ───────────────────────────────────────────────────────
function ptSt(cls, word) { return '<span class="st ' + cls + '"><i></i>' + word + '</span>'; }
function ptStCls(p) { return p < 0.40 ? 'c' : (p < 0.90 ? 'a' : 'o'); }
function ptStWord(p) { return p < 0.40 ? 'Crítico' : (p < 0.90 ? 'Em alerta' : 'Estruturado'); }
function ptSec(num, titulo, first) {
  return '<div class="row sec' + (first ? ' first' : '') + '"><div class="secnum">' + num + '</div><div class="sectit">' + titulo + '</div></div>';
}
function ptDocNome(M) { return 'Relatório Diagnóstico SIIGA'; }
// Score level shown in the report: no "Parcial" wording (tool, admin and database keep the original text)
function ptNivel(n) { return /Parcialmente Estruturado/.test(n || '') ? 'Em alerta · Gargalos de escala' : n; }
function ptCarimbo(M, n, total) {
  return '<div><img src="' + PT_LOGO + '" alt="Agilean"></div>' +
    '<div><span class="k">Documento</span><b>' + (M.docRun || 'Diagnóstico SIIGA') + ' · ' + ptEsc(M.empresa) + '</b></div>' +
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
  var ext = PT_NUM_EXT_F[nC] || String(nC);
  var crit = M.criticos.map(function(c) {
    return '<tr><td>' + c.n + '</td><td><span class="b6">' + c.titulo + '</span>' + (c.frase ? '<span class="q">“' + ptEsc(c.frase.replace(/\.$/, '')) + '.”</span>' : '') + '</td>' +
      '<td>' + c.pilar + '</td><td style="white-space:nowrap">' + c.faseCurta + '</td>' +
      '<td class="n">' + (c.mes != null ? ptMil(c.mes, 1) : '—') + '</td></tr>';
  }).join('');
  var pctCrit = M.roi.totalBase ? Math.round(M.critPerda / M.roi.totalBase * 100) : 0;
  var lead = 'A perda estimada ' + ptPorObra(M) + ' é de <b>' + ptMilInt(M.roi.totalBase) + '</b> em ' + M.prazo + ' meses' +
    (M.obras > 1 ? ' (' + ptMilInt(M.roi.totalBase * M.obras) + ' no portfólio de ' + M.obras + ' obras)' : '') +
    '; as fontes de perda ligadas ' + (nC === 1 ? 'à prioridade respondem' : 'às ' + ext + ' prioridades respondem') +
    ' por <b>' + ptMilInt(M.critPerda) + '</b> (' + pctCrit + '%).';
  var escopo = [ptObrasTxt(M), ptMilVar(M.orc) + (M.obras > 1 ? ' por obra' : ''), M.prazo + ' meses', M.moTxt].filter(Boolean).join(' · ');
  var meta = '<div class="meta" style="margin-top:5mm">' +
    (M.entrevistado ? '<div><span class="lbl">Entrevistado</span>' + ptEsc(M.entrevistado) + '</div>' : '') +
    (M.consultor ? '<div><span class="lbl">Consultor</span>' + ptEsc(M.consultor) + ', Agilean</div>' : '') +
    (M.data ? '<div><span class="lbl">Data</span>' + M.data + '</div>' : '') +
    '<div><span class="lbl">Escopo</span>' + escopo + '</div></div>';

  var b1 = ptSec('01', 'Resumo executivo', true) +
    '<div class="row" style="margin-top:5mm"><div>' +
      '<div class="lbl">Score de maturidade</div>' +
      '<div class="score">' + ptNum(M.score.score, 0, 1) + '<small>/' + M.score.max + '</small></div>' +
      '<div style="margin-top:1mm">' + ptSt(ptStCls(M.score.pct), ptNivel(M.score.nivel)) + '</div>' +
      '<div class="note" style="margin-top:.6mm">' + ptPct(M.score.pct) + ' da pontuação máxima</div>' + meta +
    '</div><div>' +
      '<p class="lead">' + lead + '</p>' +
      '<div style="margin-top:6mm">' +
        '<div class="chart-t">' + M.worst.nome + ' é o pilar de menor maturidade, com ' + Math.round(M.worst.pct * 100) + '% da pontuação máxima</div>' +
        '<div class="bars">' + bars + '</div>' +
        '<div class="axis"><div></div><div class="ticks"><span style="left:0">0</span><span style="left:25%">25</span><span style="left:50%">50</span><span style="left:75%">75</span><span style="left:100%">100%</span></div><div></div><div></div></div>' +
        '<div class="leg"><span><i class="sw-cli"></i>' + ptEsc(M.empresa) + '</span><span><i class="sw-mkt"></i>Média de mercado</span><span><i class="sw-ref"></i>Referência SIIGA (100%)</span></div>' +
      '</div></div></div>';
  var blocks = [{ sec:'01', html:b1 }];
  if (nC) {
    blocks.push({ sec:'01', html:'<div class="row sec"><div><div class="lbl rule">Prioridades</div><div class="note" style="margin-top:1.5mm">' + (nC - M.nPrioAlerta) + ' de ' + M.nCritTot + ' pontos críticos' + (M.nPrioAlerta ? '; ' + M.nPrioAlerta + (M.nPrioAlerta === 1 ? ' ponto em alerta com dor declarada' : ' pontos em alerta com dor declarada') : '') + '</div></div><div>' +
      '<table><thead><tr><th style="width:5mm">#</th><th>Prioridade</th><th style="width:15mm">Pilar</th><th style="width:38mm">Fase de Implementação</th><th class="n wrap" style="width:24mm">Perda por mês sem tratamento</th></tr></thead>' +
      '<tbody>' + crit + '<tr class="tot"><td></td><td>Total ' + (nC === 1 ? 'da prioridade' : 'das ' + nC + ' prioridades') + '</td><td></td><td></td><td class="n">' + ptMil(M.critMes, 1) + '/mês</td></tr>' +
      '<tr class="rec"><td></td><td colspan="3">Recuperável com o plano</td><td class="n">' + ptMil(M.critCapMes, 1) + '/mês</td></tr></tbody></table></div></div>' });
  }
  return blocks;
}

// Section 02: total loss and monthly gain on the loss-map base (same R$ total as section 01).
// Values per project; the hours+payroll model stays only in Annex A.4.
function ptSecPerdaGanho(M) {
  var P = M.prazo, porObra = M.obras > 1;
  var perdaMes = M.roi.totalBase / P, ganhoMes = M.roi.totalPorObra / P;
  var capPct = M.roi.totalBase ? M.roi.totalPorObra / M.roi.totalBase : 0;
  var linked = {};
  M.criticos.forEach(function(c){ (linked[c.fonte.key] = linked[c.fonte.key] || []).push(c.n); });
  var itens = M.roi.items.map(function(it){ return M.fontes[it.key]; });
  var porPerda = itens.slice().sort(function(a, b){ return b.perda - a.perda; });
  var mx = porPerda.length ? porPerda[0].perda / P : 0;
  var w = function(v) { return mx ? (v / (mx * 1.22) * 100).toFixed(1) + '%' : '0%'; };
  var lab = function(v) { return ptNum(v / 1000, 1, 1); };
  var chart = '<div style="margin-top:6mm"><div class="chart-t">' + ptMil(ganhoMes, 1) + ' dos ' + ptMil(perdaMes, 1) + ' de perda estimada por mês' + (porObra ? ', por obra,' : '') + ' são recuperáveis com o plano</div>' +
    porPerda.map(function(f) {
      return '<div class="pf"><div class="nm">' + f.labelTab + '</div><div class="bb">' +
        '<div class="ln p"><i style="width:' + w(f.mes) + '"></i><span>' + lab(f.mes) + '</span></div>' +
        '<div class="ln g"><i style="width:' + w(f.cap / P) + '"></i><span>' + lab(f.cap / P) + '</span></div></div></div>';
    }).join('') +
    '<div class="leg5"><span><i class="p"></i>Perda por mês (R$ mil)</span><span><i class="g"></i>Ganho mensal com o plano (R$ mil)</span></div></div>';
  var baseInf = '<div class="meta"><div class="lbl rule" style="margin-bottom:2.4mm">Base informada</div>' +
    '<div><span class="lbl">' + (porObra ? 'Orçamento médio por obra' : 'Orçamento da obra') + '</span>' + ptMilVar(M.orc) + '</div>' +
    '<div><span class="lbl">Prazo</span>' + P + ' meses</div>' +
    '<div><span class="lbl">' + (porObra ? 'Obras' : 'Obra') + '</span>' + M.obras + (M.moTxt ? ' · ' + M.moTxt : '') + '</div></div>';
  var b1 = ptSec('02', 'Perda e ganho mensal', true) +
    '<div class="row" style="margin-top:5mm">' + baseInf + '<div>' +
      '<div class="strip two"><div><div class="lbl">Perda estimada por mês</div><div class="big p">' + ptMil(perdaMes, 1) + '</div></div>' +
      '<div><div class="lbl">Ganho mensal</div><div class="big g">' + ptMil(ganhoMes, 1) + '</div></div></div>' +
      chart + '</div></div>';
  var rows = itens.map(function(f) {
    var l = linked[f.key];
    return '<tr><td>' + f.labelTab + '</td><td class="n">' + ptMil(f.mes, 1) + '</td><td class="n">' + ptPct(f.capEf) + '</td><td class="n">' + ptMil(f.cap / P, 1) + '</td><td style="padding-left:5mm">' +
      (l ? ptPrioLista(l) : '—') + '</td></tr>';
  }).join('');
  var portf = porObra ? '<tr class="tot"><td>Total no portfólio (' + M.obras + ' obras)</td><td class="n">' + ptMil(M.roi.totalBase * M.obras / P, 1) + '</td><td class="n"></td><td class="n">' + ptMil(M.roi.totalPortfolio / P, 1) + '</td><td></td></tr>' : '';
  var b2 = '<div class="row sec"><div><div class="lbl rule">Composição</div></div><div><table><thead><tr><th>Fonte de perda</th><th class="n" style="width:22mm">Perda/mês</th><th class="n" style="width:16mm">Captura</th><th class="n" style="width:24mm">Ganho/mês</th><th class="wrap" style="width:31mm;padding-left:5mm">Prioridade ligada</th></tr></thead><tbody>' + rows +
    '<tr class="tot"><td>' + (porObra ? 'Total por obra' : 'Total, 1 obra') + '</td><td class="n perda">' + ptMil(perdaMes, 1) + '</td><td class="n"></td><td class="n ganho">' + ptMil(ganhoMes, 1) + '</td><td></td></tr>' + portf + '</tbody></table><div class="src">Nas fontes Horas do time de gestão e Custo indireto do prazo a captura é 100%: a perda já é a parte que o SIIGA elimina (a parte manual das rotinas e o tempo a mais de obra).</div></div></div>';
  return [{ sec:'02', html:b1 }, { sec:'02', html:b2 }];
}

function ptSecCriticos(M) {
  var head = ptSec('03', 'Prioridades', true) +
    '<div class="row" style="margin-top:5mm"><div class="lbl rule">Pilar de menor maturidade</div>' +
    '<div style="border-top:.75pt solid var(--tinta);padding-top:2mm"><span class="b6">Pilar ' + M.worst.n + ', ' + M.worst.nome + '</span> · ' + ptNum(M.worst.pts, 0, 1) + ' de ' + M.worst.max + ' pontos (' + Math.round(M.worst.pct * 100) + '%), menor percentual</div></div>';
  var blocks = [];
  M.criticos.forEach(function(c, i) {
    var f = c.fonte;
    var html = '<div class="pc row"' + (i === 0 ? ' style="margin-top:4mm"' : '') + '>' +
      '<div><div class="lbl">Prioridade ' + c.n + '</div><div class="note" style="margin-top:1mm">' + c.pilar + (c.fase ? '<br>Fase de Implementação ' + c.fase : '') + '</div>' +
        (c.star ? '<div class="note" style="margin-top:1mm">' + (c.alerta ? 'Em alerta · dor declarada pelo cliente' : 'Dor declarada pelo cliente') + '</div>' : '') + '</div>' +
      '<div><div class="tt">' + c.titulo + '</div><div class="in"><div>' +
        '<div class="kv"><span class="lbl">Situação registrada</span><div class="txt">' + ptEsc(c.situacao) + '</div>' + (c.frase ? '<span class="q" style="margin-bottom:1.6mm">“' + ptEsc(c.frase) + '”</span>' : '') + '</div>' +
        '<div class="kv"><span class="lbl">Consequência</span><div class="txt">' + ptEsc(c.conseq) + '</div></div>' +
        (c.mes != null ? '<div class="mes">Perda por mês sem tratamento: <b>' + ptMil(c.mes, 1) + '</b></div>' : '') +
      '</div><div>' +
        '<div class="kv"><span class="lbl">Fonte de perda</span><div class="txt b6">' + f.label + '</div>' +
          '<div class="vals"><div>' + ptMil(f.mes, 1) + '<small>Perda por mês</small></div><div class="ganho">' + ptMil(f.cap / M.prazo, 1) + '<small>Ganho por mês</small></div></div>' +
          '<div class="note">' + c.base + '</div>' +
          ((f.key === 'time' || f.key === 'velocidade') ? '<div class="note" style="margin-top:1mm">Nesta fonte a perda já é a parte que o SIIGA elimina (' + (f.key === 'time' ? 'a parte manual das rotinas' : 'o tempo a mais de obra') + '); a captura é 100%.</div>' : '') + '</div>' +
        (c.dep ? '<div class="kv"><span class="lbl">Depoimento de Cliente Agilean</span><div class="dep">“' + ptEsc(c.dep) + '”</div><div class="dep-a">' + ptEsc(c.depA) + '</div></div>' : '') +
      '</div></div></div></div>';
    blocks.push({ sec:'03', html:(i === 0 ? head : '') + html });
  });
  if (!blocks.length) blocks.push({ sec:'03', html:head });
  return blocks;
}

function ptAlertaTxt(M) {
  var n = M.nAlerta;
  if (!n) return '';
  return (n === 1 ? 'Outro ponto está em alerta' : 'Outros ' + n + ' pontos estão em alerta') +
    ': a prática existe, mas é informal. ' + (n === 1 ? 'Ele entra' : 'Eles entram') + ' no plano de implantação.';
}
function ptSecDemais(M) {
  var tot = M.demais.length, alerta = ptAlertaTxt(M);
  if (!tot && !alerta) return [];
  var head = ptSec('04', 'Demais pontos críticos', true);
  var nota = alerta ? '<p class="note" style="margin-top:3mm">' + alerta + '</p>' : '';
  if (!tot) return [{ sec:'04', html:head + nota }];
  var prioDa = {};
  M.criticos.forEach(function(c){ (prioDa[c.fonte.key] = prioDa[c.fonte.key] || []).push(c.n); });
  var blocks = [];
  blocks.push({ sec:'04', head:head, rows:M.demais, render:function(rows, first, last) {
    var tr = rows.map(function(d, i) {
      var g = '';
      if (d.grpFirst || i === 0) {
        var f = d.fonte, nG = M.nGrp[d.fonteKey] || 0, pr = prioDa[d.fonteKey];
        g = '<tr class="grp"><td colspan="4"><span class="gl">Fonte de perda</span><b class="b6">' + f.label + '</b>' + (d.grpFirst ? '' : ' (continuação)') +
          '<div class="gsub">' + (f.mes != null ? ptMil(f.mes, 1) + ' por mês sem tratamento · ' : '') + nG + (nG === 1 ? ' ponto' : ' pontos') +
          (pr ? ' · mesma fonte da ' + ptPrioLista(pr) : '') + '</div></td></tr>';
      }
      return g + '<tr><td>' + ptPad(d.n) + '</td><td class="b6">' + d.titulo + '</td><td>' + d.pilar + '</td><td style="white-space:nowrap">' + d.faseCurta + '</td></tr>';
    }).join('');
    return '<div style="margin-top:5mm">' + (first ? '<div class="lbl" style="margin-bottom:2mm">Por fonte de perda · ' + tot + (tot === 1 ? ' ponto crítico' : ' pontos críticos') + '</div>' : '') +
      '<table><thead><tr><th style="width:7mm">#</th><th>Ponto</th><th style="width:10mm">Pilar</th><th style="width:36.8mm">Fase</th></tr></thead><tbody>' + tr + '</tbody></table>' + (last ? nota : '') + '</div>';
  }});
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
    erpEnt = 'Integração nativa com o ' + ERP[erpV] + ': ' + (M.mo === 'terceirizada' ? 'orçamento e medição' : 'orçamento, medição e folha') + ' sincronizados, sem digitação duplicada.';
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
  // Phase III: one routine per front of the labor model (no payroll row without own labor)
  var rotIII = { 'Controle de Empreiteiros':['Controle de Contratos / Empreiteiros', ptFerrLabel(f.contratos), 'Negociação de medição desgastante; sem evidência objetiva para liberar pagamento.', 'Medição de empreiteiros baseada em avanço apontado e FVS aprovada.'],
    'Folha de Produção':['Folha de Produção / Fechamento de MO', ptFerrLabel(f.folha), 'Fechamento manual e lento; produtividade por equipe sem rastreabilidade.', 'Fechamento de folha e produtividade por HH em horas' + (semErp ? '.' : ', integrado ao ERP.')] };
  return {
    I:[['Planejamento & Reprogramação', ptFerrLabel(f.planejamento), planSit, planEnt],
       ['Medição de Avanço Físico', ptFerrLabel(f.medicao), 'Sistemas desconectados; avanço apurado manualmente, sem rastreio diário.', 'Apontamento diário via app; lookahead de 4 semanas com remoção de restrições medida pelo IRR.'],
       ['Painéis de indicadores', '—', p4Sit, 'Painéis de indicadores e reunião executiva com dados consolidados.']],
    II:[['Qualidade (FVS)', ptFerrLabel(f.qualidade), 'Retrabalhos identificados tarde; qualidade tratada como auditoria separada do pagamento.', 'FVS digital vinculada ao avanço físico.'],
        ['ERP / Sistema de Gestão', ptEsc(erpNome), erpSit, erpEnt]],
    III:ptFrentesIII(M.mo).map(function(fr){ return rotIII[fr.nome]; })
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
    '<div class="gsub">' + fase.dur + '</div></td></tr>' +
    linhas.map(function(l){ return '<tr><td class="b6">' + l[0] + '</td><td>' + l[1] + '</td><td>' + l[2] + '</td><td>' + l[3] + '</td></tr>'; }).join('');
}
function ptRegua(M) {
  var fr = ptFases(M.mo)[2].frentes;
  // The axis ends at the last Phase III front (day 90 or 150), in 30-day steps
  var D = Math.max.apply(null, fr.map(function(f){ return f.fim; })), x = function(v){ return (v / D * 100).toFixed(2) + '%'; };
  var marks = [];
  for (var v = 0; v <= D; v += 30) marks.push(v);
  var ticks = marks.map(function(v){ return '<span style="left:' + x(v) + '">' + v + '</span>'; }).join('');
  var lines = marks.map(function(v){ return '<i style="left:' + x(v) + '"></i>'; }).join('');
  // A label that does not fit inside its bar (short bars) goes right after it, on a paper background over the grid
  var row = function(nome, a, b, cls, txt, sub) {
    var dentro = (b - a) / D >= 0.30;
    return '<div class="tl' + (sub ? ' sub' : '') + '"><div class="nm">' + nome + '</div><div class="tp"><div class="tb ' + cls + '" style="left:' + x(a) + ';width:' + x(b - a) + '">' + (dentro ? txt : '') + '</div>' +
      (dentro ? '' : '<div class="tbl" style="left:' + x(b) + '">' + txt + '</div>') + '</div></div>';
  };
  var frentes = fr.map(function(f){ return row(f.nome, f.ini, f.fim, 'c', f.rot, true); }).join('');
  var tit = fr.length === 1 ? fr[0].art + fr[0].nome + ' vai do dia ' + fr[0].ini + ' ao dia ' + fr[0].fim
    : fr[0].art + fr[0].nome + ' termina no dia ' + fr[0].fim + ' e ' + fr[1].art + fr[1].nome + ', no dia ' + fr[1].fim;
  return '<div class="chart-t">As Fases I e II ocupam os primeiros 60 dias; na Fase III, ' + tit + '</div>' +
    '<div style="position:relative"><div class="tgrid">' + lines + '</div>' +
    row('Fase de Implementação I', 0, 60, 'a', 'até 60 dias') + row('Fase de Implementação II', 0, 60, 'b', 'até 60 dias, em paralelo') +
    '<div class="tl grp"><div class="nm">Fase de Implementação III</div><div></div></div>' + frentes +
    '</div><div class="tticks">' + ticks + '</div>';
}
function ptResolve(M, faseId) {
  var cr = M.criticos.filter(function(c){ return c.fase === faseId; }).map(function(c){ return String(c.n); });
  var dm = M.demais.filter(function(d){ return d.fase === faseId; }).map(function(d){ return ptPad(d.n); });
  var parts = [];
  var na = (M.alertaFase || {})[faseId] || 0;
  if (cr.length) parts.push((cr.length === 1 ? 'prioridade ' : 'prioridades ') + ptLista(cr));
  if (dm.length) parts.push((dm.length === 1 ? 'ponto crítico ' : 'pontos críticos ') + ptLista(dm));
  if (na) parts.push(na + (na === 1 ? ' ponto em alerta' : ' pontos em alerta'));
  return parts.length ? 'Resolve: ' + parts.join('; ') + '.' : '';
}

// Section 05: Plano de Transformação Operacional (the former loss-by-source table now lives in section 02).
function ptSecPlano(M) {
  var R = ptRotinas(M), FZ = ptFases(M.mo);
  var blocks = [];
  // Phases I+II, Phase III, timeline, action card, signatures (round 3 order)
  blocks.push({ sec:'05', head:ptSec('05', ptPlano06(M)), rows:[0, 1], render:function(rows) {
    return '<div style="margin-top:5mm"><table>' + PT_PLANO_THEAD + '<tbody>' + rows.map(function(i){ return ptFaseGroup(FZ[i], R[FZ[i].id], M); }).join('') + '</tbody></table></div>';
  }});
  blocks.push({ sec:'05', html:'<div style="margin-top:7mm"><table>' + PT_PLANO_THEAD + '<tbody>' + ptFaseGroup(FZ[2], R.III, M) + '</tbody></table></div>' });
  blocks.push({ sec:'05', html:'<div style="margin-top:7mm">' + ptRegua(M) + '</div>' });
  var frentes = FZ.map(function(fz, i) {
    var res = ptResolve(M, fz.id);
    return '<div class="fr"><div class="nn">0' + (i + 1) + '</div><div><div class="ft">Fase de Implementação ' + fz.id + ' · ' + ptFaseNome(fz, M) + '</div><div class="fd">' + fz.fd + '</div>' + (res ? '<div class="fz">' + res + '</div>' : '') + '</div></div>';
  }).join('');
  blocks.push({ sec:'05', html:'<div style="margin-top:9mm" class="plano"><div class="kk sq">Plano de ação executivo</div><h3>Fases de Implementação e pontos atendidos</h3>' + frentes + '</div>' });
  var sig = [];
  if (M.consultor) sig.push('<div><span class="lbl">Elaborado por (Agilean)</span><b class="b6">' + ptEsc(M.consultor) + '</b><br>Consultor Agilean</div>');
  if (M.contato) sig.push('<div><span class="lbl">Responsável pela empresa</span><b class="b6">' + ptEsc(M.contato) + '</b>' + (M.cargo ? '<br>' + ptEsc(M.cargo) : '') + '</div>');
  // "Próximo passo" and the signatures form one block, so the signatures never end up alone on a sheet
  blocks.push({ sec:'05', html:ptBlocoReuniao2(M) + (sig.length ? '<div class="sign">' + sig.join('') + '</div>' : '') });
  return blocks;
}

// "Próximo passo": 2nd meeting block, section 06 (between the action plan and the signatures).
// Resumido: compact (no intro sentence, no participants table); Detalhado: full.
function ptHoraBR(h) { var p = String(h || '').split(':'); return p.length < 2 ? '' : (p[1] === '00' ? (+p[0]) + 'h' : (+p[0]) + 'h' + p[1]); }
function ptBlocoReuniao2(M) {
  var R = M.reuniao2 || {};
  var pp = (R.participantes || []).filter(function(p){ return (p.nome || '').trim(); });
  var emp = ptEsc(M.empresa);
  var titulo = '2º encontro: apresentação do projeto de implementação de melhorias';
  var strip = '<div class="strip">' +
    '<div><div class="lbl">Data</div><div class="r2-v' + (R.data ? '' : ' pend') + '">' + (R.data ? ptDataBR(R.data) : 'A definir') + '</div></div>' +
    '<div><div class="lbl">Horário</div><div class="r2-v' + (R.hora ? '' : ' pend') + '">' + (R.hora ? ptHoraBR(R.hora) : 'A definir') + '</div></div>' +
    '<div><div class="lbl">Participação recomendada</div><div class="r2-pp">Decisores da empresa (diretoria), além de quem respondeu ao diagnóstico.</div></div></div>';
  // The participants table appears in both versions, only when a date and participants exist
  var tabela = (R.data && pp.length)
    ? '<table><thead><tr><th>Participante confirmado</th><th>Cargo</th></tr></thead><tbody>' +
      pp.map(function(p){ return '<tr><td class="b6">' + ptEsc(p.nome) + '</td><td>' + (p.cargo ? ptEsc(p.cargo) : '—') + '</td></tr>'; }).join('') + '</tbody></table>'
    : '';
  if (!M.det) {
    // Compact (Resumido): the title moves to the label column; no sentence or source line.
    return '<div class="row sec enc2 cmp"><div><div class="lbl rule">Próximo passo</div><div class="r2-tc">' + titulo + '</div></div><div>' + strip + tabela + '</div></div>';
  }
  var html = '<div class="row sec enc2"><div><div class="lbl rule">Próximo passo</div></div><div>' +
    '<h3 class="r2-t">' + titulo + '</h3>' +
    '<p class="r2-p">A Agilean apresenta ' + (M.art ? 'à ' : 'a ') + '<b>' + emp + '</b> o projeto de implementação de melhorias, feito a partir deste diagnóstico.</p>' + strip;
  html += tabela;
  html += '</div></div>';
  return html;
}

function ptSecBases(M) {
  var refs = [['Mão de obra como % do custo da obra', '45%']];
  if (M.mo !== 'terceirizada') refs.push(['Estouro médio de mão de obra', '15%']);
  refs.push(['Retrabalhos (referência de mercado)', ptPct(M.roi.pctRetrabalho || 0.10) + ' do portfólio'], ['Custos indiretos × redução de prazo com o SIIGA', '15% do orçamento × 10%'],
    ['Custo de referência da hora técnica', 'R$ ' + ROI_REAL_K.CUSTO_HORA_TECNICA + '/h'],
    ['Média de mercado por pilar (P1 a P4)', ['f1','f2','f3','f4'].map(function(k){ return ptPct(PT_MERCADO[k]); }).join(' · ')]);
  var oper = [['Obras em andamento', String(M.obras)], [M.obras === 1 ? 'Orçamento da obra' : 'Orçamento médio por obra', ptMilVar(M.orc)], ['Prazo da obra', M.prazo + ' meses'],
    ['Horas de gestão informadas', M.horasInf > 0 ? ptNum(M.horasInf, 0, 1) + ' h/mês' : 'Não informadas']];
  if (M.folha > 0) oper.push(['Folha de produção', ptMilVar(M.folha) + '/mês']);
  oper.push(['Cenário adotado', ptPct(ROI_CAPTURA_FIXA) + ' · ' + roiCapturaLabel(ROI_CAPTURA_FIXA)]);
  var glos = [['P1 a P4', 'Pilares: P1 ' + PT_PILAR_NOME.f1 + '; P2 ' + PT_PILAR_NOME.f2 + '; P3 ' + PT_PILAR_NOME.f3 + '; P4 ' + PT_PILAR_NOME.f4 + '.'],
    ['EAP','Estrutura analítica do projeto.'],['FVS','Ficha de verificação de serviço.']].concat(semMOPropria() ? [] : [['HH','Homem-hora.']], [['IRR','Índice de remoção de restrições.'],
    ['Lookahead','Planejamento de médio prazo, com janela de semanas à frente da execução.'],['MO','Mão de obra.'],['PPC','Percentual de planos concluídos.'],
    ['Ajuste pela maturidade','Parte da perda estimada de cada fonte (20% a 70%), conforme a maturidade dos pilares ligados à fonte.']]);
  var t2 = function(rows) { return rows.map(function(r){ return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>'; }).join(''); };
  return [
    { sec:'06', breakBefore:true, html:ptSec('06', 'Bases do diagnóstico', true) + '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Referências de mercado</div></div><div><table><thead><tr><th>Parâmetro</th><th class="n">Valor</th></tr></thead><tbody>' + t2(refs) + '</tbody></table></div></div>' },
    { sec:'06', html:'<div class="row sec"><div><div class="lbl rule">Dados da operação</div></div><div><table><thead><tr><th>Dado</th><th class="n">Valor</th></tr></thead><tbody>' + t2(oper) + '</tbody></table>' +
      '<div class="src">Fonte: entrevista de diagnóstico' + (M.data ? ', ' + M.data : '') + '.</div></div></div>' },
    { sec:'06', html:'<div class="row sec"><div><div class="lbl rule">Glossário</div></div><div><table><tbody>' + glos.map(function(g){ return '<tr><td class="b6" style="width:44mm">' + g[0] + '</td><td>' + g[1] + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="note" style="margin-top:3mm">Estimativa a partir dos dados informados no diagnóstico e de referências de mercado; não representa garantia contratual.</p></div></div>' }
  ];
}

function ptSecAnexo(M) {
  var orcT = ptMilVar(M.orc), P = M.prazo, F = M.fontes, cap = ptPct(ROI_CAPTURA_FIXA), custoH = ROI_REAL_K.CUSTO_HORA_TECNICA;
  var hasMo = !!F.mo;
  var pres = [['Mão de obra como % do custo da obra', '45%']];
  if (hasMo) pres.push(['Estouro médio de mão de obra', '15%'], ['Redução do estouro de MO com o SIIGA', '70% (referência SIIGA)']);
  pres.push(['Retrabalho de referência de mercado', '10% do portfólio'], ['Redução do retrabalho com o SIIGA', '40% (referência SIIGA)'], ['Redução dos erros de medição' + (semMOPropria() ? '' : ' e folha') + ' com o SIIGA', '70% (referência SIIGA)'],
    [semMOPropria() ? 'Desvio médio de medição' : 'Desvio médio de medição e folha', '5%'],
    ['Custos indiretos do prazo (equipe, equipamentos, canteiro)', '15% do orçamento'], ['Redução de prazo com o SIIGA', '10% (referência SIIGA)'],
    ['Ajuste pela maturidade', '20% a 70%, por fonte'], ['Horas de gestão recuperáveis', ptNum(M.roi.horasRecup, 0, 1) + ' h/mês' + (M.roi.horasDoCliente ? '' : ' (referência de mercado)')], ['Prazo da obra', P + ' meses']);
  var a1 = ptSec('A', 'Anexo A · Memória de cálculo', true) + '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">A.1 Pressupostos</div></div><div><table class="ax"><thead><tr><th>Parâmetro</th><th class="n">Valor</th></tr></thead><tbody>' +
    pres.map(function(r){ return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  var hR = ptNum(M.roi.horasRecup, 0, 1);
  var adj = function(k){ return F[k] ? ' × ' + ptPct(F[k].fator) + ' (ajuste)' : ''; };
  var form = {
    time: hR + ' h/mês × R$ ' + custoH + '/h × ' + P + ' meses' + adj('time') + '; ' + (M.roi.horasDoCliente ? hR + ' h = horas informadas × economia de cada rotina (40% planejar, 90% demais)' : 'referência de mercado: ' + ptNum(M.roi.horasRefMercado, 0, 1) + ' h/mês nas rotinas × ' + Math.round(M.roi.economiaMedia * 100) + '% de economia média = ' + hR + ' h/mês recuperáveis (horas não informadas)'),
    retrabalho: 'Orçamento ' + orcT + ' × 10%' + adj('retrabalho'),
    velocidade: 'Orçamento ' + orcT + ' × 15% (custos indiretos) × 10% (redução de prazo com o SIIGA)' + adj('velocidade'),
    erros: 'Orçamento ' + orcT + ' × 45% × 5%' + adj('erros'),
    mo: (M.mo === 'mista' ? 'Orçamento ' + orcT + ' × 45% × 50% × 15%' : 'Orçamento ' + orcT + ' × 45% × 15%') + adj('mo')
  };
  var a2rows = M.roi.items.map(function(it){ var f = F[it.key]; return '<tr><td>' + f.labelTab + '</td><td class="f">' + form[it.key] + '</td><td class="n">' + ptMil(f.perda, 1) + '</td></tr>'; }).join('');
  var mesRows = M.criticos.filter(function(c){ return c.mes != null; }).map(function(c, i) {
    return '<tr><td>Prioridade ' + c.n + ' (' + c.fonte.label + ')</td><td class="f">' + (i === 0 ? 'Perda da fonte ÷ meses de obra: ' : '') + ptMil(c.fonte.perda, 1) + ' ÷ ' + P + '</td><td class="n">' + ptMil(c.mes, 1) + '</td></tr>';
  }).join('');
  var nC = M.criticos.length;
  var a2 = '<div class="row sec"><div><div class="lbl rule">A.2 Perda estimada por fonte</div></div><div><table class="ax"><thead><tr><th style="width:44mm">Fonte de perda</th><th>Fórmula (' + P + ' meses)</th><th class="n" style="width:20mm">Valor</th></tr></thead><tbody>' + a2rows +
    '<tr class="tot"><td>Total</td><td></td><td class="n">' + ptMil(M.roi.totalBase, 1) + '</td></tr></tbody></table>' +
    (nC ? '<table class="ax" style="margin-top:6mm"><thead><tr><th style="width:44mm">Perda por mês sem tratamento</th><th>Fórmula</th><th class="n" style="width:24mm">Valor</th></tr></thead><tbody>' + mesRows +
      '<tr class="tot"><td>Total ' + (nC === 1 ? 'da prioridade' : 'das ' + nC + ' prioridades') + '</td><td class="f">' + ptMil(M.critPerda, 1) + ' ÷ ' + P + '</td><td class="n">' + ptMil(M.critMes, 1) + '</td></tr>' +
      '<tr><td>Perda total do Mapa (contexto)</td><td class="f">' + ptMil(M.roi.totalBase, 1) + ' ÷ ' + P + '</td><td class="n">' + ptMil(M.mapaMes, 1) + '</td></tr></tbody></table>' : '') + '</div></div>';
  var a3rows = M.roi.items.map(function(it){ var f = F[it.key]; return '<tr><td>' + f.labelTab + '</td><td class="f">' + ptMil(f.perda, 1) + ' × ' + ptPct(f.reducao) + (f.reducao < 1 ? '' : '') + '</td><td class="n">' + ptPct(f.capEf) + '</td><td class="n">' + ptMil(f.cap, 1) + '</td></tr>'; }).join('');
  var a3 = '<div class="row sec"><div><div class="lbl rule">A.3 Redução e ganho</div></div><div><table class="ax"><thead><tr><th style="width:44mm">Fonte de perda</th><th>Fórmula (perda × redução)</th><th class="n" style="width:16mm">Captura</th><th class="n" style="width:20mm">Ganho</th></tr></thead><tbody>' + a3rows +
    '<tr class="tot"><td>Total</td><td></td><td class="n">' + ptPct(M.roi.totalBase ? M.roi.totalPorObra / M.roi.totalBase : 0) + '</td><td class="n">' + ptMil(M.roi.totalPorObra, 1) + '</td></tr></tbody></table>' +
    '<div class="src">Ganho = perda estimada × redução com o SIIGA (referência SIIGA); captura = ganho ÷ perda = a redução de cada fonte. O ajuste pela maturidade (20% a 70% por fonte; quanto menor a maturidade, maior o ajuste) já está na perda estimada (A.2). Em Horas do time de gestão e Custo indireto do prazo a captura é 100%: a perda já é a parte que o SIIGA elimina (a parte manual das rotinas e o tempo a mais de obra). Ajustes arredondados na exibição; cálculo com o valor exato.</div></div></div>';
  var Pm = M.perdaMes, G = M.ganhoMes, temFolha = (Pm.retr + Pm.indev) > 0;
  var hPot = M.horasPot, hMes = M.cons.operacional.hMes;
  var compR = '<tr><td>Horas do time técnico</td><td class="f">' + ptHoras(hPot) + ' × R$ ' + custoH + '/h; ganho: horas recuperadas (' + ptHoras(hMes) + ') × R$ ' + custoH + '/h</td><td class="n">' + ptMil(Pm.horas, 2) + '</td><td class="n">' + ptMil(G.horas, 2) + '</td></tr>' +
    (temFolha ? '<tr><td>Retrabalho pago na folha</td><td class="f">Folha de MO própria × 5% de retrabalho; ganho: × captura do cenário (' + cap + ')</td><td class="n">' + ptMil(Pm.retr, 2) + '</td><td class="n">' + ptMil(G.retr, 2) + '</td></tr>' +
      '<tr><td>Pagamentos indevidos na folha</td><td class="f">Folha de MO própria × 5% indevidos × 80% sem sobreposição; ganho: × ' + cap + '</td><td class="n">' + ptMil(Pm.indev, 2) + '</td><td class="n">' + ptMil(G.indev, 2) + '</td></tr>' : '');
  var gp = M.ganhoPess.total;
  var ind = [['Potencial pleno de horas', 'Horas informadas em cada rotina × % de economia da rotina (40% planejar, 90% demais)', ptNum(hPot, 0, 1) + ' h/mês'],
    ['Horas recuperadas por mês', 'Potencial pleno × captura do cenário (' + cap + ')', ptNum(hMes, 0, 1) + ' h/mês'],
    ['Horas recuperadas por obra', 'Horas recuperadas por mês × prazo da obra (' + P + ' meses)', ptHoras(M.cons.operacional.hObra)],
    ['Horas recuperadas no mês de 1 profissional', ptHoras(hMes) + ' ÷ ' + ROI_REAL_K.JORNADA + ' h úteis por mês', ptNum(M.cons.operacional.pctJornada * 100, 1, 1) + '%'],
    ['Cenário Pessimista (30%)', 'Horas recuperadas por mês: ' + ptHoras(M.pess.operacional.hMes), ptMil(gp, 2) + '/mês']];
  var a4 = '<div class="row sec"><div><div class="lbl rule">A.4 Retorno mensal</div></div><div><p class="note" style="margin-top:4mm">Premissas: captura do cenário ' + cap + ' (Conservador)' +
      (M.folha > 0 ? '; folha de MO própria ' + ptMilVar(M.folha) + '/mês' : '') + '; hora técnica R$ ' + custoH + '/h; horas de gestão informadas ' + ptNum(M.horasInf, 0, 1) + ' h/mês.</p>' +
    '<div style="margin-top:4mm"><table class="ax"><thead><tr><th style="width:44mm">Componente</th><th>Fórmula</th><th class="n wrap" style="width:22mm">Perda/mês (' + (temFolha ? 'horas e folha' : 'horas') + ')</th><th class="n" style="width:20mm">Ganho/mês</th></tr></thead><tbody>' + compR +
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
  '03':{ run:'Prioridades', toc:'Prioridades', cls:'tight' },
  '04':{ run:'Demais pontos críticos', toc:'Demais pontos críticos', cls:'tight dense', flowIfWhole:true },
  '05':{ run:'Plano de Transformação Operacional', toc:null, cls:'', flow:true },
  '06':{ run:'Bases do diagnóstico', toc:'Bases do diagnóstico', cls:'tight' },
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
    var meta = (M.secoes || PT_SECOES)[sec];
    var pg = document.createElement('div');
    pg.className = 'page ' + (meta.cls || '');
    pg.innerHTML = '<div class="run"><span><b>' + (M.docRun || 'Diagnóstico SIIGA') + '</b> · ' + ptEsc(M.empresa) + '</span><span>' + sec + ' ' + meta.run + '</span></div>' +
      '<div class="body"></div><div class="carimbo">' + ptCarimbo(M, 0, 0) + '</div>';
    root.appendChild(pg);
    cur = { el:pg, body:pg.querySelector('.body'), sec:sec, n:0 };
    pages.push(cur);
    if (cont && !meta.noCont) {
      var t = (sec === '05' && !M.secoes) ? ptPlano06(M) : meta.run;
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
    var meta = (M.secoes || PT_SECOES)[b.sec];
    var secChange = !cur || cur.sec !== b.sec;
    // flowIfWhole: the section starts on the current sheet when it fits there entirely, or, for a
    // row block, when at least its heading and 3 rows fit (the rest continues on the next sheet)
    var flowHere = false;
    if (cur && secChange && meta.flowIfWhole && b.breakBefore !== true) {
      var noFirst = function(h) { return (h || '').replace('row sec first', 'row sec'); };
      var shareRun = function() {
        var run = cur.el.querySelector('.run span:last-child');
        if (run) run.textContent += ' · ' + b.sec + ' ' + meta.run;
        cur.sec = b.sec;
      };
      var wn = add(noFirst((b.head || '') + (b.rows ? b.render(b.rows, true, true) : b.html)));
      if (fits()) { shareRun(); secStart[b.sec] = pages.length; cur.n++; return; }
      remove(wn);
      if (b.rows && b.rows.length > (M.flowRows || 3)) {
        var pn = add(noFirst(b.head) + b.render(b.rows.slice(0, (M.flowRows || 3)), true, false));
        flowHere = fits();
        remove(pn);
        if (flowHere) { shareRun(); b = Object.assign({}, b, { head:noFirst(b.head), noWidow:true }); }
      }
    }
    if (!flowHere && (!cur || b.breakBefore === true || (secChange && !meta.flow))) newPage(b.sec, false);
    if (!b.rows) {
      var nodes = add((b.head || '') + b.html);
      if (!fits() && cur.n > 0) { remove(nodes); newPage(b.sec, !!secStart[b.sec]); add((b.head || '') + b.html); }
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
      if (placed && b.noWidow && rest.length - k === 1 && k > 3) {
        remove(placed); k--;
        placed = add((first ? (b.head || '') : '') + b.render(rest.slice(0, k), first, false));
      }
      if (!placed) {
        if (cur.n > 0) { newPage(b.sec, !!secStart[b.sec] || !first); continue; }
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
  idt.push(['Versão', M.versao]);
  pg.innerHTML = ptNb('<img class="logo" src="' + PT_LOGO + '" alt="Agilean">' +
    '<div class="ctit"><div class="lbl sq">' + ptDocNome(M) + '</div><h1 style="margin-top:2mm">Diagnóstico <span class="o">SIIGA</span></h1><div class="cco">' + ptEsc(M.empresa) + '</div></div>' +
    '<table class="idt">' + idt.map(function(r, i){ return '<tr><td class="lbl"' + (i === 0 ? ' style="width:42mm"' : '') + '>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
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
  var blocks = [].concat(ptSecResumo(M), ptSecPerdaGanho(M), ptSecCriticos(M), ptSecDemais(M), ptSecPlano(M), ptSecBases(M), M.det ? ptSecAnexo(M) : []);
  var pg = ptPaginate(root, M, blocks);
  var pages = pg.pages;
  var total = pages.length + 1;
  pages.forEach(function(p, i) { p.el.querySelector('.carimbo').innerHTML = ptNb(ptCarimbo(M, i + 2, total)); });
  var toc = [];
  ['01','02','03','04','05','06','A'].forEach(function(s) {
    if (!pg.secStart[s]) return;
    toc.push([s, s === '05' ? ptPlano06(M) : PT_SECOES[s].toc, pg.secStart[s] + 1]);
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
    pdf.setProperties({ title:'Diagnóstico SIIGA · ' + M.empresa, author:'Agilean',
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
