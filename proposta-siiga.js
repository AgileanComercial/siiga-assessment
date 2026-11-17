// Gerar Proposta SIIGA (v2): proposta comercial em PDF 16:9 (1440pt x 810pt), 16 paginas, identidade Agilean.
// Porte do template Piemonte v2.11 para a ferramenta. Entradas: openPropostaSiiga() (formulario "Ficha da proposta")
// e generatePropostaSiiga() (gera com o que estiver em S.proposta). Reaproveita os motores do diagnostico (ptModel,
// getGapPlan, gapsNumerados, calculateROI) sem alterar nenhum calculo. A folha de estilo (proposta-siiga.css) so e
// carregada dentro de um iframe de geracao: nada vaza para a ferramenta. Nunca sai tarja de campo em aberto: o
// formulario valida os campos obrigatorios e o que for opcional simplesmente nao aparece.

var PS_VERSAO = '2.0';
var PS_TOTAL = 16;
var PS_MAX_FALAS = 10;                // limite de falas do cliente (decisao do Israel: ate 10)
var PS_CREME = '#FAF7F5';

// ── Biblioteca padrao (extraida do template v2.11; nada de cliente especifico) ──────────────
var PS_PILARES = [
  { n: 1, nome: 'Planejamento estratégico do fluxo de produção', itens: ['Revisão de EAPs, pacotes e sequenciamento', 'Linha de Balanço implementada', 'Integrar as grades de Planejamento e Orçamento', 'Físico-financeiro gerado a partir do planejamento'],
    resumo: 'EAPs, pacotes, sequenciamento e Linha de Balanço; grades de Planejamento e Orçamento integradas e físico-financeiro.' },
  { n: 2, nome: 'Proteção e garantia da execução do plano', itens: ['Workshop com pessoas-chave do escritório e da obra', 'Rotinas de lookahead e gestão de restrições', 'Participação em reuniões práticas ao vivo', 'Cadência de análise e reprogramação instalada'],
    resumo: 'Lookahead e gestão de restrições, com análise proativa de desvios e reprogramação.' },
  { n: 3, nome: 'Gestão integrada da produção', itens: ['Last Planner System implementado', 'Rotinas de check-in/check-out no canteiro', 'Time treinado e operando nas rotinas', 'Folha de produção gerada desde o início'],
    resumo: 'Last Planner System e rotinas de check-in/check-out no canteiro, com apontamento de produção desde o início.' },
  { n: 4, nome: 'Controle real e performance da produção', itens: ['Treinamento em PPC e aderência', 'Score SIIGA antes e depois documentado', 'Apresentação estratégica para a diretoria', 'Plano de continuidade e expansão das obras'],
    resumo: 'Indicadores de PPC e aderência, score SIIGA antes e depois e apresentação estratégica para a diretoria.' }
];
var PS_FASE0_ITENS = ['Aprofundamento do diagnóstico SIIGA', 'Relatório de gaps por pilar', 'Plano de ação personalizado', 'Workshop Lean Experience (nivelamento Lean, conceitos LPS, fluxo e restrições, alinhamento de linguagem)'];
// objetivos: pil = pilares ligados; fontes = fontes de perda ligadas (para sugerir pelos gaps do diagnostico); base = peso fixo
var PS_OBJETIVOS = [
  { id: 'apoio', nome: 'Integração do planejamento com as áreas de apoio', como: 'Cronogramas de suprimentos, projetos, orçamento e qualidade ligados ao cronograma da obra e às restrições, com reunião periódica entre as áreas.', pil: [2], fontes: ['velocidade'] },
  { id: 'padrao', nome: 'Padronização da produção e controle da qualidade', como: 'Mesmo padrão de planejamento e controle em todas as obras, com a causa de cada falha registrada e medição feita com evidência.', pil: [3], fontes: ['retrabalho', 'erros'] },
  { id: 'financeiro', nome: 'Gestão orientada por resultado financeiro', como: 'Prazo e custo num relatório só, com o impacto em R$ para a diretoria decidir.', pil: [4], fontes: ['time'] },
  { id: 'lean', nome: 'Elevação da maturidade Lean da equipe e dos processos', como: 'Processos desenhados em conjunto {COM} segundo os princípios do Lean Construction, com treinamento de toda a equipe da obra e das áreas de apoio.', pil: [], fontes: [], base: 100 },
  { id: 'plan', nome: 'Planejamento estratégico do fluxo de produção', como: 'Linha de Balanço, pacotes e sequenciamento revisados, com planejamento e orçamento integrados e físico-financeiro gerado a partir do planejamento.', pil: [1], fontes: [] },
  { id: 'prot', nome: 'Proteção e garantia da execução do plano', como: 'Lookahead e gestão de restrições, com análise proativa de desvios e reprogramação em cadência definida.', pil: [2], fontes: [] },
  { id: 'integ', nome: 'Gestão integrada da produção', como: 'Last Planner System e rotinas de check-in e check-out no canteiro, com apontamento de produção desde o início.', pil: [3], fontes: [] },
  { id: 'ctrl', nome: 'Controle real e performance da produção', como: 'Indicadores de PPC e aderência acompanhados, com o score SIIGA antes e depois e apresentação estratégica para a diretoria.', pil: [4], fontes: [] }
];
var PS_ENTREGAVEIS = [
  { id: 'proc', k: 'Processo', t: 'Processo de planejamento e controle documentado' },
  { id: 'pess', k: 'Pessoas', t: 'Matriz RACI e equipes da obra e das áreas de apoio treinadas' },
  { id: 'repl', k: 'Replicação', t: 'Procedimento padrão replicável do piloto para as demais obras' },
  { id: 'gest', k: 'Gestão', t: 'Painel de indicadores integrado para a diretoria' }
];
var PS_RITOS = [
  ['Semanal', 'Rito operacional', 'Na obra: compromissos de curto prazo (Last Planner), check-in/check-out e mão de obra.'],
  ['Quinzenal', 'Rito tático', 'Sala técnica: análise de restrições e planejamento de médio prazo, com as áreas de apoio.'],
  ['Mensal', 'Comitê executivo', 'Diretoria e Agilean: leitura dos indicadores do projeto, avanço das metas e decisões de curso.']
];
var PS_CRITERIOS_PILOTO = ['Obra com entrega no ano que vem', 'Obra nova, com pré-obra e sala de guerra já em curso', 'Todas as áreas de apoio na mesa desde o início'];
var PS_VISITAS = [['start', 0, 'No start, Fase 0 e início do Pilar 1.'], ['Pilar 2 → 3', 2, 'Na consolidação do Pilar 2 e início do Pilar 3.'], ['fim do Pilar 4', 4, 'Na conclusão do Pilar 4, para consolidar o escopo de consultoria.']];
var PS_DIM = [
  ['Pessoas', 'Quem opera o processo', ['Definição do RACI: quem faz o quê', 'Dono de processo identificado', 'Capacitação com dados reais da obra', 'Cultura de apontamento contínuo', 'Ritos de gestão instalados no campo'], 'Redesenhado no escopo'],
  ['Processos', 'Como o trabalho flui', ['Cadência operacional definida', 'Anti-padrões eliminados', 'Fechamento contínuo, não mensal', 'Processo documentado e replicável', 'Integração entre canteiro, áreas de apoio e diretoria'], 'Redesenhado no escopo'],
  ['Tecnologia', 'A tecnologia que sustenta', ['Medição da produção a partir do apontamento', 'Folha de produção gerada diariamente', 'Físico-financeiro ligado ao planejamento', 'Visão integrada para a diretoria'], 'Embarcado no Agilean']
];
var PS_PARCEIROS_KP = [['64 milhões', 'de m² digitalizados'], ['50 mil', 'usuários'], ['10%', 'de economia em obras']];
var PS_PREMIOS = [['selo1', 'Solução referência pelo alto impacto gerado no setor'], ['selo2', 'Bicampeã do Prêmio CBIC na categoria de inovação'], ['selo3', 'A primeira empresa investida pelo Açolab - ArcelorMittal'],
  ['selo4', 'Utilizada no ensino do Lean Construction em universidades'], ['selo5', 'TOP 10 Construtec Brasil no 100 Open Startups']];
// Termos que nao podem aparecer no documento (nem em texto fixo nem gerado). Montado em partes para o proprio arquivo
// passar na busca por esses termos; usado na limpeza dos textos herdados do diagnostico e na conferencia final.
var PS_TERMOS_PROIBIDOS = new RegExp('\\b(' + ['plata' + 'forma', 'sist' + 'ema', 'a' + 'pp', 'te' + 'la', 'E' + 'RP', 'R' + 'UP', 'Infor' + 'makon', 'PEND' + 'ENTE'].join('|') + ')s?\\b|9 dim' + 'ens[õo]es', 'i');
// Textos que a proposta herda do diagnostico (titulo do ponto, falha, situacao registrada) saem com a mesma linguagem
// do restante do documento. Falas literais do cliente NAO sao alteradas (o formulario avisa se tiverem esses termos).
function psLimpaTermos(t) {
  // @E, @S, @P, @A, @T = os termos (montados em partes, ver acima)
  var T = { '@E': 'E' + 'RP', '@S': 'sist' + 'ema', '@P': 'plata' + 'forma', '@A': 'a' + 'pp', '@T': 'te' + 'la' };
  var rx = function(p, f) { return new RegExp(p.replace(/@[ESPAT]/g, function(k) { return T[k]; }), f); };
  var R = [[rx('\\s*\\(@E\\)', 'g'), ''], [rx('\\bfora do @E\\b', 'gi'), 'fora da ferramenta financeira'], [rx('\\bao @E\\b', 'gi'), 'à ferramenta financeira'], [rx('\\bdo @E\\b', 'gi'), 'da ferramenta financeira'],
    [rx('\\bno @E\\b', 'gi'), 'na ferramenta financeira'], [rx('\\bo @E\\b', 'gi'), 'a ferramenta financeira'], [rx('\\b@E\\b', 'g'), 'ferramenta financeira'],
    [rx('\\bo @S\\b', 'gi'), 'a ferramenta'], [rx('\\bdo @S\\b', 'gi'), 'da ferramenta'], [rx('\\bao @S\\b', 'gi'), 'à ferramenta'], [rx('\\bno @S\\b', 'gi'), 'na ferramenta'], [rx('\\bum @S\\b', 'gi'), 'uma ferramenta'],
    [rx('\\b@Ss?\\b', 'gi'), 'ferramenta'], [rx('\\b@Ps?\\b', 'gi'), 'ferramenta'], [rx('\\b@As?\\b', 'gi'), 'ferramenta'], [rx('\\b@Ts?\\b', 'gi'), 'painel']];
  return R.reduce(function(s, r) { return s.replace(r[0], r[1]); }, String(t == null ? '' : t));
}

// ── Utilitarios ──────────────────────────────────────────────────────────────────────────────
function psEsc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function psPad(n) { return (n < 10 ? '0' : '') + n; }
function psFixed(v, d) { var s = (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); return s; }
function psNumBR(v, d) { var p = psFixed(Math.abs(v), d).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (v < 0 ? '-' : '') + p.join(','); }
function psMoney(v) { return 'R$ ' + psNumBR(v, 2); }
function psMil(v) { return 'R$ ' + psNumBR(v / 1000, 1) + ' mil'; }
function psMilNum(v) { return psNumBR(v / 1000, 1); }
function psParseMoney(t) {
  t = String(t == null ? '' : t).replace(/[^\d.,\-]/g, '');
  if (!t) return NaN;
  if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, '');
  return parseFloat(t);
}
function psDataBR(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
var PS_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function psDataLonga(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? (parseInt(m[3], 10) + ' de ' + PS_MESES[parseInt(m[2], 10) - 1] + ' de ' + m[1]) : ''; }
function psHoraBR(h) { var m = /^(\d{1,2})(?::(\d{2}))?/.exec(h || ''); if (!m) return ''; var hh = parseInt(m[1], 10), mm = m[2] || '00'; return hh + 'h' + (mm === '00' ? '' : mm); }
function psCap(t) { t = String(t || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
function psLow(t) { t = String(t || '').trim(); return t ? t.charAt(0).toLowerCase() + t.slice(1) : t; }
function psHojeMais(dias) { var d = new Date(); d.setDate(d.getDate() + dias); return d.getFullYear() + '-' + psPad(d.getMonth() + 1) + '-' + psPad(d.getDate()); }
// "por" + "a Piemonte" = "pela Piemonte"
function psPor(quem) { quem = String(quem || '').trim(); if (/^a\s/i.test(quem)) return 'pela ' + quem.slice(2); if (/^o\s/i.test(quem)) return 'pelo ' + quem.slice(2); return 'por ' + quem; }
function psEmpresaFmt(nome) {
  var fem = /^(construtora|incorporadora|empresa)\b/i.test(nome) || /\b(engenharia|constru[cç][õo]es|incorpora[cç][õo]es|edifica[cç][õo]es|empreiteira)\s*$/i.test(nome);
  var art = fem ? 'a ' : '';
  return { nome: nome, a: art + nome, da: (art ? 'da ' : 'de ') + nome, pela: (art ? 'pela ' : 'por ') + nome, para: (art ? 'para a ' : 'para ') + nome, com: (art ? 'com a ' : 'com ') + nome };
}

// Nome curto para o texto corrido (ficha: "Como chamar o cliente no texto"). Regra do artigo: o nome curto e usado como foi digitado.
// Sem artigo (ex.: "Piemonte") o texto usa "de Piemonte", "por Piemonte", "com Piemonte", "para Piemonte"; com artigo digitado
// (ex.: "a Piemonte") usa "da", "pela", "com a", "para a". A capa e o cabecalho usam o nome completo.
function psNomeCurtoFmt(nc) {
  nc = String(nc || '').trim().replace(/\s+/g, ' ');
  var m = /^(a|o)\s+(.+)$/i.exec(nc);
  if (m) { var f = m[1].toLowerCase() === 'a'; return { nome: m[2], a: nc, da: (f ? 'da ' : 'do ') + m[2], pela: (f ? 'pela ' : 'pelo ') + m[2], para: 'para ' + nc.toLowerCase().slice(0, 1) + ' ' + m[2], com: 'com ' + nc.toLowerCase().slice(0, 1) + ' ' + m[2] }; }
  return { nome: nc, a: nc, da: 'de ' + nc, pela: 'por ' + nc, para: 'para ' + nc, com: 'com ' + nc };
}

// ── Conferencia de falas contra a transcricao (trava contra invencao) ────────────────────────
// Normaliza acentos, maiusculas, espacos e pontuacao.
function psNorm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
// Texto plano da transcricao, para conferir e extrair: tira cabecalho VTT/SRT, tempos, numeracao de cues, marcacoes <v Fulano>
// e as linhas de cabecalho de falante no formato "0:34 - Nome" (o texto fica; so o rotulo sai).
var PS_RE_FALANTE_TS = /^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[-–—]\s*(\S.{0,60}?)\s*$/;
var psPlanoCache = { raw: null, plano: '', norm: '' };
function psTextoPlano(txt) {
  txt = String(txt || '').replace(/\r/g, '');
  return txt.split('\n').filter(function(l) {
    var t = l.trim();
    return t && !/^WEBVTT/.test(t) && !/-->/.test(t) && !/^\d+$/.test(t) && !/^(NOTE|STYLE)\b/.test(t) && !PS_RE_FALANTE_TS.test(l);
  }).map(function(l) { return l.replace(/<[^>]+>/g, ''); }).join('\n');
}
function psTranscricaoNorm(raw) {
  if (psPlanoCache.raw !== raw) { var p = psTextoPlano(raw); psPlanoCache = { raw: raw, plano: p, norm: psNorm(p) }; }
  return psPlanoCache.norm;
}
// A fala confere quando o texto literal (cada trecho entre reticencias, na ordem) esta na transcricao.
function psFalaConfere(fala, transcricao) {
  var T = psTranscricaoNorm(transcricao);
  if (!T) return false;
  var partes = String(fala || '').split(/\(\.\.\.\)|\[\.\.\.\]|…|\.\.\./).map(psNorm).filter(Boolean);
  if (!partes.length) return false;
  var pos = 0;
  for (var i = 0; i < partes.length; i++) {
    var k = T.indexOf(partes[i], pos);
    if (k < 0) return false;
    pos = k + partes[i].length;
  }
  return true;
}
// Mantida por compatibilidade: so limpeza de .vtt/.srt (a ferramenta guarda a transcricao como veio)
function psLimpaTranscricao(txt, nome) {
  txt = String(txt || '').replace(/\r/g, '');
  if (/\.(vtt|srt)$/i.test(nome || '') || /^WEBVTT/.test(txt)) return psTextoPlano(txt);
  return txt;
}

// ── Modelo: dados do diagnostico + ficha ─────────────────────────────────────────────────────
function psResp(o) { // texto cru da resposta escolhida (rotulo e complemento), fonte das falas do diagnostico
  var q = findQ(o.bk, o.code), opt = q && q.opts ? q.opts.filter(function(x) { return x.score === o.score; })[0] : null;
  return { l: opt ? String(opt.l || '') : '', s: opt && opt.s ? String(opt.s) : '' };
}
function psSituacao(o) {
  var q = findQ(o.bk, o.code);
  var opt = q && q.opts ? q.opts.filter(function(x) { return x.score === o.score; })[0] : null;
  return opt ? (ptCap(opt.l) + (opt.s ? '; ' + ptLow(opt.s) : '')).replace(/\s+—\s+/g, ', ').replace(/[.;,\s]+$/, '') + '.' : '';
}
// Pontos criticos do diagnostico: prioridades (anchors, 01..N) e demais criticos, numerados como no relatorio.
function psPontos(M) {
  var pts = [];
  var rest = gapsNumerados(M.plan);
  M.plan.anchors.forEach(function(o, i) { pts.push({ o: o, n: i + 1, prio: true }); });
  rest.forEach(function(o) { pts.push({ o: o, n: o.n, prio: false }); });
  return pts.map(function(p) {
    return { n: psPad(p.n), code: p.o.code, titulo: psLimpaTermos(ptTituloGap(p.o)), falha: psLimpaTermos(p.o.gap), pil: parseInt(pilarNumDoGap(p.o), 10) || 0, prio: p.prio,
      situacao: psLimpaTermos(psSituacao(p.o)), respL: psResp(p.o).l, respS: psResp(p.o).s, frase: p.o.frase ? String(p.o.frase).trim() : '', fonte: p.o.fonte };
  });
}
// Sugestao de objetivos: pelos gaps do diagnostico (prioridades pesam 2, demais criticos 1); "Lean" fecha a lista.
function psSugereObjetivos(pontos) {
  var sc = PS_OBJETIVOS.map(function(ob, i) {
    var s = ob.base || 0;
    pontos.forEach(function(p) { var w = p.prio ? 2 : 1; if (ob.pil.indexOf(p.pil) >= 0) s += w; if (ob.fontes.indexOf(p.fonte) >= 0) s += w; });
    return { id: ob.id, s: s, i: i };
  });
  var top = sc.filter(function(x) { return x.id !== 'lean'; }).sort(function(a, b) { return (b.s - a.s) || (a.i - b.i); }).slice(0, 3).map(function(x) { return x.id; });
  return top.concat(['lean']);
}
// Objetivos da ficha: cada um e {id, nome, como}; a biblioteca so preenche o ponto de partida e o texto editado vale.
// Aceita tambem a lista antiga de ids (texto vem da biblioteca).
function psObjBiblioteca(id) { return PS_OBJETIVOS.filter(function(o) { return o.id === id; })[0] || null; }
function psObjDeId(id, E) { var o = psObjBiblioteca(id); return o ? { id: o.id, nome: o.nome, como: o.como.replace('{COM}', E.com) } : null; }
function psObjetivosResolvidos(lista, E) {
  return (lista || []).map(function(x) {
    if (typeof x === 'string') return psObjDeId(x, E);
    if (!x) return null;
    var b = psObjDeId(x.id, E);
    return { id: x.id, nome: (x.nome && String(x.nome).trim()) || (b && b.nome) || '', como: (x.como && String(x.como).trim()) || (b && b.como) || '' };
  }).filter(function(o) { return o && o.nome; });
}
function psModel(f) {
  var bak = { o: S.orcamentoMedio, n: S.numObras };
  if (f.orcamento > 0) S.orcamentoMedio = f.orcamento;
  if (f.nObras > 0) S.numObras = f.nObras;
  try {
    var M = ptModel('resumido');
    var pontos = psPontos(M);
    var fontes = Object.keys(M.fontes).map(function(k) { var x = M.fontes[k]; return { key: k, label: x.label, perda: x.mes, ganho: x.cap / M.prazo }; })
      .sort(function(a, b) { return b.perda - a.perda; });
    var perdaTot = M.roi.totalBase / M.prazo;
    var ganhoTot = fontes.reduce(function(a, x) { return a + x.ganho; }, 0);
    return {
      empresa: M.empresa, E: psEmpresaFmt(M.empresa), obras: M.obras, orc: M.orc, prazo: M.prazo, mo: M.mo,
      entrevistado: M.entrevistado, score: M.score, pilares: M.pilares, pontos: pontos, nPrio: M.plan.anchors.length,
      fontes: fontes, perdaTot: perdaTot, ganhoTot: ganhoTot
    };
  } finally { S.orcamentoMedio = bak.o; S.numObras = bak.n; }
}
// Perda e ganho mensais por obra para um orcamento/obras (bloco A do formulario)
function psPerdaGanho(orc, nObras) {
  try { var m = psModel({ orcamento: orc, nObras: nObras }); return { perda: m.perdaTot, ganho: m.ganhoTot }; } catch (e) { return null; }
}
// Ficha com defaults (nao inventa valores: obrigatorios ficam vazios)
function psFichaPadrao(M) {
  var p = (typeof S !== 'undefined' && S.proposta && S.proposta.v === 2) ? S.proposta : {};
  var d = JSON.parse(JSON.stringify(p));
  var ult = []; try { ult = JSON.parse(localStorage.getItem('siiga_prop_contatos') || '[]'); } catch (e) {}
  d.v = 2;
  d.orcamento = d.orcamento > 0 ? d.orcamento : S.orcamentoMedio;
  d.nObras = d.nObras > 0 ? d.nObras : (S.numObras || 1);
  d.decisor = d.decisor || { nome: S.contato || '', cargo: S.cargo || '' };
  d.reuniao = d.reuniao || { data: '', hora: '' };
  d.falas = d.falas || [];
  d.nomeCurto = (d.nomeCurto && String(d.nomeCurto).trim()) || M.empresa;
  d.objetivos = psObjetivosResolvidos((d.objetivos && d.objetivos.length === 4) ? d.objetivos : psSugereObjetivos(M.pontos), psNomeCurtoFmt(d.nomeCurto));
  d.piloto = d.piloto || {};
  d.piloto.quem = d.piloto.quem || psNomeCurtoFmt(d.nomeCurto).a;
  d.piloto.criterios = (d.piloto.criterios && d.piloto.criterios.length) ? d.piloto.criterios : PS_CRITERIOS_PILOTO.slice();
  d.escopo = Object.assign({ fase0Dias: 1, participantes: 25, visitas: 3, fase5: true, fase5Obras: 4, fase5Dias: 60 }, d.escopo || {});
  d.inv = Object.assign({ redesenho: '', redesParcelas: 4, mensalidade: '', ativPorObra: '', ativParcelas: '', validade: psHojeMais(10) }, d.inv || {});
  d.contatos = (d.contatos && d.contatos.length) ? d.contatos : (ult.length ? ult : [{ nome: '', cargo: '', email: '', tel: '' }]);
  d.transcricao = d.transcricao || { nome: '', texto: '' };
  return d;
}
// Validacao: devolve a lista de erros (vazia = pode gerar)
function psValida(f) {
  var e = [], n = function(v) { return typeof v === 'number' && isFinite(v) && v > 0; };
  if (!f || !f.inv) return ['Ficha da proposta vazia.'];
  if (!n(f.inv.redesenho)) e.push('Informe o valor total do Redesenho.');
  if (!n(f.inv.mensalidade)) e.push('Informe a mensalidade Agilean por obra, por mês.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.inv.validade || '')) e.push('Informe a validade da proposta.');
  var cs = (f.contatos || []).filter(function(c) { return c && c.nome && c.nome.trim(); });
  if (!cs.length) e.push('Informe pelo menos 1 contato comercial (nome).');
  if (f.escopo && f.escopo.fase5) {
    if (!n(f.escopo.fase5Obras)) e.push('Informe o número de obras da Fase 5.');
    if (!n(f.inv.ativPorObra)) e.push('Informe o valor da ativação por obra (Fase 5 ligada).');
  }
  var fl = (f.falas || []).filter(function(x) { return x.texto && x.texto.trim(); });
  // nome e cargo do decisor servem so para identificar o falante na transcricao; nao aparecem nas falas da proposta
  return e;
}
// Falas efetivas: com texto, ate o limite, e sem as sugeridas por IA que nao foram encontradas e nem confirmadas
function psFalasEfetivas(f) {
  return (f.falas || []).filter(function(x) { return x.texto && x.texto.trim() && !((x.origem === 'ia' || x.origem === 'diagnostico') && x.verif !== 'ok' && !x.confirmada); }).slice(0, PS_MAX_FALAS);
}

// ── Montagem das paginas ─────────────────────────────────────────────────────────────────────
function psBuildPages(f, imgs) {
  var M = psModel(f);
  imgs = imgs || {};
  var EF = M.E;                                   // nome completo (capa)
  var E = psNomeCurtoFmt(f.nomeCurto || M.empresa); // nome curto (texto corrido)
  var esc = psEsc, T = PS_TOTAL;
  var es = f.escopo, inv = f.inv;
  var f5 = !!es.fase5, nF5 = f5 ? es.fase5Obras : 0, dF5 = es.fase5Dias || 60;
  var emp = esc(M.empresa);
  var falas = psFalasEfetivas(f);
  var falasDe = function(alvo) { return falas.filter(function(x) { return x.alvo === alvo; }); };
  var quoteSpan = function(t) { return '<span class="q">“' + esc(t) + '”</span>'; };
  var QT = function(t) { return '<div style="margin-top:6pt;font-size:15pt;font-style:italic;line-height:1.35;color:#6B5A50">“' + esc(t) + '”</div>'; };
  var RUN = function(s) { return '<div class="run"><span>Escopo de Redesenho SIIGA · ' + emp + '</span><span>' + s + '</span></div>'; };
  var PRI = {}; M.pontos.forEach(function(p) { if (p.prio) PRI[p.n] = 1; });
  var nn = function(n) { return '<span class="nn' + (PRI[n] ? ' p' : '') + '">' + n + '</span>'; };
  var mk = '<span class="mk"></span>';
  var nPrio = M.nPrio, prioTxt = nPrio === 1 ? 'Prioridade 01' : 'Prioridades 01 a ' + psPad(nPrio);
  var EYE = function(t) { return '<div style="font-size:15pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--laranja)">' + t + '</div>'; };
  var pg = {};
  function page(n, title, body, aside, run) {
    var nn2 = psPad(n);
    return '<section class="page" id="p' + n + '">' + RUN(nn2 + ' ' + esc(run || title)) + '<div class="sec">' + nn2 + '</div><div class="h1">' + esc(title) + '</div>' + (aside || '') + body +
      '<div class="foot"><span>Agilean</span><span>' + nn2 + ' / ' + T + '</span></div></section>';
  }

  // 01 capa
  var logo = imgs.logo, logoBox = '', logoLab = '';
  if (logo) {
    var wide = logo.w / logo.h > 230 / 66;
    logoLab = '<div class="abs" style="right:calc(75pt + 230pt + 15pt);top:51pt;height:73pt;display:flex;align-items:center;font-size:15pt;font-weight:500;letter-spacing:.22em;color:#8E7B6B;text-transform:uppercase">Proposta para</div>';
    logoBox = '<div class="abs" style="right:75pt;top:51pt;width:230pt;height:73pt;display:flex;align-items:center;justify-content:flex-end"><img src="' + logo.url + '" style="' + (wide ? 'width:230pt;height:auto' : 'height:66pt') + ';display:block" alt="' + emp + '"></div>';
  }
  var dataL = psDataLonga(f.reuniao && f.reuniao.data), horaL = psHoraBR(f.reuniao && f.reuniao.hora);
  var capaInfo = '';
  if (dataL) capaInfo += '<div class="abs" style="left:75pt;top:714pt"><div class="lab">Data</div><div style="font-size:17pt;font-weight:500;color:var(--titulo);margin-top:7pt">' + dataL + '</div></div>';
  if (horaL) capaInfo += '<div class="abs" style="left:380pt;top:714pt"><div class="lab">Reunião com a diretoria</div><div style="font-size:17pt;font-weight:500;color:var(--titulo);margin-top:7pt">' + horaL + '</div></div>';
  pg.capa = '<section class="page" id="p1"><div class="topbar"></div>' +
    '<div class="abs" style="left:75pt;top:66pt;height:40pt;display:flex;align-items:center;gap:15pt"><img src="img/proposta/icon_orange.png" style="height:28pt" alt=""><span style="font-size:22.5pt;font-weight:700;color:var(--titulo)">Agilean</span></div>' +
    logoLab + logoBox +
    '<div class="abs" style="left:75pt;top:238pt;font-size:18pt;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--laranja)">Proposta de Projeto Agilean ' + esc(EF.para) + '</div>' +
    '<div class="abs" style="left:75pt;top:282pt;width:1250pt;font-size:56pt;font-weight:650;letter-spacing:-.005em;line-height:1.08;color:var(--titulo)">Escopo de Redesenho <span style="color:var(--laranja);letter-spacing:.04em">SIIGA</span><br>' + esc(EF.para) + '</div>' +
    '<div class="abs" style="left:75pt;right:75pt;top:693pt;height:1pt;background:#EADFD6"></div>' + capaInfo +
    '<div class="abs" style="right:75pt;top:742pt;font-size:15pt;color:#B9A898">01 / ' + T + '</div></section>';

  // 02 metodologia
  var nPrioPt = nPrio === 1 ? '1 prioridade' : nPrio + ' prioridades';
  var passos = [['Score de maturidade', 'Pontuação por pilar, até ' + M.score.max + ' pontos'], ['Pontos críticos', nPrioPt + ' e demais pontos críticos'], ['Perda e ganho mensal', 'Valor mensal de cada fonte de perda'], ['Estrutura do escopo', 'Pontos tratados em cada pilar']];
  var flow = '<div class="pil">' + passos.map(function(p, i) { return '<div><div class="lab" style="margin-bottom:4pt">Etapa ' + (i + 1) + '</div><div style="font-size:18pt;font-weight:700;color:var(--titulo);line-height:1.2;height:52pt">' + p[0] + '</div><div style="font-size:15pt;color:var(--corpo);line-height:1.3">' + p[1] + '</div></div>'; }).join('') + '</div>';
  var rows = M.pilares.map(function(p) { return '<tr><td style="width:76pt"><span class="nn">Pilar ' + p.n + '</span></td><td style="width:520pt;font-weight:600">' + esc(p.nome) + '</td><td class="r" style="width:120pt">' + p.max + '</td></tr>'; }).join('');
  pg.met = page(2, 'Metodologia do diagnóstico', '<div class="c">' + flow + '<div class="lab d" style="margin:30pt 0 8pt">Os 4 pilares do método</div><table><thead><tr><th>Pilar</th><th>Nome</th><th class="r">Pontos máx.</th></tr></thead><tbody>' + rows + '</tbody></table></div>',
    '<div class="aside"><div class="blk"><div class="lab">Referência SIIGA</div><div class="big" style="margin-top:6pt">' + M.score.max + '</div><div style="font-size:15pt;margin-top:2pt">pontos máximos</div></div></div>');

  // 03 resumo
  var pilh = M.pilares.map(function(p) { var pct = Math.round(p.pct * 100); return '<div><div class="lab" style="margin-bottom:4pt">Pilar ' + p.n + '</div><div class="nm">' + esc(p.nome) + '</div><div class="pc">' + pct + '%<small>' + psNumBR(p.pts, p.pts % 1 ? 1 : 0) + ' de ' + p.max + '</small></div><div class="bar"><i style="width:' + Math.min(100, pct) + '%"></i></div></div>'; }).join('');
  var MAXP = 14, pts3 = M.pontos.slice(0, MAXP);
  var rows3 = pts3.map(function(p) { return '<tr><td style="width:62pt;padding-left:' + (p.prio ? 0 : 17) + 'pt">' + (p.prio ? mk : '') + nn(p.n) + '</td><td style="' + (p.prio ? 'font-weight:600' : '') + '">' + esc(p.titulo) + '</td><td class="m" style="width:90pt">' + (p.pil ? 'Pilar ' + p.pil : '') + '</td></tr>'; }).join('');
  if (M.pontos.length > MAXP) rows3 += '<tr><td></td><td class="m" colspan="2">+ ' + (M.pontos.length - MAXP) + ' pontos críticos adicionais registrados no diagnóstico</td></tr>';
  var nivel = psCap(String(M.score.nivel).replace(/Parcialmente Estruturado/, 'Em alerta').toLowerCase().replace(/\s*\/\s*/g, ', '));
  var moTxt = { terceirizada: 'Terceirizada', propria: 'Própria', mista: 'Mista' }[M.mo] || '';
  var orcTxt = M.orc >= 1e6 ? 'R$ ' + psNumBR(M.orc / 1e6, M.orc % 1e6 ? 1 : 0) + ' mi' : psMoney(M.orc);
  var body3 = '<div class="abs" style="left:385pt;right:75pt;top:148pt"><div class="pil">' + pilh + '</div></div>' +
    '<div class="abs" style="left:385pt;right:75pt;top:312pt"><div class="lab d" style="margin-bottom:8pt;display:flex;justify-content:space-between"><span>' + M.pontos.length + ' pontos críticos</span><span style="color:var(--mut)">' + mk + prioTxt + '</span></div>' +
    '<table><thead><tr><th>#</th><th>Ponto crítico</th><th>Pilar</th></tr></thead><tbody>' + rows3 + '</tbody></table></div>';
  var aside3 = '<div class="abs" style="left:75pt;top:162pt;width:270pt;border-top:1pt solid var(--fio);padding-top:12pt"><div class="lab">Score de maturidade</div><div style="font-size:48pt;font-weight:700;color:var(--laranja-prof);line-height:1.1;margin-top:4pt">' + psNumBR(M.score.score, M.score.score % 1 ? 1 : 0) + '<span style="font-size:24pt;color:var(--mut)">/' + M.score.max + '</span></div><div style="font-size:15pt;color:var(--corpo);margin-top:2pt">' + esc(nivel) + '</div></div>' +
    '<div class="abs" style="left:75pt;top:336pt;width:270pt;border-top:1pt solid var(--fio);padding-top:12pt"><div class="lab d" style="margin-bottom:12pt">Base informada</div>' +
    '<div class="kv"><div class="lab">Orçamento médio por obra</div><div class="v">' + orcTxt + '</div></div><div class="kv"><div class="lab">Prazo</div><div class="v">' + M.prazo + ' meses</div></div><div class="kv"><div class="lab">Obras</div><div class="v">' + M.obras + '</div></div>' +
    (moTxt ? '<div class="kv"><div class="lab">Mão de obra</div><div class="v">' + moTxt + '</div></div>' : '') + '</div>';
  pg.res = page(3, 'Resumo do diagnóstico', body3, aside3);

  // 04 falhas
  var pts4 = M.pontos.slice(0, 7);
  var rows4 = pts4.map(function(p) {
    var fs = falasDe('falha:' + p.code), desc = p.situacao;
    fs.forEach(function(x) { // a fala vira citacao: sai do texto registrado para nao aparecer duas vezes
      var i = desc.toLowerCase().indexOf(String(x.texto).trim().replace(/[.\s]+$/, '').toLowerCase());
      if (i >= 0) desc = (desc.slice(0, i) + desc.slice(i + String(x.texto).trim().replace(/[.\s]+$/, '').length).replace(/^[,;\s]+/, '')).replace(/;\s*;/, ';').replace(/;\s+\./, '.').replace(/\s{2,}/g, ' ');
    });
    return '<tr><td style="width:500pt;font-weight:600;padding-right:36pt">' + esc(p.falha) + '</td><td style="color:var(--corpo)">' + esc(desc) + fs.map(function(x) { return quoteSpan(x.texto); }).join('') + '</td></tr>';
  }).join('');
  var nota4 = M.pontos.length > 7 ? '<div style="margin-top:10pt;font-size:13.5pt;line-height:1.3;color:#6B5A50">Os demais ' + (M.pontos.length - 7) + ' pontos críticos estão no resumo do diagnóstico (página 3).</div>' : '';
  pg.falhas = page(4, 'Falhas atuais identificadas', '<div class="c rm"><table><thead><tr><th>Falha</th><th>Situação registrada</th></tr></thead><tbody>' + rows4 + '</tbody></table></div>',
    '<div class="aside"><div class="blk"><div class="lab">Registradas no diagnóstico</div><div class="big" style="margin-top:6pt">' + pts4.length + '</div>' + nota4 + '</div></div>');

  // 05 perda e ganho
  var maxP = Math.max.apply(null, M.fontes.map(function(x) { return x.perda; }).concat([1]));
  var sc = 500 / maxP;
  var bars = M.fontes.map(function(x) { return '<div class="brow"><div class="l">' + esc(x.label) + '</div><div class="bb"><div style="width:' + (x.perda * sc).toFixed(0) + 'pt;background:var(--perda)"><span style="left:' + (x.perda * sc + 8).toFixed(0) + 'pt;color:var(--perda)">' + psMilNum(x.perda) + '</span></div><div style="width:' + (x.ganho * sc).toFixed(0) + 'pt;background:var(--verde)"><span style="left:' + (x.ganho * sc + 8).toFixed(0) + 'pt;color:var(--verde)">' + psMilNum(x.ganho) + '</span></div></div></div>'; }).join('');
  var trs = M.fontes.map(function(x) { return '<tr><td>' + esc(x.label) + '</td><td class="r">' + psMil(x.perda) + '</td><td class="r">' + psMil(x.ganho) + '</td></tr>'; }).join('');
  var nCart = 1 + nF5;
  var totCart = f5 ? '<tr><td style="font-weight:700">Total em ' + nCart + ' obras (piloto + ' + nF5 + ' opcionais)</td><td class="r" style="font-weight:700">' + psMil(M.perdaTot * nCart) + '</td><td class="r" style="font-weight:700">' + psMil(M.ganhoTot * nCart) + '</td></tr>' : '';
  var cons = '<div style="margin-top:12pt;font-size:13.5pt;color:#6B5A50">Cenário conservador (50% do ganho): ' + psMil(M.ganhoTot * 0.5) + '/mês por obra' + (f5 ? '; ' + psMil(M.ganhoTot * 0.5 * nCart) + '/mês em ' + nCart + ' obras (piloto + ' + nF5 + ' opcionais)' : '') + '.</div>';
  pg.perda = page(5, 'Perda e ganho mensal', '<div class="c"><div class="kp"><div><div class="lab">Perda estimada por mês</div><div class="v" style="color:var(--perda)">' + psMil(M.perdaTot) + '</div></div><div><div class="lab">Ganho mensal</div><div class="v" style="color:var(--verde)">' + psMil(M.ganhoTot) + '</div></div></div>' +
    '<div style="margin-top:14pt;border-top:1.5pt solid var(--titulo)">' + bars + '</div>' +
    '<table style="margin-top:22pt"><thead><tr><th>Fonte de perda</th><th class="r">Perda/mês</th><th class="r">Ganho/mês</th></tr></thead><tbody>' + trs +
    '<tr><td class="tot">Total por obra</td><td class="tot r" style="color:var(--perda)">' + psMil(M.perdaTot) + '</td><td class="tot r" style="color:var(--verde)">' + psMil(M.ganhoTot) + '</td></tr>' + totCart + '</tbody></table>' + cons + '</div>',
    '<div class="aside"><div class="blk"><div class="lab d" style="margin-bottom:10pt">Legenda</div><div style="font-size:15pt;margin-bottom:6pt"><span class="mk" style="background:var(--perda)"></span>Perda por mês (R$ mil)</div><div style="font-size:15pt"><span class="mk" style="background:var(--verde)"></span>Ganho mensal com o plano (R$ mil)</div></div></div>');

  // 06 objetivos
  var objs = psObjetivosResolvidos(f.objetivos, E).slice(0, 4);
  var rows6 = objs.map(function(o, i) { return '<tr><td style="width:60pt"><span class="nn p">' + psPad(i + 1) + '</span></td><td style="width:400pt;font-weight:700;font-size:19pt;padding-right:36pt">' + esc(o.nome) + '</td><td>' + esc(o.como) + falasDe('obj:' + o.id).map(function(x) { return QT(x.texto); }).join('') + '</td></tr>'; }).join('');
  pg.obj = page(6, 'Objetivos do projeto', '<div class="c rm tall" style="top:150pt"><table class="t4"><thead><tr><th>#</th><th>Objetivo</th><th>Como</th></tr></thead><tbody>' + rows6 + '</tbody></table></div>');

  // 07 pessoas, processos e tecnologia
  var dcols = PS_DIM.map(function(d) { return '<div><div class="t">' + d[0] + '</div><div class="h">' + d[1] + '</div><ul>' + d[2].map(function(x) { return '<li>' + x + '</li>'; }).join('') + '</ul><div class="ft">' + d[3] + '</div></div>'; }).join('');
  pg.dim = page(7, 'Por que vamos além da tecnologia', '<div class="abs" style="left:385pt;right:75pt;top:150pt">' + EYE('Mudança em três dimensões') + '<div style="font-size:19pt;line-height:1.4;margin-top:12pt;color:var(--corpo);max-width:900pt">Para transformar a gestão de obras ' + esc(E.da) + ', precisamos mudar três dimensões ao mesmo tempo.</div></div>' +
    '<div class="cw" style="top:250pt"><div class="cols3 d3">' + dcols + '</div></div>' +
    '<div class="apoiow" style="top:690pt"><span class="tx" style="font-size:19pt;font-weight:600">O redesenho de processos SIIGA instala os três, não só a tecnologia.</span></div>', '', 'Pessoas, processos e tecnologia');

  // 08 o que esta incluido
  var part = es.participantes;
  var prep = [['01', 'Aprofundamento do diagnóstico SIIGA', 'Gaps por pilar e plano de ação personalizado.'], ['02', 'Workshop Lean Experience', 'Até ' + part + ' participantes. Nivelamento Lean do time, base metodológica do SIIGA e alinhamento de linguagem.']];
  var irow = function(a, b, c, fs, w) { return '<div class="ir"><span class="nn p" style="font-size:' + fs + 'pt' + (w ? ';width:50pt;flex:none' : '') + '">' + a + '</span><div><div class="tt" style="font-size:19pt;font-weight:700;color:var(--titulo)">' + esc(b) + '</div><div class="dd" style="font-size:15.5pt;line-height:1.35;margin-top:3pt">' + esc(c) + '</div></div></div>'; };
  var prepx = prep.map(function(x) { return irow(x[0], x[1], x[2], 20); }).join('');
  var pilx = PS_PILARES.map(function(p) { return irow('P' + p.n, p.nome, p.resumo, 24, true); }).join('');
  var f5band = f5 ? '<div class="apoiow" style="top:690pt"><span class="t">Fase 5 · Ativação nas demais obras</span><span class="tx">Opcional, até ' + dF5 + ' dias.</span></div>' : '';
  pg.incl = page(8, 'O que está incluído no escopo', '<div class="abs" style="left:385pt;right:75pt;top:150pt;display:flex;justify-content:space-between;align-items:baseline">' + EYE('Escopo do projeto') + '<span class="lab" style="color:var(--laranja-prof)">4 meses · Metodologia SIIGA</span></div>' +
    '<div class="cw p8" style="top:200pt;display:flex;gap:44pt"><div style="width:400pt"><div class="lab d" style="margin-bottom:8pt">Preparação · Fase 0</div><div class="irs">' + prepx + '</div></div><div style="flex:1"><div class="lab d" style="margin-bottom:8pt">Execução · 4 pilares</div><div class="irs">' + pilx + '</div></div></div>' + f5band);

  // 09 estrutura do escopo (pontos do diagnostico distribuidos por pilar, prioridades em destaque)
  var apoioOn = psObjetivosResolvidos(f.objetivos, E).some(function(o) { return o.id === 'apoio'; });
  var MAXPIL = 5;
  function ptsHtml(k) {
    var lst = M.pontos.filter(function(p) { return p.pil === k; });
    if (!lst.length && !(k === 2 && apoioOn)) return '';
    var show = lst.slice(0, MAXPIL), mais = lst.length - show.length;
    var li = show.map(function(p) {
      var q = p.frase ? quoteSpan(p.frase) : '';
      return '<li class="' + (p.prio ? 'pri' : '') + '"><b>' + p.n + '</b><span>' + esc(p.titulo) + q + '</span></li>';
    }).join('') + (mais > 0 ? '<li><b></b><span>+ ' + mais + ' pontos do diagnóstico</span></li>' : '');
    var ap = (k === 2 && apoioOn) ? '<div class="ap">Áreas de apoio: suprimentos, projetos, orçamento e qualidade integrados ao planejamento da obra.</div>' : '';
    return '<div class="pd">Pontos do diagnóstico</div><ul class="pts">' + li + '</ul>' + ap;
  }
  var col = function(k, lbl, nome, itens) { return '<div><div class="t">' + lbl + '</div><div class="h">' + esc(nome) + '</div><ul>' + itens.map(function(x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + (k ? ptsHtml(k) : '') + '</div>'; };
  var cols5 = col(0, 'Fase 0', 'Preparação', PS_FASE0_ITENS) + PS_PILARES.map(function(p) { return col(p.n, 'Pilar ' + p.n, p.nome, p.itens); }).join('');
  var f5band9 = f5 ? '<div class="apoiow" style="position:static;margin-top:12pt"><span class="t">Fase 5 · Ativação nas demais obras (opcional)</span><span class="tx">Processo e ritos do piloto aplicados com as equipes das demais obras, em até ' + dF5 + ' dias, conduzidos ' + esc(psPor(f.piloto.quem)) + ' ou pela Agilean.</span></div>' : '';
  pg.est = page(9, 'Estrutura do Escopo', '<div class="legtop">' + mk + prioTxt + '</div><div class="cw" style="top:150pt"><div class="cols5 c5b">' + cols5 + '</div>' + f5band9 + '</div>');

  // 10 entregaveis e ritos
  var entg = PS_ENTREGAVEIS.map(function(x, i) { return '<div class="e"><div style="display:flex;gap:14pt;align-items:baseline"><span class="nn p" style="font-size:16pt">' + psPad(i + 1) + '</span><span style="font-size:17pt;font-weight:700;color:var(--titulo)">' + x.k + '</span></div><div style="font-size:15pt;margin-top:3pt;line-height:1.3">' + x.t + '</div>' + falasDe('ent:' + x.id).map(function(q) { return QT(q.texto); }).join('') + '</div>'; }).join('');
  var ritos = PS_RITOS.map(function(r) { return '<div><div class="t">' + r[0] + '</div><div style="font-size:17pt;font-weight:700;color:var(--titulo);margin:4pt 0 4pt">' + r[1] + '</div><div style="font-size:15pt;line-height:1.3">' + r[2] + '</div></div>'; }).join('');
  pg.ent = page(10, 'Entregáveis e ritos', '<div class="cw" style="top:150pt"><div class="lab d" style="margin-bottom:6pt">4 entregáveis</div><div class="entg e8">' + entg + '</div><div class="lab d" style="margin:30pt 0 8pt">Ritos que serão implementados</div><div class="cols3 rit3">' + ritos + '</div></div>');

  // 11 workshop
  pg.ws = page(11, 'Workshop Lean Experience', '<div class="abs" style="left:385pt;right:75pt;top:150pt"><div style="font-size:15pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--laranja)">A maior imersão em Lean Construction do Brasil</div>' +
    '<div style="font-size:19pt;line-height:1.4;margin-top:14pt;color:var(--corpo);max-width:860pt">Nivelamento Lean para até ' + part + ' participantes por workshop, com eventos e imersões realizados pela Agilean: base metodológica do SIIGA e alinhamento de linguagem do time.</div></div>' +
    '<div class="abs" style="left:75pt;right:75pt;top:290pt;border-top:1.5pt solid var(--titulo);padding-top:12pt;display:flex;align-items:baseline;gap:22pt"><span class="lab d">Nivelamento Lean</span><span style="font-size:30pt;font-weight:700;color:var(--titulo)">Até <span style="color:var(--laranja)">' + part + '</span> participantes por workshop</span></div>' +
    '<div class="abs" style="left:75pt;right:75pt;top:372pt;display:flex;gap:30pt"><img src="img/proposta/wr_eventos.jpg" style="width:630pt;height:352pt;object-fit:cover;display:block;border-radius:2pt" alt=""><img src="img/proposta/wr_imersao.jpg" style="width:630pt;height:352pt;object-fit:cover;display:block;border-radius:2pt" alt=""></div>');

  // 12 cronograma e visitas
  var D0 = -1, D1 = f5 ? 4 + dF5 / 30 : 4.3, nMes = Math.floor(D1 + 0.001);
  var pc = function(v) { return ((v - D0) / (D1 - D0) * 100).toFixed(3) + '%'; }, wd = function(a, b) { return ((b - a) / (D1 - D0) * 100).toFixed(3) + '%'; };
  var ticks = ''; for (var tv = 0; tv <= nMes; tv++) ticks += '<i style="left:' + pc(tv) + '"></i>';
  var grow = function(lbl, a, b, txt, colr, extra, style) { return '<div class="grow g5"><div class="l">' + lbl + '</div><div class="tp">' + ticks + '<b style="left:' + pc(a) + ';width:' + wd(a, b) + ';background:' + colr + ';' + (style || '') + '">' + txt + '</b>' + (extra || '') + '</div></div>'; };
  var axis = '<div style="display:flex"><div style="width:330pt"></div><div style="flex:1;position:relative;height:22pt;border-bottom:1.5pt solid var(--titulo);font-size:13pt;color:var(--mut)">'; for (var mi = 1; mi <= nMes; mi++) axis += '<span style="position:absolute;left:' + pc(mi - 0.5) + ';top:0;white-space:nowrap;transform:translateX(-50%)">Mês ' + mi + '</span>'; axis += '</div></div>';
  var hatch = 'url(&quot;data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\'><rect width=\'14\' height=\'14\' fill=\'%23E3A27F\'/><path d=\'M-2 2L2 -2M0 14L14 0M12 16L16 12\' stroke=\'%23EBB799\' stroke-width=\'5\'/></svg>&quot;)';
  var nV = Math.max(1, Math.min(3, es.visitas || 3));
  var vsel = nV === 3 ? [0, 1, 2] : (nV === 2 ? [0, 2] : [0]);
  var vis = vsel.map(function(i) { return PS_VISITAS[i]; });
  var marks = vis.map(function(v, i) { return '<span class="vm" style="left:' + pc(v[1]) + '"><s></s><u>' + (i + 1) + '</u></span>'; }).join('');
  var visrow = '<div class="grow g5"><div class="l">Visitas presenciais</div><div class="tp">' + ticks + marks + '</div></div>';
  var visx = vis.map(function(v, i) { return '<div><span class="nn p" style="font-size:16pt">Visita ' + (i + 1) + '</span><div style="font-size:15pt;line-height:1.3;margin-top:3pt">' + v[2] + '</div></div>'; }).join('');
  var f0 = es.fase0Dias + (es.fase0Dias === 1 ? ' dia' : ' dias');
  var f5row = f5 ? grow('Fase 5 · Ativação nas demais obras (opcional)', 4, D1, 'até ' + dF5 + ' dias · opcional', '#E8AD8B', '', 'font-size:12pt;padding:0 8pt;color:var(--titulo);background-image:' + hatch + ';background-color:#E8AD8B') : '';
  pg.cron = page(12, 'Cronograma e visitas', '<div class="cw" style="top:150pt">' + axis +
    grow('Fase 0 · Preparação<br>' + f0, -0.2, 0, '', '#8A6E5A', '<span style="position:absolute;left:calc(' + pc(0) + ' + 8pt);top:50%;transform:translateY(-50%);font-size:12pt;color:var(--titulo);white-space:nowrap">' + f0 + ', antes do Mês 1</span>') +
    PS_PILARES.map(function(p) { return grow('Pilar ' + p.n + ' · ' + esc(p.nome), p.n - 1, p.n, 'Pilar ' + p.n, '#3D2E22', '', 'font-size:12pt;padding:0 6pt'); }).join('') + f5row + visrow +
    '<div class="lab d" style="margin:22pt 0 8pt">Visitas e viagens</div><div class="cols3 rit3 vis3"><div style="flex:3.2"><div style="font-size:15pt;font-weight:700;color:var(--titulo);margin-bottom:8pt">' + nV + (nV === 1 ? ' visita presencial' : ' visitas presenciais') + '</div><div class="v3" style="grid-template-columns:repeat(' + nV + ',1fr)">' + visx + '</div></div></div>' +
    '<div style="margin-top:12pt;font-size:15pt;font-weight:600;color:var(--titulo)">Custos de deslocamento e hospedagem da equipe Agilean por conta ' + esc(E.da) + '.</div></div>');

  // 13 piloto e ativacao
  var crit = (f.piloto.criterios || []).filter(function(c) { return c && c.trim(); }).slice(0, 5);
  var critTab = crit.length ? '<div class="lab d" style="margin:34pt 0 8pt">Critérios sugeridos para a escolha da obra-piloto</div><table><tbody>' + crit.map(function(c, i) { return '<tr><td style="width:50pt"><span class="nn p">' + psPad(i + 1) + '</span></td><td>' + esc(c) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
  var f5tab = f5 ? '<tr><td><span class="nn p">Fase 5 · Ativação nas demais obras (opcional)</span></td><td>Processo e ritos do piloto aplicados com as equipes das demais obras, conduzidos ' + esc(psPor(f.piloto.quem)) + ' ou pela Agilean.</td><td class="m">Até ' + dF5 + ' dias no total</td></tr>' : '';
  var aside13 = '<div class="aside"><div class="blk"><div class="lab">Obra-piloto</div><div class="big" style="margin-top:6pt">1</div></div>' + (f5 ? '<div class="blk"><div class="lab">Fase 5 · opcional</div><div class="big" style="margin-top:6pt">+' + nF5 + '</div><div style="font-size:15pt;margin-top:2pt">obras opcionais, em até ' + dF5 + ' dias no total</div></div>' : '') + '</div>';
  pg.pil = page(13, 'Piloto e ativação por obra', '<div class="c rm"><table><thead><tr><th></th><th>Escopo</th><th>Prazo</th></tr></thead><tbody>' +
    '<tr><td style="width:150pt"><span class="nn p">Piloto · 1 obra</span></td><td style="width:360pt">Redesenho de processos da empresa, pilotado em 1 obra definida ' + esc(psPor(f.piloto.quem)) + ': Fase 0 · Preparação (diagnóstico aprofundado e workshop) e os Pilares 1 a 4.</td><td class="m" style="width:130pt">Fase 0 e Pilares 1 a 4</td></tr>' + f5tab + '</tbody></table>' + critTab +
    '<div style="margin-top:14pt"><span class="lab d" style="margin-right:14pt">Obra-piloto</span><span style="font-size:17pt;font-weight:600;color:var(--titulo)">A obra-piloto será definida ' + esc(psPor(f.piloto.quem)) + '.</span></div></div>', aside13);

  // 14 investimento
  var kv = function(a, b) { return '<tr style="height:50pt"><td style="width:215pt;font-weight:600">' + a + '</td><td>' + b + '</td></tr>'; };
  var nP = inv.redesParcelas || 1;
  var t1 = kv('Investimento total do Redesenho', '<b>' + psMoney(inv.redesenho) + '</b>') + kv('Pagamento', nP === 1 ? 'Parcela única' : nP + ' parcelas, pagas durante os 4 meses do escopo') + kv('Obra-piloto', 'Incluída no escopo, em 1 obra');
  var colR = '<div style="flex:1"><div class="lab d" style="margin-bottom:4pt">Redesenho · escopo de consultoria</div><div style="font-size:15pt;margin-bottom:10pt">Pago pela empresa · Fase 0 e Pilares 1 a 4</div><table style="border-top:1.5pt solid var(--titulo)"><tbody>' + t1 + '</tbody></table></div>';
  var colA = '';
  if (f5) {
    var totA = inv.ativPorObra * nF5, nPA = inv.ativParcelas || nF5;
    var regraA = nPA === nF5 ? 'em ' + nPA + ' parcelas, durante os ' + dF5 + ' dias: uma parcela a cada obra entregue' : 'em ' + nPA + ' parcelas, durante os ' + dF5 + ' dias, conforme as obras são entregues';
    var t2 = kv('Valor por obra', '<b>' + psMoney(inv.ativPorObra) + '</b>') + kv('Total das ' + nF5 + ' obras', '<b>' + psMoney(totA) + '</b>, ' + regraA) + kv('Contratação', 'Opcional, depois do Pilar 4; conduzida ' + esc(psPor(f.piloto.quem)) + ' ou pela Agilean');
    colA = '<div style="flex:1"><div class="lab d" style="margin-bottom:4pt">Ativação das demais ' + nF5 + ' obras · Fase 5 (opcional)</div><div style="font-size:15pt;margin-bottom:10pt">Pago pela empresa · ativação da metodologia, por obra</div><table style="border-top:1.5pt solid var(--titulo)"><tbody>' + t2 + '</tbody></table></div>';
  }
  pg.inv = page(14, 'Investimento', '<div class="cw rm" style="display:flex;gap:44pt">' + colR + colA + '</div>' +
    '<div class="cw" style="top:420pt;border-top:1.5pt solid var(--titulo);padding-top:12pt"><div class="lab d" style="margin-bottom:4pt">Agilean · mensalidade</div><div style="display:flex;gap:44pt;align-items:flex-start"><div style="flex:0 0 330pt"><div style="font-size:15pt;margin-bottom:4pt">Mensalidade Agilean</div><div style="font-size:34pt;font-weight:700;color:var(--laranja-prof);line-height:1.1">' + psMoney(inv.mensalidade) + '</div><div style="font-size:15pt;margin-top:2pt">por obra, por mês</div></div>' +
    '<div style="flex:1;font-size:16pt;line-height:1.4;color:var(--titulo)"><div style="margin-bottom:10pt"><b>Obra-piloto:</b> sem mensalidade durante os 4 meses do escopo. Depois, 30 dias de carência; a cobrança começa no 2º mês após o escopo.</div><div><b>Demais obras, se contratadas:</b> 30 dias de carência; a cobrança começa no 2º mês.</div></div></div></div>' +
    '<div class="cw" style="top:640pt;border-top:1pt solid var(--fio);padding-top:12pt"><span class="lab d" style="margin-right:20pt">Validade</span><span style="font-size:17pt;font-weight:600;color:var(--titulo)">Proposta válida até ' + psDataBR(inv.validade) + '</span></div>' +
    '<div class="cw" style="top:690pt;border-left:4pt solid var(--laranja);padding-left:16pt;font-size:17pt;font-weight:700;color:var(--titulo);line-height:1.35">Custos de deslocamento e hospedagem da equipe Agilean ficam a cargo ' + esc(E.da) + ' e não estão incluídos nesta proposta comercial.</div>');

  // 15 proximos passos
  var passos15 = [['01', psCap(f.piloto.quem) + ' define a obra-piloto', 'Com base nos critérios da página 13.'], ['02', 'Aprofundamos o diagnóstico', 'Com todas as áreas de apoio na mesa.'], ['03', 'Kick-off da obra-piloto', 'Workshop Lean Experience.']];
  var rows15 = passos15.map(function(p) { return '<tr><td style="width:60pt"><span class="nn p">' + p[0] + '</span></td><td style="width:380pt;font-weight:700;font-size:19pt">' + esc(p[1]) + '</td><td>' + p[2] + '</td></tr>'; }).join('');
  var cts = (f.contatos || []).filter(function(c) { return c && c.nome && c.nome.trim(); }).slice(0, 2);
  var ctHtml = cts.map(function(c, i) {
    return '<div class="abs" style="left:' + (i === 0 ? 380 : 760) + 'pt;top:524pt"><div class="lab"' + (i ? ' aria-hidden="true"' : '') + '>' + (i === 0 ? 'Contatos comerciais' : '&nbsp;') + '</div><div style="font-size:19pt;font-weight:600;color:var(--titulo);margin-top:7pt">' + esc(c.nome) + '</div>' +
      (c.cargo ? '<div style="font-size:15pt;margin-top:2pt">' + esc(c.cargo) + '</div>' : '') + (c.email ? '<div style="font-size:15pt;margin-top:2pt">' + esc(c.email) + '</div>' : '') + (c.tel ? '<div style="font-size:15pt;margin-top:2pt">' + esc(c.tel) + '</div>' : '') + '</div>';
  }).join('');
  var reun = dataL ? '<div class="abs" style="left:75pt;top:524pt"><div class="lab">Reunião de apresentação</div><div style="font-size:19pt;font-weight:600;color:var(--titulo);margin-top:7pt">' + psDataBR(f.reuniao.data) + (horaL ? ', ' + horaL : '') + '</div></div>' : '';
  pg.prox = page(15, 'Próximos passos', '<div class="cw rm"><table><thead><tr><th>#</th><th>Passo</th><th>Detalhe</th></tr></thead><tbody>' + rows15 + '</tbody></table>' +
    '<div style="margin-top:20pt;display:flex;gap:30pt;align-items:baseline;border-bottom:1pt solid var(--fio2);padding-bottom:16pt"><span class="lab d" style="width:130pt">Condição</span><span style="font-size:17pt;color:var(--titulo)">Confirmar a data do kick-off e receber o planejamento e o orçamento das obras contempladas.</span></div></div>' +
    '<div class="abs" style="left:75pt;right:75pt;top:500pt;height:1pt;background:var(--fio)"></div>' + reun + ctHtml);

  // 16 clientes parceiros
  var kph = PS_PARCEIROS_KP.map(function(k) { return '<div style="display:flex;align-items:baseline;gap:9pt"><span class="lab">Mais de</span><span style="font-size:27pt;font-weight:700;color:var(--laranja-prof)">' + k[0] + '</span><span style="font-size:14pt">' + k[1] + '</span></div>'; }).join('');
  var prh = PS_PREMIOS.map(function(p) { return '<div style="flex:1;display:flex;gap:10pt;align-items:center"><div style="flex:none;width:96pt;height:54pt;background:#18171C"><img src="img/proposta/' + p[0] + '.png" style="width:100%;height:100%;object-fit:contain" alt=""></div><div style="font-size:11.5pt;line-height:1.25;color:var(--titulo);font-weight:600">' + p[1] + '</div></div>'; }).join('');
  pg.par = page(16, 'Clientes parceiros e resultados atingidos', '<div class="abs" style="left:75pt;top:150pt;width:1290pt;display:flex;gap:30pt;align-items:flex-start"><img src="' + (imgs.portA || 'img/proposta/portfolio_a.png') + '" style="width:630pt;display:block" alt=""><img src="' + (imgs.portB || 'img/proposta/portfolio_b.png') + '" style="width:630pt;display:block" alt=""></div>' +
    '<div class="abs" style="left:75pt;right:75pt;top:528pt;border-top:1.5pt solid var(--titulo);padding-top:12pt;display:flex;justify-content:space-between;align-items:baseline">' + kph + '</div>' +
    '<div class="abs" style="left:75pt;right:75pt;top:610pt;border-top:1pt solid var(--fio);padding-top:16pt;display:flex;gap:16pt">' + prh + '</div>');

  var order = ['capa', 'met', 'res', 'falhas', 'perda', 'obj', 'dim', 'incl', 'est', 'ent', 'ws', 'cron', 'pil', 'inv', 'prox', 'par'];
  var html = order.map(function(k) { return pg[k]; });
  if (html.length !== PS_TOTAL) throw new Error('Proposta: número de páginas diferente de ' + PS_TOTAL);
  return { pages: html, model: M };
}
function psDocHtml(pages, titulo) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + psEsc(titulo) + '</title><link rel="stylesheet" href="proposta-siiga.css"></head><body>' + pages.join('\n') + '</body></html>';
}

// ── Imagens: logo do cliente (upload) e multiplicacao sobre o creme (html2canvas nao faz blend) ─
function psCarregaImg(src) { return new Promise(function(res, rej) { var im = new Image(); im.onload = function() { res(im); }; im.onerror = function() { rej(new Error('imagem')); }; im.src = src; }); }
// Upload da logo: reduz, corta as margens brancas/transparentes e devolve um PNG em base64 (cabe no state do assessment)
function psPreparaLogo(src) {
  return psCarregaImg(src).then(function(im) {
    var w0 = im.naturalWidth || 600, h0 = im.naturalHeight || 200;
    var k = Math.min(1, 700 / w0, 260 / h0), w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) for (var xx = 0; xx < w; xx++) { var i = (y * w + xx) * 4; if (d[i + 3] > 12 && !(d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245)) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < x0 || y1 < y0) return c.toDataURL('image/png');
    var cw = x1 - x0 + 1, ch = y1 - y0 + 1, c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
    c2.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
    return c2.toDataURL('image/png');
  });
}
function psMultiplica(src) {
  return psCarregaImg(src).then(function(im) {
    var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    var x = c.getContext('2d'); x.fillStyle = PS_CREME; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'multiply'; x.drawImage(im, 0, 0);
    return { url: c.toDataURL('image/png'), w: c.width, h: c.height };
  });
}
function psPreparaImagens(f) {
  var imgs = {};
  var jobs = [psMultiplica('img/proposta/portfolio_a.png').then(function(r) { imgs.portA = r.url; }), psMultiplica('img/proposta/portfolio_b.png').then(function(r) { imgs.portB = r.url; })];
  if (f.logo) jobs.push(psMultiplica(f.logo).then(function(r) { imgs.logo = r; }).catch(function() {}));
  return Promise.all(jobs).then(function() { return imgs; });
}

// ── Geracao do PDF ───────────────────────────────────────────────────────────────────────────
function generatePropostaSiiga(opts) {
  opts = opts || {};
  var f = opts.ficha || psFichaPadrao(psModel({}));
  var erros = psValida(f);
  if (erros.length) { alert('Não é possível gerar a proposta:\n- ' + erros.join('\n- ')); return Promise.resolve(false); }
  var loadDiv = document.createElement('div');
  loadDiv.id = 'pdf-loading';
  loadDiv.style.cssText = 'position:fixed;inset:0;background:rgba(15,16,21,0.95);z-index:3000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
  loadDiv.innerHTML = '<div style="width:48px;height:48px;border:3px solid rgba(255,255,255,0.1);border-top-color:#ea580c;border-radius:50%;animation:spin 0.8s linear infinite"></div><div style="font-family:Bai Jamjuree;font-size:14px;color:white">Gerando Proposta...</div><div style="font-size:12px;color:var(--gray2)">Aguarde alguns segundos</div>';
  document.body.appendChild(loadDiv);
  if (!document.getElementById('spin-style')) { var st = document.createElement('style'); st.id = 'spin-style'; st.textContent = '@keyframes spin{to{transform:rotate(360deg)}}'; document.head.appendChild(st); }
  // html2canvas desenha em canvas do documento principal: a fonte do documento precisa existir tambem aqui (senao as larguras do texto divergem do layout)
  if (!document.getElementById('ps-fontface')) {
    var sf = document.createElement('style'); sf.id = 'ps-fontface';
    sf.textContent = '@font-face{font-family:"DM Sans";src:url("img/proposta/DMSans.ttf");font-weight:100 1000;font-style:normal}@font-face{font-family:"DM Sans";src:url("img/proposta/DMSans-Italic.ttf");font-weight:100 1000;font-style:italic}';
    document.head.appendChild(sf);
  }
  var fr = null;
  function cleanup() { if (loadDiv.parentNode) loadDiv.parentNode.removeChild(loadDiv); if (fr && fr.parentNode && !window.__PS_KEEP_DOM) fr.parentNode.removeChild(fr); }
  var built = null;
  var fontsMain = ['400', '500', '600', '650', '700'].map(function(wt) { return document.fonts.load(wt + ' 20px "DM Sans"'); }).concat([document.fonts.load('italic 400 20px "DM Sans"')]);
  return Promise.all(fontsMain).then(function() { return psPreparaImagens(f); }).then(function(imgs) {
    built = psBuildPages(f, imgs);
    var titulo = 'Escopo de Redesenho SIIGA, ' + built.model.empresa;
    return new Promise(function(resolve, reject) {
      fr = document.createElement('iframe');
      fr.id = 'proposta-siiga-frame';
      fr.style.cssText = 'position:fixed;left:-20000px;top:0;width:1920px;height:' + (1080 * PS_TOTAL) + 'px;border:0;visibility:hidden';
      fr.onload = function() { resolve(fr); };
      fr.onerror = reject;
      fr.srcdoc = psDocHtml(built.pages, titulo);
      document.body.appendChild(fr);
    });
  }).then(function() {
    var d = fr.contentDocument, loads = [];
    ['400', '500', '600', '650', '700'].forEach(function(w) { loads.push(d.fonts.load(w + ' 20px "DM Sans"')); });
    loads.push(d.fonts.load('italic 400 20px "DM Sans"'));
    var ims = Array.prototype.slice.call(d.images).map(function(im) { return im.complete ? 0 : new Promise(function(r) { im.onload = im.onerror = r; }); });
    return Promise.all(loads.concat(ims)).then(function() { return d.fonts.ready; }).then(function() { return new Promise(function(r) { setTimeout(r, 300); }); });
  }).then(function() {
    var JS = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var pdf = new JS({ orientation: 'landscape', unit: 'pt', format: [1440, 810], compress: true });
    var M = built.model;
    pdf.setProperties({ title: 'Proposta SIIGA · ' + M.empresa, author: 'Agilean', subject: 'Escopo de Redesenho SIIGA · ' + M.empresa, keywords: 'SIIGA, proposta', creator: 'SIIGA Assessment' });
    var els = Array.prototype.slice.call(fr.contentDocument.querySelectorAll('.page'));
    var idx = 0;
    return new Promise(function(resolve, reject) {
      function next() {
        if (idx >= els.length) { resolve(pdf); return; }
        html2canvas(els[idx], { scale: 1.5, useCORS: true, allowTaint: true, backgroundColor: PS_CREME, logging: false, windowWidth: 1920, windowHeight: 1080 * PS_TOTAL }).then(function(canvas) {
          if (idx > 0) pdf.addPage([1440, 810], 'landscape');
          var png = canvas.toDataURL('image/png');
          if (window.__PS_PNGS) window.__PS_PNGS.push(png);   // gancho de teste: as mesmas imagens que vao para o PDF
          pdf.addImage(png, 'PNG', 0, 0, 1440, 810, undefined, 'FAST');
          idx++; next();
        }).catch(reject);
      }
      next();
    });
  }).then(function(pdf) {
    var empresa = (built.model.empresa || 'cliente').replace(/[^a-zA-Z0-9]/g, '_');
    var data = (S.data || new Date().toISOString().split('T')[0]);
    window.__LAST_PROPOSTA_PDF_DATA = pdf.output('datauristring');
    if (!opts.semSalvar) pdf.save('SIIGA_Proposta_' + empresa + '_' + data + '.pdf');
    var textos = Array.prototype.map.call(fr.contentDocument.querySelectorAll('.page'), function(p) { return p.innerText; });
    window.__LAST_PROPOSTA_TEXT = textos;
    var achados = textos.join('\n').match(new RegExp(PS_TERMOS_PROIBIDOS.source, 'gi')) || [];
    window.__PS_TERMOS_ACHADOS = achados;
    cleanup();
    if (typeof showToast === 'function') showToast(achados.length ? 'Proposta gerada. Atenção: o texto contém termos que o padrão evita (' + achados.slice(0, 3).join(', ') + '), provavelmente em uma fala do cliente. Revise.' : 'Proposta gerada com sucesso!', achados.length ? 'error' : undefined);
    return true;
  }).catch(function(err) {
    cleanup();
    console.error('Proposta PDF error:', err);
    alert('Erro ao gerar a Proposta. Tente novamente.');
    return false;
  });
}

// ── Extracao LOCAL de falas (sem IA) ─────────────────────────────────────────────────────────
// 1) falantes da transcricao  2) frases do decisor  3) pontuacao por palavras-chave do diagnostico  4) ponto/pilar provavel
var PS_STOP = {};
('de da do das dos em no na nos nas um uma uns umas que com por para pra pro como mais mas mesmo mesma isso isto essa esse esta este aqui ali ' +
 'ainda entao porque quando onde qual quais quem seu sua seus suas nosso nossa nossos nossas voce voces gente tambem muito muita muitos muitas ' +
 'foi era sao ser ter tem tinha temos tenho vai vou vamos fazer feito faz fazendo ficar fica ficam cada outro outra outros outras todo toda todos todas ' +
 'sobre entre depois antes sempre nunca assim ate desde alguma algum alguns algumas nada tudo coisa coisas jeito forma parte tipo agora hoje sobre ' +
 'sendo estao esta estar estou estamos esse esses essas desse dessa disso nisso nesse nessa neste nesta deles delas dele dela meu minha ' +
 'pode podem poder precisa precisam preciso deve devem' ).split(' ').forEach(function(w) { if (w) PS_STOP[w] = 1; });
// Termos de gestao de obras da propria metodologia (genericos, nada de cliente): reforcam o dicionario montado dos gaps e pilares
var PS_TERMOS_CHAVE = ['medicao', 'restricao', 'suprimentos', 'retrabalho', 'qualidade', 'fvs', 'cronograma', 'reuniao', 'padronizacao', 'diretoria',
  'orcamento', 'planejamento', 'lookahead', 'empreiteiro', 'indicador', 'relatorio', 'checkin', 'checkout', 'apontamento', 'produtividade', 'prazo', 'custo',
  'financeiro', 'dinheiro', 'decisao', 'resultado', 'linha de balanco', 'ppc', 'meta', 'rotina', 'integracao', 'canteiro'];
function psStem(w) { return w.length > 6 ? w.slice(0, 6) : w; }
function psTokensChave(texto) {
  var out = {};
  psNorm(texto).split(' ').forEach(function(w) { if (w.length >= 4 && !/^\d+$/.test(w) && !PS_STOP[w]) out[psStem(w)] = 1; });
  return out;
}
// Dicionario: cada stem pesa ln(N/df) sobre TODOS os gaps da metodologia (palavra que aparece em quase tudo pesa pouco);
// os pontos do cliente pesam mais (prioridades x2). Ligacoes stem -> pontos e stem -> pilares para indicar o provavel.
function psDicionario(M) {
  var codes = Object.keys(GAP_INFO), N = codes.length || 1, df = {}, porCodigo = {};
  codes.forEach(function(c) {
    var q = null, bk = (/^MO\./.test(c)) ? 'mo' : 'f' + c.charAt(1);
    try { q = findQ(bk, c); } catch (e) {}
    var txt = [GAP_INFO[c].gap, GAP_INFO[c].impact].concat(q && q.opts ? q.opts.map(function(o) { return (o.l || '') + ' ' + (o.s || ''); }) : []).join(' ');
    var st = psTokensChave(txt); porCodigo[c] = st;
    Object.keys(st).forEach(function(s) { df[s] = (df[s] || 0) + 1; });
  });
  var peso = function(s) { var d = df[s] || 1; return d > N * 0.35 ? 0 : Math.log(N / d); };
  var dic = { peso: peso, pontos: [], pilares: [], chave: {} };
  M.pontos.forEach(function(p) {
    var base = porCodigo[p.code] || {}, st = {};
    Object.keys(base).forEach(function(s) { st[s] = 1; });
    Object.keys(psTokensChave(p.falha + ' ' + p.titulo + ' ' + p.situacao)).forEach(function(s) { st[s] = 1; });
    dic.pontos.push({ ponto: p, stems: st, mult: p.prio ? 2 : 1.3 });
  });
  PS_PILARES.forEach(function(pl) { dic.pilares.push({ n: pl.n, stems: psTokensChave(pl.nome + ' ' + pl.resumo + ' ' + pl.itens.join(' ')) }); });
  PS_OBJETIVOS.forEach(function(o) { Object.keys(psTokensChave(o.nome + ' ' + o.como)).forEach(function(s) { dic.chave[s] = 1; }); });
  PS_ENTREGAVEIS.forEach(function(e) { Object.keys(psTokensChave(e.k + ' ' + e.t)).forEach(function(s) { dic.chave[s] = 1; }); });
  PS_TERMOS_CHAVE.forEach(function(t) { Object.keys(psTokensChave(t)).forEach(function(s) { dic.chave[s] = 1; }); });
  return dic;
}
function psPontuaFrase(frase, dic) {
  var st = psTokensChave(frase.texto), melhor = {}, achados = [];
  Object.keys(st).forEach(function(s) {
    var w = 0, pw = dic.peso(s);
    dic.pontos.forEach(function(d) { if (d.stems[s]) w = Math.max(w, pw * d.mult); });
    dic.pilares.forEach(function(d) { if (d.stems[s]) w = Math.max(w, 1); });
    if (dic.chave[s]) w = Math.max(w, 1.5);
    if (w > 0) { melhor[s] = w; achados.push(s); }
  });
  var soma = achados.reduce(function(a, s) { return a + melhor[s]; }, 0);
  var pal = frase.texto.split(/\s+/).length;
  var score = soma * (1 + Math.min(pal, 30) / 60) * (pal > 70 ? 0.8 : 1);
  // ponto provavel: o ponto do cliente com maior soma de stems em comum; senao, o pilar
  var bp = null, bv = 0;
  dic.pontos.forEach(function(d) { var v = 0; achados.forEach(function(s) { if (d.stems[s]) v += dic.peso(s); }); v *= d.mult; if (v > bv) { bv = v; bp = d.ponto; } });
  var pil = bp ? bp.pil : 0;
  if (!bp) { var bpv = 0; dic.pilares.forEach(function(d) { var v = achados.filter(function(s) { return d.stems[s]; }).length; if (v > bpv) { bpv = v; pil = d.n; } }); }
  return { score: Math.round(score * 100) / 100, termos: achados, ponto: bp ? { code: bp.code, n: bp.n, falha: bp.falha } : null, pilar: pil };
}
// Falantes. Aceita: "M:SS - Nome" (linha propria) | VTT com <v Nome> | "Nome: texto". Sem rotulos: um falante nao identificado.
function psChaveNome(n) { return psNorm(n).split(' ').filter(Boolean); }
function psMesmoNome(a, b) { // "Israel C" ~ "Israel Chacon": cada palavra do menor e prefixo da correspondente do maior
  var x = psChaveNome(a), y = psChaveNome(b); if (x.length > y.length) { var t = x; x = y; y = t; }
  if (!x.length) return false;
  for (var i = 0; i < x.length; i++) if (y[i] === undefined || y[i].indexOf(x[i]) !== 0) return false;
  return true;
}
function psParseFalantes(raw) {
  raw = String(raw || '').replace(/\r/g, '');
  var linhas = raw.split('\n'), turnos = [], cur = null, formato = '';
  var nTs = linhas.filter(function(l) { return PS_RE_FALANTE_TS.test(l); }).length;
  if (nTs >= 3) {
    formato = 'tempo-nome';
    linhas.forEach(function(l) { var m = PS_RE_FALANTE_TS.exec(l); if (m) { cur = { nome: m[2].trim(), t: m[1], partes: [] }; turnos.push(cur); } else if (cur && l.trim()) cur.partes.push(l.trim()); });
  } else if (/<v[ .][^>]*>/.test(raw)) {
    formato = 'vtt';
    linhas.forEach(function(l) {
      var t = l.trim(); if (!t || /^WEBVTT/.test(t) || /-->/.test(t) || /^\d+$/.test(t)) return;
      var m = /<v(?:\.[^ >]*)? ([^>]+)>(.*)$/.exec(t);
      if (m) { var nome = m[1].trim(), tx = m[2].replace(/<[^>]+>/g, '').trim(); if (cur && cur.nome === nome) { if (tx) cur.partes.push(tx); } else { cur = { nome: nome, t: '', partes: tx ? [tx] : [] }; turnos.push(cur); } }
      else if (cur) cur.partes.push(t.replace(/<[^>]+>/g, ''));
    });
  } else {
    var re = /^\s*(?:\[?(?:\d{1,2}:)?\d{1,2}:\d{2}\]?\s*)?([A-ZÀ-Ú][^:\n]{1,40}):\s+(\S.*)$/;
    var cont = {}; linhas.forEach(function(l) { var m = re.exec(l); if (m) cont[m[1].trim()] = (cont[m[1].trim()] || 0) + 1; });
    var nomes = Object.keys(cont).filter(function(n) { return cont[n] >= 3; });
    if (nomes.length >= 2) {
      formato = 'nome-dois-pontos';
      linhas.forEach(function(l) { var m = re.exec(l); if (m && cont[m[1].trim()] >= 3) { cur = { nome: m[1].trim(), t: '', partes: [m[2].trim()] }; turnos.push(cur); } else if (cur && l.trim()) cur.partes.push(l.trim()); });
    }
  }
  if (!turnos.length) { formato = 'sem-rotulos'; turnos = [{ nome: 'Falante não identificado', t: '', partes: [psTextoPlano(raw)] }]; }
  var grupos = [];
  turnos.forEach(function(t) {
    var g = grupos.filter(function(x) { return psMesmoNome(x.nome, t.nome); })[0];
    if (!g) { g = { nome: t.nome, turnos: [], variantes: [] }; grupos.push(g); }
    if (t.nome.length > g.nome.length) g.nome = t.nome;
    if (g.variantes.indexOf(t.nome) < 0) g.variantes.push(t.nome);
    g.turnos.push(t.partes.join('\n'));
  });
  grupos.forEach(function(g) { g.palavras = g.turnos.join(' ').split(/\s+/).filter(Boolean).length; g.nTurnos = g.turnos.length; });
  grupos.sort(function(a, b) { return b.palavras - a.palavras; });
  return { formato: formato, falantes: grupos };
}
// Falante que bate com o nome do decisor da ficha (primeiro nome obrigatorio); -1 se nenhum
function psSugereFalante(falantes, decisorNome) {
  var d = psChaveNome(decisorNome); if (!d.length) return -1;
  var melhor = -1, bv = 0;
  falantes.forEach(function(f, i) {
    var t = psChaveNome(f.nome); if (!t.length || t[0].indexOf(d[0]) !== 0 && d[0].indexOf(t[0]) !== 0) return;
    var v = 1; for (var k = 1; k < d.length; k++) if (t[k] && (t[k].indexOf(d[k]) === 0 || d[k].indexOf(t[k]) === 0)) v++;
    if (v > bv) { bv = v; melhor = i; }
  });
  return melhor;
}
// Sentencas do falante (todas, na ordem; cada uma sabe de que turno veio): separa por pontuacao final
function psSentencasDoFalante(falante) {
  var out = [];
  falante.turnos.forEach(function(turno, ti) {
    turno.split('\n').forEach(function(par) {
      par.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú0-9"“(])/).forEach(function(s) { s = s.trim(); if (s) out.push({ texto: s, turno: ti }); });
    });
  });
  return out;
}
// Frases candidatas: tira as muito curtas (< 6 palavras) e as repetidas; guarda a posicao (ord) para "unir com a seguinte"
function psFrasesDoFalante(falante) {
  var vistas = {}, out = [], todas = psSentencasDoFalante(falante);
  todas.forEach(function(s, ord) {
    if (s.texto.split(/\s+/).length < 6) return;
    var k = psNorm(s.texto); if (!k || vistas[k]) return;
    vistas[k] = 1; out.push({ texto: s.texto, idx: out.length, ord: ord, turno: s.turno });
  });
  out.todas = todas;
  return out;
}
// Candidatas ordenadas por pontuacao (empate: ordem na reuniao). A lista carrega `todas` e `dic` para o "unir".
function psCandidatas(falante, M) {
  var dic = psDicionario(M), fr = psFrasesDoFalante(falante);
  var lst = fr.map(function(f) { var r = psPontuaFrase(f, dic); return { texto: f.texto, idx: f.idx, ord: f.ord, turno: f.turno, score: r.score, termos: r.termos, ponto: r.ponto, pilar: r.pilar, unidas: 0 }; });
  lst.sort(function(a, b) { return (b.score - a.score) || (a.idx - b.idx); });
  lst.forEach(function(c, i) { c.rank = i + 1; });
  lst.todas = fr.todas; lst.dic = dic;
  return lst;
}
// "Unir com a frase seguinte": so dentro do mesmo turno de fala; recalcula a pontuacao e o ponto provavel
function psTemProxima(c, todas) { var n = todas[c.ord + 1]; return !!n && n.turno === c.turno; }
function psUneProxima(c, todas, dic) {
  if (!psTemProxima(c, todas)) return false;
  c.texto = c.texto + ' ' + todas[c.ord + 1].texto; c.ord++; c.unidas++;
  var r = psPontuaFrase({ texto: c.texto }, dic); c.score = r.score; c.termos = r.termos; c.ponto = r.ponto; c.pilar = r.pilar;
  return true;
}
// Busca por palavra nas candidatas: sem acento e sem diferenciar maiusculas
function psFiltraCandidatas(lista, busca) {
  var q = psNorm(busca); if (!q) return lista;
  return lista.filter(function(c) { return (' ' + psNorm(c.texto) + ' ').indexOf(q) >= 0; });
}
// Segunda fonte de falas: o que o proprio diagnostico registrou (comentarios do vendedor em S.dores[*].frase e
// o texto da resposta escolhida em cada ponto). Cada uma e verificada contra o texto dessa fonte, nao contra a transcricao.
function psFontesDiagnostico(M) {
  var out = [], vistos = {};
  var add = function(texto, ponto, tipo) {
    texto = String(texto || '').trim(); if (texto.split(/\s+/).length < 3) return;
    var k = psNorm(texto); if (!k || vistos[k]) return; vistos[k] = 1;
    out.push({ texto: texto, ponto: ponto, tipo: tipo });
  };
  var dores = (typeof S !== 'undefined' && S.dores) || {};
  var porCodigo = {}; M.pontos.forEach(function(p) { porCodigo[p.code] = p; });
  Object.keys(dores).forEach(function(code) {
    var d = dores[code]; if (!d || !d.frase) return;
    var p = porCodigo[code] || { code: code, n: '', falha: (GAP_INFO[code] || {}).gap || code, pil: 0 };
    add(d.frase, p, 'comentário do vendedor');
  });
  M.pontos.slice().sort(function(a, b) { return (b.prio ? 1 : 0) - (a.prio ? 1 : 0); }).forEach(function(p) {
    if (p.respS) add(p.respS, p, 'resposta registrada');
    if (p.respL) add(p.respL, p, 'resposta registrada');
  });
  return out;
}
// Texto de referencia da trava das falas do diagnostico (separador que nenhuma fala contem, para nao juntar fontes diferentes)
function psTextoFonteDiag(fontes) { return fontes.map(function(f) { return f.texto; }).join(' zzfimzz '); }
// O recorte editado so pode encurtar: tem que estar contido no original (reticencias ligam trechos na ordem)
function psRecorteValido(recorte, original) { return !!String(recorte || '').trim() && psFalaConfere(recorte, original); }

// ── Caminho 2 (opcional): instrucao para o vendedor colar no Claude e colar a resposta de volta ──
function psPromptCopiavel(M, f) {
  var pil = M.pilares.map(function(p) { return 'Pilar ' + p.n + ' | ' + p.nome + ' | ' + Math.round(p.pct * 100) + '% (' + psNumBR(p.pts, p.pts % 1 ? 1 : 0) + ' de ' + p.max + ')'; }).join('\n');
  var pts = M.pontos.map(function(p) { return p.code + ' | ' + p.n + (p.prio ? ' (prioridade)' : '') + ' | ' + p.falha + ' | ' + (p.pil ? 'Pilar ' + p.pil : '-'); }).join('\n');
  var objs = PS_OBJETIVOS.map(function(o) { return o.id + ' | ' + o.nome; }).join('\n');
  var ents = PS_ENTREGAVEIS.map(function(e) { return e.id + ' | ' + e.k + ': ' + e.t; }).join('\n');
  var dec = f && f.decisor && f.decisor.nome ? f.decisor.nome + (f.decisor.cargo ? ', ' + f.decisor.cargo : '') : '';
  return 'Você apoia um vendedor da Agilean a montar uma proposta comercial. Mais abaixo vou colar a transcrição da reunião em que o diagnóstico foi apresentado ao cliente. ' +
    'Com ela, e com o contexto do diagnóstico e a biblioteca padrão abaixo, sugira as falas do cliente, os objetivos e os critérios da obra-piloto.\n\n' +
    'REGRAS\n' +
    '1. Use SOMENTE o que está na transcrição. Não invente nome, cargo, fala nem critério.\n' +
    '2. As falas são do decisor (ou patrocinador) do cliente e devem ser cópias LITERAIS de trechos da transcrição, sem corrigir, sem resumir e sem juntar frases de momentos diferentes. Para omitir um trecho do meio, use (...).\n' +
    '3. No máximo ' + PS_MAX_FALAS + ' falas. Cada uma ligada a um alvo: "obj:<id do objetivo>", "ent:<id do entregável>" ou "falha:<código do ponto crítico>".\n' +
    '4. Escolha exatamente 4 objetivos da biblioteca, priorizando os pontos críticos do diagnóstico e o que o cliente pediu.\n' +
    '5. Se o nome padrão de um objetivo escolhido puder ser adaptado ao caso do cliente, proponha em "objetivos_nomes" um nome na linguagem do método (curto, institucional, sem gíria). NUNCA copie a fala do cliente nem use palavras dele entre aspas como nome. Se não houver adaptação melhor, omita.\n' +
    '6. Critérios de escolha da obra-piloto: só os que o cliente mencionou (até 3), em frases curtas. Se não houver, devolva lista vazia.\n' +
    '7. Cada fala é SÓ a frase literal entre aspas: sem nome, sem cargo e sem atribuição. O campo "decisor" é opcional e serve apenas para eu conferir quem é o falante; se não estiver claro, devolva vazio.\n\n' +
    'CONTEXTO DO DIAGNÓSTICO\nCliente: ' + M.empresa + '\n' + (dec ? 'Decisor informado pelo vendedor: ' + dec + '\n' : '') + '\nPILARES (pilar | nome | pontuação)\n' + pil + '\n\nPONTOS CRÍTICOS (código | nº | falha | pilar)\n' + pts + '\n\n' +
    'BIBLIOTECA\nOBJETIVOS (id | nome)\n' + objs + '\n\nENTREGÁVEIS (id | nome)\n' + ents + '\n\n' +
    'FORMATO DA RESPOSTA: apenas um JSON, sem texto antes ou depois, exatamente neste formato:\n' +
    '{"decisor":{"nome":"","cargo":""},"falas":[{"texto":"","alvo":""}],"objetivos":["id","id","id","id"],"objetivos_nomes":[{"id":"","nome":""}],"criterios":["",""]}\n\n' +
    'TRANSCRIÇÃO (cole abaixo desta linha):\n';
}
// JSON tolerante: aceita cercas ```json, texto antes/depois, virgulas sobrando e aspas curvas
function psExtraiJson(t) {
  t = String(t || '').trim();
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('não encontrei um JSON no texto colado.');
  var s = t.slice(a, b + 1);
  try { return JSON.parse(s); } catch (e1) {}
  var s2 = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(s2); } catch (e2) { throw new Error('o JSON está incompleto ou inválido (' + e2.message + ').'); }
}
// Nome adaptado de objetivo (opcional): so para ids escolhidos; descarta o que for copia de trecho da transcricao ou longo demais
function psNomesAdaptados(lista, ids, transcricao) {
  var out = {};
  (Array.isArray(lista) ? lista : []).forEach(function(x) {
    var id = x && x.id, nome = String((x && x.nome) || '').trim();
    if (!id || ids.indexOf(id) < 0 || !nome || nome.length > 90) return;
    if (psFalaConfere(nome, transcricao)) return; // copia literal da fala: nao entra
    out[id] = nome;
  });
  return out;
}
// Converte a resposta colada em sugestoes conferidas contra a transcricao (nada entra direto na ficha)
function psSugestoesDaResposta(r, transcricao, M) {
  var okObj = {}; PS_OBJETIVOS.forEach(function(o) { okObj[o.id] = 1; });
  var okEnt = {}; PS_ENTREGAVEIS.forEach(function(o) { okEnt[o.id] = 1; });
  var okFalha = {}; M.pontos.forEach(function(p) { okFalha[p.code] = 1; });
  var alvoOk = function(a) { var m = /^(obj|ent|falha):(.+)$/.exec(a || ''); return !!m && !!({ obj: okObj, ent: okEnt, falha: okFalha })[m[1]][m[2]]; };
  var falas = (r.falas || []).slice(0, PS_MAX_FALAS).map(function(x) {
    var t = String(x.texto || '').trim();
    return { texto: t, alvo: alvoOk(x.alvo) ? x.alvo : '', origem: 'ia', verif: psFalaConfere(t, transcricao) ? 'ok' : 'nao_encontrada', confirmada: false };
  }).filter(function(x) { return x.texto; });
  var objetivos = (r.objetivos || []).filter(function(id, i, a) { return okObj[id] && a.indexOf(id) === i; }).slice(0, 4);
  return {
    decisor: { nome: String((r.decisor || {}).nome || '').trim(), cargo: String((r.decisor || {}).cargo || '').trim() },
    falas: falas, objetivos: objetivos.length === 4 ? objetivos : [],
    nomes: psNomesAdaptados(r.objetivos_nomes, objetivos, transcricao),
    criterios: (r.criterios || []).map(function(c) { return String(c || '').trim(); }).filter(Boolean).slice(0, 3)
  };
}

// ── Formulario "Ficha da proposta" ───────────────────────────────────────────────────────────
function openPropostaSiiga() {
  var M0 = psModel({});
  var diagFontes = psFontesDiagnostico(M0), diagTxt = psTextoFonteDiag(diagFontes);
  var w = psFichaPadrao(M0);
  w.falas.forEach(function(x) { if (!x.verif) x.verif = 'manual'; });
  var sug = null, temp = { orcTxt: '', sugErr: '' };
  var old = document.getElementById('proposta-modal'); if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'proposta-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(8,9,13,0.82);z-index:2000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px;font-family:Inter,system-ui,sans-serif';
  var css = '<style>#proposta-modal .pf{width:100%;background:#0f1017;border:1px solid rgba(255,255,255,0.15);border-radius:7px;color:#f8fafc;padding:7px 9px;font-size:13px;box-sizing:border-box;font-family:inherit}' +
    '#proposta-modal .pf:disabled{opacity:.6}#proposta-modal label.l{display:block;font-size:11px;color:#94a3b8;margin:0 0 4px}' +
    '#proposta-modal .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}#proposta-modal .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px}' +
    '#proposta-modal .h{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#ea580c;margin:20px 0 10px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08)}' +
    '#proposta-modal .btn2{background:none;border:1px solid rgba(255,255,255,0.18);color:#cbd5e1;border-radius:8px;padding:7px 12px;cursor:pointer;font-size:12px}' +
    '#proposta-modal .nota{font-size:11px;color:#94a3b8;margin-top:4px}#proposta-modal .bad{color:#f87171}#proposta-modal .ok{color:#34d399}#proposta-modal .warn{color:#fbbf24}' +
    '#proposta-modal .fala{border:1px solid rgba(255,255,255,0.1);border-radius:9px;padding:10px;margin-bottom:8px;background:#1a1c26}</style>';
  ov.innerHTML = css + '<div style="width:100%;max-width:780px;background:#141621;border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden">' +
    '<div style="display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.08)"><div><div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#ea580c">Agilean · SIIGA</div><div style="font-family:Bai Jamjuree;font-size:19px;font-weight:700;color:#f8fafc">Ficha da proposta</div></div>' +
    '<button id="pm-close" style="margin-left:auto;background:none;border:1px solid rgba(255,255,255,0.18);color:#94a3b8;border-radius:8px;padding:6px 10px;cursor:pointer">Fechar</button></div>' +
    '<div id="pm-body" style="padding:18px 22px;color:#e2e8f0;font-size:13px"></div>' +
    '<div id="pm-err" style="padding:0 22px 8px;font-size:12px" class="bad"></div>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;padding:16px 22px;border-top:1px solid rgba(255,255,255,0.08)"><button id="pm-cancel" class="btn2" style="padding:10px 16px">Cancelar</button><button id="pm-gen" style="background:#ea580c;border:none;color:#fff;border-radius:9px;padding:10px 20px;font-family:Bai Jamjuree;font-weight:700;font-size:13px;cursor:pointer">📝 Gerar Proposta SIIGA</button></div></div>';
  document.body.appendChild(ov);
  var body = ov.querySelector('#pm-body');
  var $ = function(id) { return body.querySelector('#' + id); };
  var optsAlvo = function(sel) {
    var h = '<option value="">(sem ligação)</option><optgroup label="Objetivos">';
    w.objetivos.forEach(function(o) { h += '<option value="obj:' + o.id + '"' + (sel === 'obj:' + o.id ? ' selected' : '') + '>' + psEsc(o.nome) + '</option>'; });
    h += '</optgroup><optgroup label="Entregáveis">';
    PS_ENTREGAVEIS.forEach(function(e) { h += '<option value="ent:' + e.id + '"' + (sel === 'ent:' + e.id ? ' selected' : '') + '>' + psEsc(e.k) + '</option>'; });
    h += '</optgroup><optgroup label="Falhas do diagnóstico">';
    M0.pontos.forEach(function(p) { h += '<option value="falha:' + p.code + '"' + (sel === 'falha:' + p.code ? ' selected' : '') + '>' + p.n + ' · ' + psEsc(p.falha) + '</option>'; });
    return h + '</optgroup>';
  };
  var fmtIn = function(v, d) { return (v === '' || v == null || isNaN(v)) ? '' : psNumBR(v, d == null ? 2 : d); };

  function renderFalas() {
    var c = $('pm-falas'); if (!c) return;
    var h = w.falas.map(function(x, i) {
      var st = '';
      var temT = !!(w.transcricao.texto || '').trim();
      var dg = x.origem === 'diagnostico';
      if ((x.origem === 'ia' || dg) && x.verif !== 'ok') st = '<span class="bad">não encontrada ' + (dg ? 'no diagnóstico' : 'na transcrição') + (x.confirmada ? ' (confirmada pelo vendedor)' : ' (fica fora da proposta até você confirmar)') + '</span>' + (x.confirmada ? '' : ' <button class="btn2" data-conf="' + i + '">Confirmar mesmo assim</button>');
      else if (dg) st = '<span class="ok">conferida com o diagnóstico</span> · <span style="color:#fbbf24">diagnóstico</span>';
      else if (x.origem === 'ia') st = '<span class="ok">conferida com a transcrição</span>';
      else if (temT) st = psFalaConfere(x.texto, w.transcricao.texto) ? '<span class="ok">conferida com a transcrição</span>' : '<span class="warn">não encontrada na transcrição (digitada por você)</span>';
      if (x.alvo === '') st += (st ? ' · ' : '') + '<span class="warn">sem ligação: não aparece na proposta</span>';
      if (PS_TERMOS_PROIBIDOS.test(x.texto)) st += (st ? ' · ' : '') + '<span class="warn">a fala contém um termo que o padrão da proposta evita (fala literal não é alterada: edite se quiser)</span>';
      return '<div class="fala"><textarea class="pf" rows="2" data-ft="' + i + '">' + psEsc(x.texto) + '</textarea><div style="display:flex;gap:8px;margin-top:6px;align-items:center"><select class="pf" style="flex:1" data-fa="' + i + '">' + optsAlvo(x.alvo) + '</select><button class="btn2" data-fd="' + i + '">Apagar</button></div><div class="nota">' + st + '</div></div>';
    }).join('');
    c.innerHTML = h || '<div class="nota">Nenhuma fala. A proposta sai sem falas do cliente.</div>';
    $('pm-addfala').disabled = w.falas.length >= PS_MAX_FALAS;
    $('pm-nfalas').textContent = w.falas.length + ' / ' + PS_MAX_FALAS;
    c.querySelectorAll('[data-ft]').forEach(function(el) { el.addEventListener('input', function() { var x = w.falas[+el.dataset.ft]; x.texto = el.value; if (x.origem === 'ia' || x.origem === 'diagnostico') { x.verif = psFalaConfere(x.texto, x.origem === 'diagnostico' ? diagTxt : w.transcricao.texto) ? 'ok' : 'nao_encontrada'; x.confirmada = false; } }); el.addEventListener('change', renderFalas); });
    c.querySelectorAll('[data-fa]').forEach(function(el) { el.addEventListener('change', function() { w.falas[+el.dataset.fa].alvo = el.value; renderFalas(); }); });
    c.querySelectorAll('[data-fd]').forEach(function(el) { el.addEventListener('click', function() { w.falas.splice(+el.dataset.fd, 1); renderFalas(); }); });
    c.querySelectorAll('[data-conf]').forEach(function(el) { el.addEventListener('click', function() { if (confirm('Esta fala não foi encontrada na transcrição. Incluir na proposta mesmo assim?')) { w.falas[+el.dataset.conf].confirmada = true; renderFalas(); } }); });
  }
  function renderSug() {
    var c = $('pm-sug'); if (!c) return;
    if (temp.sugErr) { c.innerHTML = '<div class="bad" style="margin-top:8px">' + psEsc(temp.sugErr) + '</div>'; return; }
    if (!sug) { c.innerHTML = ''; return; }
    var h = '<div style="margin-top:10px;font-weight:700;color:#f8fafc">Sugestões da IA (nada entra na proposta sem você aceitar)</div>';
    h += '<div class="fala"><div class="nota">Decisor sugerido</div><div>' + (sug.decisor.nome ? psEsc(sug.decisor.nome + (sug.decisor.cargo ? ', ' + sug.decisor.cargo : '')) : '(não identificado)') + '</div>' + (sug.decisor.nome ? '<button class="btn2" id="sg-dec" style="margin-top:6px">Usar como decisor</button>' : '') + '</div>';
    h += sug.falas.map(function(x, i) {
      var nf = x.verif !== 'ok';
      return '<div class="fala"><textarea class="pf" rows="2" data-st="' + i + '">' + psEsc(x.texto) + '</textarea><div class="nota">' + (nf ? '<span class="bad">não encontrada na transcrição</span>' : '<span class="ok">conferida com a transcrição</span>') + '</div><div style="display:flex;gap:8px;margin-top:6px;align-items:center"><select class="pf" style="flex:1" data-sa="' + i + '">' + optsAlvo(x.alvo) + '</select><button class="btn2" data-sacc="' + i + '">' + (nf ? 'Aceitar mesmo assim' : 'Aceitar') + '</button><button class="btn2" data-sdel="' + i + '">Descartar</button></div></div>';
    }).join('');
    if (sug.objetivos.length) h += '<div class="fala"><div class="nota">Objetivos sugeridos</div><div>' + sug.objetivos.map(function(id) { var b = psObjBiblioteca(id), ad = sug.nomes && sug.nomes[id]; return psEsc(b.nome) + (ad ? ' <span class="ok">→ nome sugerido: ' + psEsc(ad) + '</span>' : ''); }).join('<br>') + '</div><button class="btn2" id="sg-obj" style="margin-top:6px">Usar estes objetivos (você pode editar o nome e o texto depois)</button></div>';
    if (sug.criterios.length) h += '<div class="fala"><div class="nota">Critérios da obra-piloto</div><div>' + sug.criterios.map(psEsc).join(' · ') + '</div><button class="btn2" id="sg-crit" style="margin-top:6px">Usar estes critérios</button></div>';
    c.innerHTML = h;
    var d = c.querySelector('#sg-dec'); if (d) d.addEventListener('click', function() { w.decisor = { nome: sug.decisor.nome, cargo: sug.decisor.cargo }; $('pm-decn').value = w.decisor.nome; $('pm-decc').value = w.decisor.cargo; });
    var o = c.querySelector('#sg-obj'); if (o) o.addEventListener('click', function() { w.objetivos = sug.objetivos.map(function(id) { var b = psObjDeId(id, psNomeCurtoFmt(w.nomeCurto)); if (sug.nomes && sug.nomes[id]) b.nome = sug.nomes[id]; return b; }); renderObj(); renderFalas(); });
    var k = c.querySelector('#sg-crit'); if (k) k.addEventListener('click', function() { w.piloto.criterios = sug.criterios.slice(); renderCrit(); });
    c.querySelectorAll('[data-st]').forEach(function(el) { el.addEventListener('input', function() { var x = sug.falas[+el.dataset.st]; x.texto = el.value; x.verif = psFalaConfere(x.texto, w.transcricao.texto) ? 'ok' : 'nao_encontrada'; }); el.addEventListener('change', renderSug); });
    c.querySelectorAll('[data-sa]').forEach(function(el) { el.addEventListener('change', function() { sug.falas[+el.dataset.sa].alvo = el.value; }); });
    c.querySelectorAll('[data-sdel]').forEach(function(el) { el.addEventListener('click', function() { sug.falas.splice(+el.dataset.sdel, 1); renderSug(); }); });
    c.querySelectorAll('[data-sacc]').forEach(function(el) { el.addEventListener('click', function() {
      var x = sug.falas[+el.dataset.sacc];
      if (w.falas.length >= PS_MAX_FALAS) { alert('Limite de ' + PS_MAX_FALAS + ' falas. Apague uma antes de aceitar.'); return; }
      if (x.verif !== 'ok' && !confirm('Esta fala não foi encontrada na transcrição. Incluir na proposta mesmo assim?')) return;
      w.falas.push({ texto: x.texto, alvo: x.alvo, origem: 'ia', verif: x.verif, confirmada: x.verif !== 'ok' });
      sug.falas.splice(+el.dataset.sacc, 1); renderSug(); renderFalas();
    }); });
  }
  function renderObj() {
    var c = $('pm-obj'); if (!c) return;
    c.innerHTML = [0, 1, 2, 3].map(function(i) {
      var o = w.objetivos[i] || { id: '', nome: '', como: '' };
      return '<div class="fala" style="grid-column:1/-1"><label class="l">Objetivo ' + psPad(i + 1) + ' · ponto de partida da biblioteca</label><select class="pf" data-ob="' + i + '">' + PS_OBJETIVOS.map(function(b) { return '<option value="' + b.id + '"' + (o.id === b.id ? ' selected' : '') + '>' + psEsc(b.nome) + '</option>'; }).join('') + '</select>' +
        '<label class="l" style="margin-top:8px">Nome do objetivo (editável)</label><input class="pf" data-on="' + i + '" value="' + psEsc(o.nome) + '">' +
        '<label class="l" style="margin-top:8px">Como (editável)</label><textarea class="pf" rows="3" data-oc="' + i + '">' + psEsc(o.como) + '</textarea></div>';
    }).join('');
    c.querySelectorAll('[data-ob]').forEach(function(el) { el.addEventListener('change', function() {
      var i = +el.dataset.ob;
      if (w.objetivos.some(function(x, k) { return k !== i && x.id === el.value; })) { alert('Este objetivo já está em outra posição. As falas se ligam ao objetivo; escolha outro.'); renderObj(); return; }
      w.objetivos[i] = psObjDeId(el.value, psNomeCurtoFmt(w.nomeCurto)); renderObj(); renderFalas();
    }); });
    c.querySelectorAll('[data-on]').forEach(function(el) { el.addEventListener('input', function() { w.objetivos[+el.dataset.on].nome = el.value; }); el.addEventListener('change', renderFalas); });
    c.querySelectorAll('[data-oc]').forEach(function(el) { el.addEventListener('input', function() { w.objetivos[+el.dataset.oc].como = el.value; }); });
  }
  function renderCrit() {
    var c = $('pm-crit'); if (!c) return;
    c.innerHTML = [0, 1, 2].map(function(i) { return '<div style="margin-bottom:6px"><input class="pf" data-cr="' + i + '" value="' + psEsc(w.piloto.criterios[i] || '') + '" placeholder="Critério ' + psPad(i + 1) + ' (opcional)"></div>'; }).join('');
    c.querySelectorAll('[data-cr]').forEach(function(el) { el.addEventListener('input', function() { w.piloto.criterios[+el.dataset.cr] = el.value; }); });
  }
  function renderContatos() {
    var c = $('pm-cts'); if (!c) return;
    c.innerHTML = w.contatos.map(function(ct, i) { return '<div class="fala"><div class="g2"><div><label class="l">Nome' + (i === 0 ? ' *' : '') + '</label><input class="pf" data-c="nome" data-i="' + i + '" value="' + psEsc(ct.nome) + '"></div><div><label class="l">Cargo</label><input class="pf" data-c="cargo" data-i="' + i + '" value="' + psEsc(ct.cargo) + '"></div></div><div class="g2" style="margin-bottom:0"><div><label class="l">E-mail</label><input class="pf" data-c="email" data-i="' + i + '" value="' + psEsc(ct.email) + '"></div><div><label class="l">Telefone</label><input class="pf" data-c="tel" data-i="' + i + '" value="' + psEsc(ct.tel) + '"></div></div>' + (i === 1 ? '<button class="btn2" data-cdel style="margin-top:8px">Remover contato 2</button>' : '') + '</div>'; }).join('') + (w.contatos.length < 2 ? '<button class="btn2" id="pm-addct">+ Adicionar 2º contato</button>' : '');
    c.querySelectorAll('[data-c]').forEach(function(el) { el.addEventListener('input', function() { w.contatos[+el.dataset.i][el.dataset.c] = el.value; }); });
    var a = c.querySelector('#pm-addct'); if (a) a.addEventListener('click', function() { w.contatos.push({ nome: '', cargo: '', email: '', tel: '' }); renderContatos(); });
    var d = c.querySelector('[data-cdel]'); if (d) d.addEventListener('click', function() { w.contatos.pop(); renderContatos(); });
  }
  function renderLogo() {
    var c = $('pm-logoprev'); if (!c) return;
    c.innerHTML = w.logo ? '<img src="' + w.logo + '" style="max-height:48px;max-width:200px;background:#fff;padding:4px;border-radius:4px"> <button class="btn2" id="pm-logorm">Remover logo</button>' : '<span class="nota">Sem logo: a capa sai sem logo.</span>';
    var r = c.querySelector('#pm-logorm'); if (r) r.addEventListener('click', function() { w.logo = ''; renderLogo(); });
  }
  function recalcA() {
    var r = psPerdaGanho(w.orcamento, w.nObras), c = $('pm-calc');
    if (c) c.innerHTML = r ? 'Perda por mês por obra: <b style="color:#f87171">' + psMil(r.perda) + '</b> · Ganho por mês por obra: <b style="color:#34d399">' + psMil(r.ganho) + '</b>' + ((w.orcamento !== S.orcamentoMedio || w.nObras !== S.numObras) ? ' <span class="warn">(valores corrigidos nesta ficha; o diagnóstico original não é alterado)</span>' : '') : '';
    var sg = $('pm-sugmens'); if (sg) { var v = precoPorObraPadrao(w.nObras); sg.innerHTML = 'Sugestão pela tabela de faixas (' + w.nObras + ' obra' + (w.nObras === 1 ? '' : 's') + '): <b>' + psMoney(v) + '</b> por obra/mês. <button class="btn2" id="pm-usesug" type="button">Usar sugestão</button>'; sg.querySelector('#pm-usesug').addEventListener('click', function() { w.inv.mensalidade = v; $('pm-mens').value = fmtIn(v); }); }
  }

  body.innerHTML =
    '<div class="h" style="margin-top:0;border:0;padding-top:0">A · Vem do diagnóstico (confira)</div>' +
    '<div class="g3"><div><label class="l">Empresa</label><input class="pf" disabled value="' + psEsc(M0.empresa) + '"></div><div><label class="l">Orçamento médio por obra (R$ mi)</label><input class="pf" id="pm-orc" value="' + fmtIn(w.orcamento / 1e6, w.orcamento % 1e5 ? 2 : 1) + '"></div><div><label class="l">Nº de obras da carteira</label><input class="pf" id="pm-nob" type="number" min="1" step="1" value="' + w.nObras + '"></div></div>' +
    '<div class="nota" id="pm-calc"></div>' +

    '<div class="h">B · Cliente</div>' +
    '<div style="margin-bottom:12px"><label class="l">Logo do cliente (PNG, JPG ou SVG; fundo claro ou transparente)</label><input type="file" id="pm-logo" accept="image/png,image/jpeg,image/svg+xml" class="pf"><div id="pm-logoprev" style="margin-top:6px"></div></div>' +
    '<div style="margin-bottom:12px"><label class="l">Como chamar o cliente no texto (nome curto; a capa e o cabeçalho usam o nome completo)</label><input class="pf" id="pm-nc" value="' + psEsc(w.nomeCurto) + '"><div class="nota">Ex.: Piemonte. Sem artigo o texto usa "de Piemonte", "por Piemonte"; digite "a Piemonte" para usar "da", "pela", "para a".</div></div>' +
    '<div class="g2"><div><label class="l">Decisor/patrocinador: nome</label><input class="pf" id="pm-decn" value="' + psEsc(w.decisor.nome) + '"></div><div><label class="l">Cargo</label><input class="pf" id="pm-decc" value="' + psEsc(w.decisor.cargo) + '"></div></div>' +
    '<div class="g3"><div><label class="l">Data da reunião de apresentação</label><input class="pf" id="pm-rd" type="date" value="' + (w.reuniao.data || '') + '"></div><div><label class="l">Hora</label><input class="pf" id="pm-rh" type="time" value="' + (w.reuniao.hora || '') + '"></div><div><label class="l">Quem define a obra-piloto</label><input class="pf" id="pm-quem" value="' + psEsc(w.piloto.quem) + '"></div></div>' +
    '<label class="l">Objetivos do projeto (a biblioteca sugere pelos gaps e preenche o ponto de partida; nome e texto são livres)</label><div id="pm-obj"></div>' +
    '<label class="l">Critérios de escolha da obra-piloto</label><div id="pm-crit"></div>' +
    '<div style="display:flex;align-items:center;gap:10px;margin:12px 0 6px"><b style="color:#f8fafc">Falas do cliente</b><span class="nota" id="pm-nfalas"></span><button class="btn2" id="pm-addfala" style="margin-left:auto">+ Adicionar fala</button></div><div id="pm-falas"></div>' +

    '<div class="h">C · Escopo</div>' +
    '<div class="g3"><div><label class="l">Fase 0 · duração (dias)</label><input class="pf" id="pm-f0" type="number" min="1" value="' + w.escopo.fase0Dias + '"></div><div><label class="l">Participantes do workshop (máx.)</label><input class="pf" id="pm-part" type="number" min="1" value="' + w.escopo.participantes + '"></div><div><label class="l">Visitas presenciais (1 a 3)</label><input class="pf" id="pm-vis" type="number" min="1" max="3" value="' + w.escopo.visitas + '"></div></div>' +
    '<label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;cursor:pointer"><input type="checkbox" id="pm-f5"' + (w.escopo.fase5 ? ' checked' : '') + '> Incluir Fase 5 · Ativação nas demais obras (opcional)</label>' +
    '<div class="g2"><div><label class="l">Fase 5 · nº de obras</label><input class="pf" id="pm-f5o" type="number" min="1" value="' + w.escopo.fase5Obras + '"></div><div><label class="l">Fase 5 · prazo (dias)</label><input class="pf" id="pm-f5d" type="number" min="1" value="' + w.escopo.fase5Dias + '"></div></div>' +

    '<div class="h">D · Investimento</div>' +
    '<div class="g2"><div><label class="l">Redesenho · valor total (R$) *</label><input class="pf" id="pm-red" value="' + fmtIn(w.inv.redesenho) + '"></div><div><label class="l">Redesenho · nº de parcelas</label><input class="pf" id="pm-redp" type="number" min="1" value="' + w.inv.redesParcelas + '"></div></div>' +
    '<div style="margin-bottom:12px"><label class="l">Mensalidade Agilean por obra, por mês (R$) *</label><input class="pf" id="pm-mens" value="' + fmtIn(w.inv.mensalidade) + '"><div class="nota" id="pm-sugmens"></div></div>' +
    '<div class="g2"><div><label class="l">Ativação (Fase 5) · valor por obra (R$)</label><input class="pf" id="pm-ativ" value="' + fmtIn(w.inv.ativPorObra) + '"></div><div><label class="l">Ativação · nº de parcelas (1 por obra entregue)</label><input class="pf" id="pm-ativp" type="number" min="1" placeholder="= nº de obras" value="' + (w.inv.ativParcelas || '') + '"></div></div>' +
    '<div style="max-width:240px"><label class="l">Validade da proposta *</label><input class="pf" id="pm-val" type="date" value="' + (w.inv.validade || '') + '"></div>' +
    '<div class="nota">Regras fixas no documento: obra-piloto sem mensalidade durante o escopo, 30 dias de carência e cobrança a partir do 2º mês após o escopo; demais obras com 30 dias de carência; deslocamento e hospedagem por conta do cliente.</div>' +

    '<div class="h">E · Contatos comerciais (1 ou 2) *</div><div id="pm-cts"></div>' +

    '<div class="h">F · Transcrição da reunião do diagnóstico</div>' +
    '<div class="nota" style="margin:-4px 0 8px">Opcional. Anexe .txt ou .vtt, ou cole o texto. Fica salva junto com o diagnóstico. Nada é enviado para fora: a extração roda neste navegador, e cada fala é conferida contra a transcrição.</div>' +
    '<div class="g2"><div><input type="file" id="pm-tf" accept=".txt,.vtt,.srt,text/plain,text/vtt" class="pf"></div><div class="nota" id="pm-tinfo"></div></div>' +
    '<textarea class="pf" id="pm-tt" rows="5" placeholder="Ou cole aqui o texto da transcrição">' + psEsc(w.transcricao.texto) + '</textarea>' +
    '<div style="margin-top:12px;font-weight:700;color:#f8fafc">Caminho 1 · Falas do decisor, extraídas aqui (sem IA)</div>' +
    '<div style="margin-top:6px"><button class="btn2" id="pm-analisar" style="border-color:#ea580c;color:#fb923c">Analisar transcrição</button> <button class="btn2" id="pm-diag-btn">Mostrar falas do diagnóstico</button> <span class="nota" id="pm-locstat"></span></div>' +
    '<input class="pf" id="pm-busca" style="margin-top:8px" placeholder="Buscar palavra nas candidatas (sem acento, sem diferenciar maiúsculas)"><div id="pm-local"></div><div id="pm-diag"></div>' +
    '<div style="margin-top:14px;font-weight:700;color:#f8fafc">Caminho 2 · Usar o Claude (opcional)</div>' +
    '<div class="nota">Copie a instrução, cole no Claude junto com a transcrição e cole a resposta aqui. As falas sugeridas passam pela mesma conferência.</div>' +
    '<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn2" id="pm-copiar">Copiar instrução para o Claude</button><button class="btn2" id="pm-colar">Colar sugestões</button> <span class="nota" id="pm-sugstat"></span></div>' +
    '<div id="pm-colarbox" style="display:none;margin-top:8px"><textarea class="pf" id="pm-colar-txt" rows="6" placeholder="Cole aqui a resposta do Claude (o JSON)"></textarea><button class="btn2" id="pm-colar-ok" style="margin-top:6px">Aplicar sugestões</button></div>' +
    '<div id="pm-promptbox" style="display:none;margin-top:8px"><div class="nota">Não foi possível copiar automaticamente. Selecione tudo (Ctrl+A) e copie (Ctrl+C):</div><textarea class="pf" id="pm-prompt-txt" rows="6" readonly></textarea></div><div id="pm-sug"></div>';

  var num = function(id) { return parseInt($(id).value, 10); };
  function tinfo() { var t = (w.transcricao.texto || '').trim(); $('pm-tinfo').textContent = t ? (w.transcricao.nome ? w.transcricao.nome + ' · ' : '') + t.length.toLocaleString('pt-BR') + ' caracteres salvos' : 'Sem transcrição'; }
  renderObj(); renderCrit(); renderFalas(); renderContatos(); renderLogo(); recalcA(); tinfo();
  $('pm-orc').addEventListener('input', function() { var v = psParseMoney(this.value); if (v > 0) { w.orcamento = v * 1e6; recalcA(); } });
  $('pm-nob').addEventListener('input', function() { var v = parseInt(this.value, 10); if (v > 0) { w.nObras = v; recalcA(); } });
  $('pm-logo').addEventListener('change', function() {
    var file = this.files && this.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function() { psPreparaLogo(rd.result).then(function(u) { w.logo = u; renderLogo(); }).catch(function() { alert('Não foi possível ler a imagem da logo.'); }); };
    rd.readAsDataURL(file);
  });
  $('pm-decn').addEventListener('input', function() { w.decisor.nome = this.value; });
  $('pm-decc').addEventListener('input', function() { w.decisor.cargo = this.value; });
  $('pm-rd').addEventListener('input', function() { w.reuniao.data = this.value; });
  $('pm-rh').addEventListener('input', function() { w.reuniao.hora = this.value; });
  $('pm-quem').addEventListener('input', function() { w.piloto.quem = this.value; });
  $('pm-nc').addEventListener('input', function() {
    var antes = psNomeCurtoFmt(w.nomeCurto), novo = this.value, dep = psNomeCurtoFmt(novo);
    w.objetivos.forEach(function(o) { var b = psObjBiblioteca(o.id); if (b && o.como === b.como.replace('{COM}', antes.com)) o.como = b.como.replace('{COM}', dep.com); }); // so troca o que o vendedor nao editou
    if (w.piloto.quem === antes.a) { w.piloto.quem = dep.a; $('pm-quem').value = dep.a; }
    w.nomeCurto = novo;
    renderObj();
  });
  $('pm-addfala').addEventListener('click', function() { if (w.falas.length < PS_MAX_FALAS) { w.falas.push({ texto: '', alvo: '', origem: 'manual', verif: 'manual', confirmada: true }); renderFalas(); } });
  [['pm-f0', 'fase0Dias'], ['pm-part', 'participantes'], ['pm-vis', 'visitas'], ['pm-f5o', 'fase5Obras'], ['pm-f5d', 'fase5Dias']].forEach(function(p) { $(p[0]).addEventListener('input', function() { var v = parseInt(this.value, 10); w.escopo[p[1]] = v > 0 ? v : 0; }); });
  $('pm-f5').addEventListener('change', function() { w.escopo.fase5 = this.checked; });
  [['pm-red', 'redesenho'], ['pm-mens', 'mensalidade'], ['pm-ativ', 'ativPorObra']].forEach(function(p) { $(p[0]).addEventListener('input', function() { var v = psParseMoney(this.value); w.inv[p[1]] = isNaN(v) ? '' : v; }); });
  $('pm-redp').addEventListener('input', function() { var v = parseInt(this.value, 10); w.inv.redesParcelas = v > 0 ? v : 0; });
  $('pm-ativp').addEventListener('input', function() { var v = parseInt(this.value, 10); w.inv.ativParcelas = v > 0 ? v : ''; });
  $('pm-val').addEventListener('input', function() { w.inv.validade = this.value; });
  $('pm-tt').addEventListener('input', function() { w.transcricao.texto = this.value; tinfo(); });
  $('pm-tt').addEventListener('change', renderFalas);
  $('pm-tf').addEventListener('change', function() {
    var file = this.files && this.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function() { w.transcricao = { nome: file.name, texto: String(rd.result) }; $('pm-tt').value = w.transcricao.texto; tinfo(); renderFalas(); };
    rd.readAsText(file);
  });
  // ── Caminho 1: extracao local das falas do decisor (transcricao) e do diagnostico ──
  var loc = { falantes: [], sel: -1, cands: [], mostrar: 15, usadas: {}, formato: '' };
  var diag = { aberto: false, usadas: {}, lista: null };
  var busca = '';
  var linhaCand = function(x, ci, usada, pre, rotulo, extraBtn) {
    var padrao = x.ponto && x.ponto.code ? 'falha:' + x.ponto.code : '';
    return '<div class="fala" style="' + (usada ? 'opacity:.5' : '') + '"><div class="nota">' + rotulo + '</div>' +
      '<textarea class="pf" rows="2" data-' + pre + 't="' + ci + '"' + (usada ? ' disabled' : '') + '>' + psEsc(x.texto) + '</textarea>' +
      '<div class="nota" data-' + pre + 'v="' + ci + '"></div>' +
      '<div style="display:flex;gap:8px;margin-top:6px;align-items:center"><select class="pf" style="flex:1" data-' + pre + 'a="' + ci + '">' + optsAlvo(padrao) + '</select>' + (extraBtn || '') +
      '<button class="btn2" data-' + pre + 'u="' + ci + '"' + (usada ? ' disabled' : '') + '>' + (usada ? 'Usada' : 'Usar fala') + '</button></div></div>';
  };
  // liga validacao (recorte so pode encurtar) e "Usar fala" de uma lista de candidatas; origem = 'manual' (transcricao) ou 'diagnostico'
  var ligaLinhas = function(c, pre, getOrig, origem, usadasObj, getKey, rerender) {
    var valida = function(ci) {
      var ta = c.querySelector('[data-' + pre + 't="' + ci + '"]'), v = c.querySelector('[data-' + pre + 'v="' + ci + '"]'), ok = psRecorteValido(ta.value, getOrig(ci));
      v.innerHTML = ok ? '<span class="ok">recorte contido no original</span>' : '<span class="bad">o recorte não está no original: só é permitido encurtar (use (...) para pular um trecho)</span>';
      return ok;
    };
    c.querySelectorAll('[data-' + pre + 't]').forEach(function(el) { valida(+el.getAttribute('data-' + pre + 't')); el.addEventListener('input', function() { valida(+el.getAttribute('data-' + pre + 't')); }); });
    c.querySelectorAll('[data-' + pre + 'u]').forEach(function(el) { el.addEventListener('click', function() {
      var ci = +el.getAttribute('data-' + pre + 'u'), ta = c.querySelector('[data-' + pre + 't="' + ci + '"]');
      if (!valida(ci)) return;
      if (w.falas.length >= PS_MAX_FALAS) { alert('Limite de ' + PS_MAX_FALAS + ' falas. Apague uma antes de usar outra.'); return; }
      var alvo = c.querySelector('[data-' + pre + 'a="' + ci + '"]').value;
      var f = { texto: ta.value.trim(), alvo: alvo, origem: origem, verif: 'manual', confirmada: true };
      if (origem === 'diagnostico') f.verif = psFalaConfere(f.texto, diagTxt) ? 'ok' : 'nao_encontrada';
      w.falas.push(f); usadasObj[getKey(ci)] = 1; rerender(); renderFalas();
    }); });
  };
  function renderLocal() {
    var c = $('pm-local'); if (!c) return;
    if (!loc.falantes.length) { c.innerHTML = ''; return; }
    var h = '<div class="fala"><label class="l">Falantes detectados (formato: ' + psEsc(loc.formato) + '). Escolha o decisor:</label><div style="display:flex;gap:8px;align-items:center"><select class="pf" id="pm-spk" style="flex:1">' +
      loc.falantes.map(function(f, i) { return '<option value="' + i + '"' + (i === loc.sel ? ' selected' : '') + '>' + psEsc(f.nome) + ' · ' + f.nTurnos + ' falas · ' + f.palavras + ' palavras</option>'; }).join('') +
      '</select><button class="btn2" id="pm-spk-dec">Usar como decisor</button></div>' +
      (loc.sel >= 0 && psSugereFalante(loc.falantes, w.decisor.nome) === loc.sel ? '<div class="nota ok">Sugerido: bate com o decisor da ficha.</div>' : '<div class="nota">Confira se é mesmo o decisor.</div>') + '</div>';
    var vis = [];
    if (loc.sel >= 0) {
      var filtradas = psFiltraCandidatas(loc.cands, busca), lim = busca ? Math.max(loc.mostrar, 30) : loc.mostrar;
      vis = filtradas.slice(0, lim);
      h += '<div class="nota" style="margin:6px 0">' + (busca ? filtradas.length + ' de ' + loc.cands.length + ' candidatas contêm "' + psEsc(busca) + '"' : loc.cands.length + ' frases candidatas (≥ 6 palavras, sem repetidas), da mais para a menos ligada ao diagnóstico') + '. Até ' + PS_MAX_FALAS + ' falas (' + w.falas.length + ' na ficha). Edite o recorte só para encurtar; use "Unir com a frase seguinte" quando a fala atravessa duas frases.</div>';
      h += vis.map(function(x) {
        var ci = loc.cands.indexOf(x), usada = !!loc.usadas[x.idx];
        var rot = x.ponto ? ('ponto ' + x.ponto.n + ' · ' + psEsc(x.ponto.falha) + (x.pilar ? ' · Pilar ' + x.pilar : '')) : (x.pilar ? 'Pilar ' + x.pilar : 'sem ligação clara');
        var un = '<button class="btn2" data-lj="' + ci + '"' + ((usada || !psTemProxima(x, loc.cands.todas)) ? ' disabled' : '') + '>Unir com a frase seguinte</button>';
        return linhaCand(x, ci, usada, 'l', '#' + x.rank + ' · pontuação ' + x.score + ' · provável: ' + rot + (x.unidas ? ' · ' + (x.unidas + 1) + ' frases unidas' : ''), un);
      }).join('');
      if (filtradas.length > vis.length) h += '<button class="btn2" id="pm-mais">Mostrar mais 15 (' + (filtradas.length - vis.length) + ' restantes)</button>';
    }
    c.innerHTML = h;
    var sel = c.querySelector('#pm-spk');
    if (sel) sel.addEventListener('change', function() { loc.sel = +sel.value; loc.cands = psCandidatas(loc.falantes[loc.sel], psModel({ orcamento: w.orcamento, nObras: w.nObras })); loc.mostrar = 15; loc.usadas = {}; renderLocal(); });
    var bd = c.querySelector('#pm-spk-dec'); if (bd) bd.addEventListener('click', function() { if (loc.sel < 0) return; w.decisor.nome = loc.falantes[loc.sel].nome; $('pm-decn').value = w.decisor.nome; renderLocal(); });
    var mais = c.querySelector('#pm-mais'); if (mais) mais.addEventListener('click', function() { loc.mostrar += 15; renderLocal(); });
    c.querySelectorAll('[data-lj]').forEach(function(el) { el.addEventListener('click', function() { var x = loc.cands[+el.getAttribute('data-lj')]; psUneProxima(x, loc.cands.todas, loc.cands.dic); renderLocal(); }); });
    ligaLinhas(c, 'l', function(ci) { return loc.cands[ci].texto; }, 'manual', loc.usadas, function(ci) { return loc.cands[ci].idx; }, renderLocal);
  }
  function renderDiag() {
    var c = $('pm-diag'); if (!c) return;
    if (!diag.aberto) { c.innerHTML = ''; return; }
    var lista = diagFontes.filter(function(f) { return !busca || (' ' + psNorm(f.texto) + ' ').indexOf(psNorm(busca)) >= 0; });
    var h = '<div class="nota" style="margin:6px 0">' + diagFontes.length + ' textos do diagnóstico (comentários do vendedor e respostas registradas)' + (busca ? '; ' + lista.length + ' contêm "' + psEsc(busca) + '"' : '') + '. Cada fala é conferida contra o próprio diagnóstico, não contra a transcrição.</div>';
    h += lista.map(function(x) {
      var ci = diagFontes.indexOf(x), usada = !!diag.usadas[ci];
      return linhaCand(x, ci, usada, 'd', '<span style="color:#fbbf24">diagnóstico</span> · ' + psEsc(x.tipo) + (x.ponto && x.ponto.falha ? ' · ponto ' + (x.ponto.n || '-') + ' · ' + psEsc(x.ponto.falha) : ''), '');
    }).join('') || '<div class="nota">Nenhum texto encontrado.</div>';
    c.innerHTML = h;
    ligaLinhas(c, 'd', function(ci) { return diagFontes[ci].texto; }, 'diagnostico', diag.usadas, function(ci) { return ci; }, renderDiag);
  }
  $('pm-analisar').addEventListener('click', function() {
    var st = $('pm-locstat'), tx = (w.transcricao.texto || '').trim();
    if (!tx) { st.innerHTML = '<span class="bad">Anexe ou cole a transcrição primeiro.</span>'; return; }
    var r = psParseFalantes(w.transcricao.texto);
    loc.falantes = r.falantes; loc.formato = r.formato; loc.usadas = {};
    loc.sel = psSugereFalante(r.falantes, w.decisor.nome);
    loc.mostrar = 15;
    st.innerHTML = r.falantes.length + ' falante(s) detectado(s)' + (loc.sel < 0 ? '. Escolha o decisor na lista.' : '.');
    if (loc.sel < 0 && r.falantes.length) { loc.sel = 0; st.innerHTML += ' <span class="warn">Nenhum falante bate com o nome do decisor da ficha; mostrando o que mais falou.</span>'; }
    loc.cands = loc.sel >= 0 ? psCandidatas(r.falantes[loc.sel], psModel({ orcamento: w.orcamento, nObras: w.nObras })) : [];
    renderLocal();
  });
  $('pm-busca').addEventListener('input', function() { busca = this.value; renderLocal(); renderDiag(); });
  $('pm-diag-btn').addEventListener('click', function() { diag.aberto = !diag.aberto; this.textContent = diag.aberto ? 'Ocultar falas do diagnóstico' : 'Mostrar falas do diagnóstico'; renderDiag(); });
  // ── Caminho 2: instrucao para o Claude + colar a resposta ──
  $('pm-copiar').addEventListener('click', function() {
    var st = $('pm-sugstat'), t = psPromptCopiavel(psModel({ orcamento: w.orcamento, nObras: w.nObras }), w);
    window.__PS_ULTIMO_PROMPT = t;
    var falha = function() { $('pm-promptbox').style.display = 'block'; var a = $('pm-prompt-txt'); a.value = t; a.focus(); a.select(); st.innerHTML = '<span class="warn">Copie manualmente.</span>'; };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function() { $('pm-promptbox').style.display = 'none'; st.innerHTML = '<span class="ok">Instrução copiada. Cole no Claude e, logo abaixo, a transcrição.</span>'; }, falha); else falha(); } catch (e) { falha(); }
  });
  $('pm-colar').addEventListener('click', function() { var b = $('pm-colarbox'); b.style.display = b.style.display === 'none' ? 'block' : 'none'; });
  $('pm-colar-ok').addEventListener('click', function() {
    var st = $('pm-sugstat'), txt = $('pm-colar-txt').value; temp.sugErr = ''; sug = null;
    try {
      if (!txt.trim()) throw new Error('a caixa está vazia.');
      var r = psExtraiJson(txt);
      if (!r || typeof r !== 'object' || !(r.falas || r.objetivos || r.decisor || r.criterios)) throw new Error('o JSON não tem os campos esperados (decisor, falas, objetivos, criterios).');
      sug = psSugestoesDaResposta(r, w.transcricao.texto, psModel({ orcamento: w.orcamento, nObras: w.nObras }));
      st.innerHTML = (w.transcricao.texto || '').trim() ? '<span class="ok">Sugestões lidas. Confira abaixo; nada entra sem você aceitar.</span>' : '<span class="warn">Sem transcrição anexada: nenhuma fala pode ser conferida e todas ficam "não encontrada".</span>';
    } catch (e) { st.innerHTML = ''; temp.sugErr = 'Não foi possível ler o texto colado: ' + (e.message || e) + ' Cole a resposta inteira do Claude (o JSON) ou preencha à mão.'; }
    renderSug();
  });
  $('pm-sugmens') && recalcA();

  function close() { ov.remove(); }
  ov.querySelector('#pm-close').addEventListener('click', close);
  ov.querySelector('#pm-cancel').addEventListener('click', close);
  ov.querySelector('#pm-gen').addEventListener('click', function() {
    w.escopo.fase5Obras = w.escopo.fase5Obras || 0;
    var erros = psValida(w);
    var el = ov.querySelector('#pm-err');
    if (erros.length) { el.innerHTML = erros.map(psEsc).join('<br>'); return; }
    el.innerHTML = '';
    var ficha = JSON.parse(JSON.stringify(w));
    ficha.contatos = ficha.contatos.filter(function(c) { return c.nome && c.nome.trim(); });
    ficha.v = 2;
    S.proposta = ficha;                       // em memoria; sobe no proximo salvamento da ferramenta
    try { localStorage.setItem('siiga_prop_contatos', JSON.stringify(ficha.contatos)); } catch (e) {}
    try { saveDraft(); } catch (e) {}         // caminho de salvamento ja existente (rascunho + sincronizacao do assessment)
    close();
    generatePropostaSiiga({ ficha: ficha });
  });
}
