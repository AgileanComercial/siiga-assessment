// SIIGA Proposta (Reunião 2) em PDF na identidade "Prancha técnica", a mesma do relatório (relatorio-prancha.js/.css).
// Reaproveita o modelo (ptModel), os helpers (ptSec, ptSt, ptMil...) e o paginador do relatório (ptPaginate): sempre tema claro,
// mesma grade, cabeçalho de seção, tabelas, carimbo e folga de 10 mm até o carimbo. O CONTEÚDO (textos e números) é o da proposta
// alinhada ao relatório (buildProposta*, script.js); aqui só muda a forma. Entrada: generatePropostaPrancha().

var PTP_VERSAO = '1.0';

// ── Modelo ──────────────────────────────────────────────────────────────
function ptpModel() {
  var M = ptModel('resumido');
  var cfg = getPropostaCfg();
  M.cfg = cfg;
  M.docRun = 'Proposta SIIGA';
  M.versao = PTP_VERSAO;
  M.dataEmissao = new Date().toLocaleDateString('pt-BR');
  M.data = M.dataEmissao;                 // o carimbo traz a data de emissão da proposta
  M.soAtiv = !!cfg.progNA;                // Redesenho "não se aplica": escopo só de Ativação SIIGA
  return M;
}
function ptpMoney(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: (v % 1 ? 2 : 0), maximumFractionDigits: 2 }); }
function ptpEmp(M) { return ptEsc(M.empresa || 'sua empresa'); }

// bloco "rótulo na coluna da esquerda + conteúdo na da direita" (mesma grade do relatório)
function ptpRow(label, body, extra) {
  return '<div class="row sec"' + (extra ? ' style="' + extra + '"' : '') + '><div><div class="lbl rule">' + label + '</div></div><div>' + body + '</div></div>';
}
// render de bloco de linhas (`.pc.row`) para o paginador: o título e as 2 primeiras linhas ficam juntos; o resto continua na folha seguinte
function ptpRender(rows) { return '<div class="progr">' + rows.join('') + '</div>'; }
// colunas de cartões (fio de tinta em cima, sem sombra nem cantos): a mesma estrutura da versão escura, no tema claro
function ptpCols(n, cards, extra) {
  return '<div class="cols c' + n + '" style="margin-top:' + (extra || '4mm') + '">' + cards.join('') + '</div>';
}
function ptpCol(k, t, d, extra) {
  return '<div class="col">' + (k ? '<div class="k">' + k + '</div>' : '') + (t ? '<div class="t">' + t + '</div>' : '') + (d ? '<div class="d">' + d + '</div>' : '') + (extra || '') + '</div>';
}
function ptpGrupo(label, html) { return '<div class="grp"><div class="lbl rule" style="margin-top:6mm">' + label + '</div>' + html + '</div>'; }
function ptpHead(num, titulo) { return ptSec(num, titulo, false); }
function ptpTabela(cols, rows, cls) {
  return '<table' + (cls ? ' class="' + cls + '"' : '') + '><thead><tr>' + cols.map(function(c){ return '<th' + (c.n ? ' class="n"' : '') + (c.w ? ' style="width:' + c.w + '"' : '') + '>' + c.t + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function(r){ return '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + r.c.map(function(x, i){ return '<td' + (cols[i] && cols[i].n ? ' class="n"' : '') + '>' + x + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
}

// ── 01 · Recapitulação ───────────────────────────────────────────────────
function ptpRecap(M, num) {
  var nC = M.criticos.length, perdaMes = M.roi.totalBase / M.prazo;
  var bars = M.pilares.map(function(p) {
    var w = p === M.worst, pct = Math.round(p.pct * 100);
    return '<div class="bar"><div class="nm"><span class="pn' + (w ? ' b6' : '') + '">Pilar ' + p.n + ' · ' + p.nome + '</span><span class="ps">' + ptNum(p.pts, 0, 1) + ' / ' + p.max + '</span></div>' +
      '<div class="trk"><div class="fill" style="width:' + Math.min(100, pct) + '%"></div><div class="mkt" style="left:' + Math.round(p.mkt * 100) + '%"></div></div>' +
      '<div class="val">' + (w ? '<b class="b6">' + pct + '%</b>' : pct + '%') + '</div>' +
      '<div class="stt">' + ptSt(ptStCls(p.pct), ptStWord(p.pct)) + '</div></div>';
  }).join('');
  var strip = '<div class="strip">' +
    '<div><div class="lbl">SIIGA Score</div><div class="big">' + ptNum(M.score.score, 0, 1) + '<small style="font-size:var(--t-lead);color:var(--texto2);font-weight:400">/' + M.score.max + '</small></div><div class="note">Nível ' + ptEsc(ptNivel(M.score.nivel)) + ' — ' + Math.round(M.score.pct * 100) + '% da maturidade de referência.</div></div>' +
    '<div><div class="lbl">Perda por mês</div><div class="big p">' + ptMil(perdaMes, 1) + '</div><div class="note">' + (M.obras > 1 ? 'por obra · ' + ptMil(perdaMes * M.obras, 1) + ' no portfólio de ' + M.obras + ' obras, sem intervenção.' : 'na obra, sem intervenção.') + '</div></div>' +
    '<div><div class="lbl">Recuperável com o plano</div><div class="big g">' + ptMil(M.critCapMes, 1) + '/mês</div><div class="note">' + (nC === 1 ? 'na prioridade' : 'nas ' + (PT_NUM_EXT_F[nC] || nC) + ' prioridades') + ' do diagnóstico, ' + ptPorObra(M) + '.</div></div></div>';
  var b1 = ptpHead(num, 'Recapitulação executiva do diagnóstico SIIGA da ' + ptpEmp(M)) +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Os três números</div></div><div>' +
      '<p class="lead">Os três números que fecharam a 1ª reunião — a régua contra a qual mediremos o programa.</p><div style="margin-top:4mm">' + strip + '</div></div></div>';
  var b2 = ptpRow('Maturidade por pilar', '<div class="bars">' + bars + '</div>' +
      '<div class="axis"><div></div><div class="ticks"><span style="left:0">0</span><span style="left:25%">25</span><span style="left:50%">50</span><span style="left:75%">75</span><span style="left:100%">100%</span></div><div></div><div></div></div>' +
      '<div class="leg"><span><i class="sw-cli"></i>' + ptEsc(M.empresa) + '</span><span><i class="sw-mkt"></i>Benchmark de mercado</span><span><i class="sw-ref"></i>Referência SIIGA (100%)</span></div>');
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }];
}

// ── 02 · Principais pontos críticos ──────────────────────────────────────
function ptpPontos(M, num) {
  var nObras = M.cfg.nObras, perdaBruta = Math.round(M.roi.totalBase * nObras);
  var rows = M.criticos.map(function(c) {
    return '<tr><td>' + c.n + '</td><td><span class="st ' + (c.alerta ? 'a' : 'c') + '" style="margin-right:1.6mm;vertical-align:baseline"><i></i></span><span class="b6">' + ptEsc(c.titulo) + '</span>' + (c.frase ? '<span class="q">“' + ptEsc(c.frase.replace(/.$/, '')) + '.”</span>' : '') + '</td>' +
      '<td>' + c.pilar + ' · ' + ptEsc(c.fonte.label) + '</td>' +
      '<td class="n">' + (c.mes != null ? '<span class="perda">' + ptMil(c.mes, 1) + '</span>' : '—') + '</td>' +
      '<td class="n">' + (c.mes != null ? '<span class="ganho">' + ptMil(c.fonte.cap / M.prazo, 1) + '</span>' : '—') + '</td></tr>';
  }).join('');
  var nCr = M.criticos.length;
  rows += '<tr class="tot"><td></td><td>Total ' + (nCr === 1 ? 'da prioridade' : 'das ' + nCr + ' prioridades') + '</td><td></td><td class="n"><span class="perda">' + ptMil(M.critMes, 1) + '</span></td><td class="n"><span class="ganho">' + ptMil(M.critCapMes, 1) + '</span></td></tr>';
  var demais = M.demais.length;
  var tab = '<table><thead><tr><th style="width:5mm">#</th><th>Prioridade</th><th style="width:30mm">Pilar · fonte de perda</th><th class="n wrap" style="width:26mm">Perda por mês sem tratamento</th><th class="n wrap" style="width:17mm">Ganho por mês</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    (demais ? '<div class="note" style="margin-top:0.5mm">Demais pontos críticos do diagnóstico: <b>' + demais + '</b>, tratados na sequência das Fases de Implementação.</div>' : '');
  var b1 = ptpHead(num, 'Principais pontos críticos do diagnóstico') +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Prioridades</div></div><div>' +
      '<p class="lead">A operação da ' + ptpEmp(M) + ' escala mais rápido que os controles. As prioridades abaixo são as mesmas do relatório que revisamos na 1ª reunião, e cada uma tem um custo que hoje passa despercebido.</p>' +
      '<div style="margin-top:2mm">' + tab + '</div></div></div>';
  var b2 = ptpRow('Composição', ptChartPerdaGanho(M, '0'));
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }];
}

// ── 03 · Objetivo ────────────────────────────────────────────────────────
function ptpObjetivo(M, num) {
  var emp = ptpEmp(M), meses = M.cfg.progMeses, D = propMetasD(M), metaScore = D.score, nC = M.criticos.length;
  var bars = M.pilares.map(function(p) {
    var cur = p.pct, meta = D.pilares[p.n].pct;
    return '<div class="bar"><div class="nm"><span class="pn">Pilar ' + p.n + ' · ' + p.nome + '</span></div>' +
      '<div class="trk"><div class="fill" style="width:' + Math.round(cur * 100) + '%"></div><div class="tb b" style="left:' + Math.round(cur * 100) + '%;width:' + Math.max(2, Math.round((meta - cur) * 100)) + '%"></div></div>' +
      '<div class="val" style="grid-column:3 / span 2;text-align:right">' + Math.round(cur * 100) + '% → <b class="b6">' + Math.round(meta * 100) + '%</b></div></div>';
  }).join('');
  var metaPct = Math.round(D.pct * 100);
  var porMO = porModeloMO('dias de fechamento da medição', 'dias de fechamento da folha', 'dias de fechamento da medição e da folha');
  var b1 = ptpHead(num, 'Objetivo do Redesenho SIIGA') +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Meta central</div><div class="lbl" style="margin-top:2mm">SIIGA Score</div>' +
      '<div class="score" style="font-size:21pt;line-height:25pt;white-space:nowrap">' + ptNum(M.score.score, 0, 1) + ' <span style="color:var(--marca-txt)">→ ' + ptNum(metaScore, 0, 1) + '</span><small>/' + M.score.max + '</small></div></div><div>' +
      '<p class="lead">Consultoria de resultado se compromete com número. O objetivo central é tirar a ' + emp + ' do nível <b>' + ptEsc(ptNivel(M.score.nivel)) + '</b> e levá-la de <b>' + Math.round(M.score.pct * 100) + '% para ' + metaPct + '% da Referência SIIGA</b> em ' + meses + ' meses, implantando todos os pontos do plano e consolidando ' + (nC === 1 ? 'a prioridade' : 'as ' + (PT_NUM_EXT_F[nC] || nC) + ' prioridades') + '.</p></div></div>';
  var b2 = ptpRow('Meta por pilar', '<div class="bars">' + bars + '</div>' +
      '<div class="leg"><span><i class="sw-cli"></i>Hoje</span><span><i class="tb b" style="position:relative;display:inline-block;width:5mm;height:2.4mm;margin-right:1.2mm;vertical-align:middle"></i>Meta do programa</span></div>' +
      '<div class="nt">As metas de maturidade acima saem direto do diagnóstico. As metas <b>operacionais e financeiras</b> — aderência plano × realizado, ' + porMO + ', % de retrabalho — são pactuadas sobre a baseline real medida na Fase de Implementação I, nunca estimadas antes.</div>');
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }];
}

// ── 04 · Programa ────────────────────────────────────────────────────────
function ptpPrograma(M, num) {
  var fases = ptFases(S.modeloMO || '');
  var prios = function(id) {
    var ns = M.criticos.filter(function(p){ return p.fase === id; }).map(function(p){ return p.n; });
    return ns.length ? ptPrioLista(ns) : '';
  };
  var etapas = [{ rot: 'Ponto de partida', tit: 'Kick-off · Lean Experience', desc: 'Workshop presencial de nivelamento Lean, até 25 pessoas.', badge: 'Cortesia · inclusa', lig: '' }]
    .concat(fases.map(function(f){ return { rot: 'Fase de Implementação ' + f.id, tit: f.nome, desc: f.fd, badge: '', lig: prios(f.id) }; }));
  var cards = etapas.map(function(e) {
    return ptpCol(e.rot, ptEsc(e.tit), ptEsc(e.desc), (e.badge ? '<div class="note" style="margin-top:1.6mm">' + e.badge + '</div>' : '') + (e.lig ? '<div class="note" style="margin-top:1.6mm"><b class="b6">' + e.lig + '</b></div>' : ''));
  });
  var tl = '<div class="tl" style="grid-template-columns:30mm minmax(0,1fr)"><div class="nm">Programa: ' + M.cfg.progMeses + ' meses</div><div class="tp" style="margin-right:0"><div class="tb a" style="left:0;width:75%">Construção · ~75%</div><div class="tb b" style="left:75%;right:0;padding-left:1.2mm;font-size:6.6pt">Validação · ~25%</div></div></div>' +
    '<div class="note" style="display:flex;justify-content:space-between;margin-top:1.6mm"><span>Mês 1 — Kick-off / Lean Experience</span><span>Mês ' + M.cfg.progMeses + ' — Análise e resultados</span></div>';
  var b1 = ptpHead(num, 'O Programa de Redesenho SIIGA') +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Etapas</div></div><div><p class="lead">Do workshop de nivelamento à governança contínua — começa com o time no mesmo idioma (Lean Experience) e avança pelas três Fases de Implementação do relatório, com cada prioridade do diagnóstico ligada à sua Fase e com meta, entregável e responsável definidos em cada etapa.</p></div></div>' +
    ptpCols(4, cards, '5mm');
  var b2 = ptpRow('Duração', tl);
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }];
}

// ── 05 · Resultados esperados por nível ──────────────────────────────────
function ptpResultados(M, num) {
  var emp = ptpEmp(M);
  var niveis = [
    ['Estratégico · Diretoria', 'Previsibilidade e visão de portfólio', ['Previsibilidade de fluxo de caixa das obras', 'Visão físico-financeira em tempo real', 'Gestão integrada do portfólio, não obra a obra']],
    ['Tático · Sala Técnica', 'Mais escala, menos redigitação', ['Fim da redigitação entre planejamento e ERP', 'Análise proativa de desvios, não reativa', 'Uma sala técnica que cobre mais obras']],
    ['Operacional · Engenharia de Campo', 'Plano que chega ao canteiro', ['Aderência entre o plano e o que a obra executa', 'Equipes, medições e MO puxadas do planejamento', porModeloMO('Medição de empreiteiros fechada no sistema', 'Folha de produção fechada no sistema', 'Folha de produção fechada no sistema')]]
  ];
  var cards = niveis.map(function(n, i) {
    return '<div class="pc row" style="' + (i === 0 ? 'margin-top:4mm;' : '') + 'margin-bottom:0;padding-bottom:2.4mm"><div><div class="lbl" style="color:var(--marca-txt)">' + n[0] + '</div></div>' +
      '<div><div class="tt" style="margin-bottom:1mm">' + n[1] + '</div><ul class="bl">' + n[2].map(function(b){ return '<li>' + b + '</li>'; }).join('') + '</ul></div></div>';
  });
  var f = S.ferramentas || {}, ERP_LABELS = { sienge: 'Sienge', totvs: 'TOTVS', informakon: 'Informakon', mega: 'Senior Mega', uau: 'UAU' };
  var erpVal = f.erp || '', erpLabel = ERP_LABELS[erpVal], erpMsg;
  if (erpLabel) erpMsg = 'A plataforma Agilean conecta-se <b>nativamente ao ' + erpLabel + '</b> da ' + emp + ' — sem redigitação entre os sistemas. O SIIGA entra integrado ao ERP, não como mais uma ilha de dados.';
  else if (erpVal === 'outro') { var erpNome = (f.erpOutro && f.erpOutro.trim()) ? ptEsc(f.erpOutro.trim()) : 'o ERP da ' + emp; erpMsg = 'A plataforma Agilean integra-se a <b>' + erpNome + '</b> via conector de API ou exportação estruturada — sem redigitação entre os sistemas.'; }
  else erpMsg = 'A plataforma Agilean funciona como <b>hub de gestão operacional</b> e integra-se de forma nativa aos principais ERPs do mercado quando a ' + emp + ' adotar um.';
  var integ = ptpTabela([{ t: 'Integração padrão', w: '48mm' }, { t: 'O que entrega' }], [
    { c: ['<span class="b6">Orçamento × Planejamento</span>', 'O orçamento do ERP alimenta o planejamento (Linha de Balanço e Curva S) — físico-financeiro confiável, sem redigitar o orçamento em outra ferramenta.'] },
    { c: ['<span class="b6">Envio das medições físico-financeiras</span>', 'As medições de avanço físico-financeiro da obra são enviadas ao ERP automaticamente, mantendo custo e execução sincronizados.'] }]);
  var ERP_LOGOS = [['sienge', 'Sienge', 'logos/SIENGE.png'], ['totvs', 'TOTVS', 'logos/TOTVs.jpeg'], ['informakon', 'Informakon', 'logos/Informakon.png'], ['mega', 'Senior Mega', 'logos/MEGA.jpeg'], ['uau', 'UAU', 'logos/UAU.jpeg']];
  var logos = '<div class="logos">' + ERP_LOGOS.map(function(l) { return '<div class="lg' + (l[0] === erpVal ? ' on' : '') + '"><img src="' + l[2] + '" alt="' + l[1] + '"></div>'; }).join('') + '<span class="note">· conexão bidirecional, sem digitação duplicada</span></div>';
  var h1 = ptpHead(num, 'Resultados esperados por nível') +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Por camada</div></div><div><p class="lead">O mesmo programa entrega valor diferente para cada camada de gestão da ' + emp + '.</p></div></div>';
  var b2 = ptpRow('Ecossistema e integrações nativas de ERP', '<div class="lbl" style="margin-bottom:1.6mm">API Nativa · Bidirecional</div><p class="txt" style="font-size:8.8pt;line-height:12.5pt;margin-bottom:3mm">' + erpMsg + '</p>' + integ + logos);
  return [{ sec: num, head: h1, rows: cards, render: ptpRender }, { sec: num, html: b2 }];
}

// ── 06 · Governança, Ritos e Time ────────────────────────────────────────
function ptpGov(M, num) {
  var meses = M.cfg.progMeses;
  var etapas = [['01', 'Diagnóstico', 'Alinhamento da estratégia do programa'], ['02', 'Implantação', 'Setup dos processos essenciais (Fases de Implementação I e II)'],
    ['03', 'Adoção', 'Fase de Implementação III e ampliação para as demais frentes'], ['04', 'Engajamento', 'Avaliação proativa do uso'], ['05', 'Acompanhamento', 'Ritos até a cultura enraizar']];
  var ritos = [['Mensal', 'Comitê Executivo', 'Diretoria + Agilean: leitura do Health Score, avanço das metas e decisões de curso.'], ['Quinzenal', 'Rito Tático', 'Sala técnica: análise de restrições e planejamento de médio prazo.'], ['Semanal', 'Rito Operacional', 'Obra: Last Planner, compromissos de curto prazo e mão de obra.']];
  var papeis = [['Apresenta', 'Comercial', 'Conduz a proposta e a transição para a execução.'], ['Executa', 'Customer Success', 'Responsável pela condução do programa nos ' + meses + ' meses.'], ['Apoia', 'Sócio / CEO', 'Presença pontual em momentos-chave da transformação.']];
  var c1 = etapas.map(function(e){ return ptpCol('', ptEsc(e[1]), ptEsc(e[2]), '').replace('<div class="col">', '<div class="col"><div class="n2">' + e[0] + '</div>'); });
  var c2 = ritos.map(function(r){ return ptpCol(r[0], r[1], r[2]); });
  var c3 = papeis.map(function(r){ return ptpCol(r[0], r[1], r[2]); });
  var b1 = ptpHead(num, 'Governança, Ritos e Time') +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Etapas</div></div><div><p class="lead">Cinco etapas de intensidade decrescente — do redesenho à autonomia — sustentadas por uma cadência de ritos e medidas por Health Score.</p></div></div>' +
    ptpCols(5, c1, '4mm');
  var b2 = ptpGrupo('Ritos de governança', ptpCols(3, c2, '3mm') + '<div class="nt">Gatilho de intensificação: se a aderência cair abaixo de <b>70% da baseline</b>, a cadência sobe automaticamente até o indicador se recuperar.</div>');
  var b3 = ptpGrupo('Time', ptpCols(3, c3, '3mm') + '<div class="nt"><b>Formato de atuação:</b> programa conduzido de forma <b>remota</b>, com os ritos de governança e a sala técnica em cadência semanal/quinzenal/mensal. Encontros presenciais são exceção, reservados a momentos-chave como o kick-off (Lean Experience).</div>');
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }, { sec: num, html: b3 }];
}

// ── 07 · O Método SIIGA ──────────────────────────────────────────────────
function ptpMetodo(M, num) {
  var pil = [['Pessoas', 'Cultura que enraíza', 'Nivelamento Lean da equipe (Workshop Lean Experience), papéis definidos por RACI e um time que continua operando o método depois que a gente sai.'],
    ['Processos', 'Fluxo redesenhado', 'Planejamento do fluxo de produção, proteção do plano por análise de restrições e Last Planner System — o processo que a tecnologia vai sustentar.'],
    ['Tecnologia', 'Agilean como consequência', 'A plataforma entra para dar visibilidade e governança ao processo já maduro — integrada ao ERP, não como uma ilha a mais de dados.']];
  var linhas = [['Treino de tela padrão, igual para todos', 'Diagnóstico com score e programa sob medida'], ['Não mapeia o processo da empresa', 'Redesenha o fluxo de produção antes do sistema'], ['Sem definição de papéis', 'RACI definido para cada rotina'],
    ['Sistema vira mais uma ilha de dados', 'Integração nativa com o ERP'], ['Acaba na entrega, sem acompanhamento', 'Health Score e ritos até a cultura enraizar']];
  var cards = pil.map(function(p){ return ptpCol(p[0], p[1], p[2]); });
  var cmp = '<div class="cmp"><div class="ch">✕ Implantação tradicional</div><div class="ch s">✓ Programa SIIGA</div>' +
    linhas.map(function(l){ return '<div class="cl">' + l[0] + '</div><div class="cl s">' + l[1] + '</div>'; }).join('') + '</div>';
  var b1 = ptpHead(num, 'O Método SIIGA') +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Por que vamos além da tecnologia</div></div><div><p class="lead">O SIIGA não é a implantação de um sistema. É o redesenho de como a empresa planeja e executa — a plataforma entra como consequência do processo maduro.</p></div></div>' +
    ptpGrupo('A base da nossa Metodologia SIIGA', ptpCols(3, cards, '3mm'));
  var b2 = ptpGrupo('Implantação de Sistema × Redesenho SIIGA', cmp);
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }];
}

// ── 08 · Depoimentos e resultados ────────────────────────────────────────
function ptpDepoimentos(M, num) {
  var deps = [['Gestão de Mão de Obra', '“O Agilean nos trouxe praticidade e soluções reais para acompanhar a mão de obra em grandes construções. Nossas obras têm entre 150 e 200 pessoas e era um desafio gerenciar e integrar todos os recursos. Agora tenho tempo para analisar, criar estratégias e focar no que agrega valor.”', 'Natalia V. de Dios', 'Gerência de Processos e Qualidade · Dimas Construções'],
    ['Decisão em Tempo Real', '“Uma das maiores vantagens que o Agilean nos trouxe foi a capacidade de rastrear e monitorar o progresso das nossas obras em tempo real, permitindo decisões rápidas com dados confiáveis de canteiro. Aumentamos consideravelmente o cumprimento dos prazos.”', 'Alessandra Silva', 'Coordenação de Planejamento e Controle · CONX'],
    ['Linha de Balanço Ágil', '“Saímos de um modelo operacional e trabalhoso para planejar e elaborar nossa linha de balanço; nossos engenheiros passavam meses no processo. Com o Agilean fazemos em questão de horas, simulando múltiplos cenários e planos de ataque.”', 'Claudio Barreira', 'Diretor de Engenharia · Dasart']];
  var stats = [['22', 'estados com operação'], ['70 mi', 'm² construídos com Agilean'], ['+5.000', 'canteiros impactados'], ['+5 mil', 'gestores usando por dia'], ['+25%', 'de ganho médio de produtividade']];
  var strip = '<div class="strip five">' + stats.map(function(s){ return '<div><div class="big">' + s[0] + '</div><div class="note">' + s[1] + '</div></div>'; }).join('') + '</div>';
  var cards = deps.map(function(d) {
    return ptpCol(d[0], '', '', '<div class="dep">' + d[1] + '</div><div class="dep-a"><b class="b6">' + d[2] + '</b><br>' + d[3] + '</div>');
  });
  var b1 = ptpHead(num, 'Pareceres de Lideranças & Resultados Comprovados') +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Resultados comprovados</div></div><div>' + strip + '</div></div>';
  var b2 = ptpCols(3, cards, '6mm');
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }];
}

// ── 09 · Investimento ────────────────────────────────────────────────────
function ptpInvestimento(M, num) {
  var cfg = M.cfg, emp = ptpEmp(M), n = cfg.nObras, plano = propPlanoInfo(cfg.plan), ativInfo = PROP_ATIVACAO[cfg.plan], money = ptpMoney;
  var dePor = function(de, por) { return (por < de - 0.5 ? '<s style="font-weight:400;font-size:12pt;color:var(--texto3);margin-right:2.4mm">' + money(de) + '</s>' : '') + money(por); };
  var disc = function(de, por) { return por >= de - 0.5 ? '' : ' · −' + Math.round((1 - por / de) * 100) + '%'; };
  var cells = [];
  if (!cfg.progNA) cells.push('<div><div class="lbl">Produto 1 · Consultoria</div><div class="b6" style="margin:1mm 0">Redesenho de Processos SIIGA</div><div class="big">' + dePor(cfg.progDe, cfg.progPor) + '<small style="font-size:var(--t-nota);color:var(--ok);font-weight:700">' + disc(cfg.progDe, cfg.progPor) + '</small></div><div class="note">' + fmtBRL(PROP_PROGRAMA_MENSAL) + '/mês × ' + cfg.progMeses + ' meses · valor total da consultoria</div></div>');
  if (!cfg.ativNA) cells.push('<div><div class="lbl">Produto 2 · Plataforma</div><div class="b6" style="margin:1mm 0">' + ptEsc(ativInfo.nome) + '</div><div class="big">' + dePor(cfg.ativDe, cfg.ativPor) + '<small style="font-size:var(--t-nota);color:var(--ok);font-weight:700">' + disc(cfg.ativDe, cfg.ativPor) + '</small></div><div class="note">Setup único · ativação da plataforma no plano ' + ptEsc(plano.nome) + '</div></div>');
  var strip = '<div class="strip' + (cells.length === 2 ? ' two' : ' one') + '">' + cells.join('') + '</div>';
  var modsList = []; PROP_MODULOS.forEach(function(m) { if (cfg.mods[m.key]) modsList.push(m.nome); });
  var pilotoTag = cfg.piloto ? ' · ' + (cfg.pilotoMeses === 1 ? '1º mês isento' : '1º ao ' + cfg.pilotoMeses + 'º mês isentos') + ' · Piloto' : '';
  var plat = ptpTabela([{ t: 'Plataforma Agilean · ' + ptEsc(plano.nome) + ' ' + (cfg.progNA ? '(assinatura mensal)' : '(pós-programa)') + pilotoTag }, { t: 'Valor por obra', n: true, w: '40mm' }], [{ c: [
    (cfg.progNA ? 'Cobrança a partir do 1º mês de uso · contratação padrão' : 'Inclusa durante os ' + cfg.progMeses + ' meses do programa · assinatura recorrente começa depois') + (modsList.length ? ' · módulos: ' + modsList.join(', ') : ''),
    '<span class="big" style="font-size:12pt">' + dePor(cfg.mensalDe, cfg.mensalPor) + '</span><span class="note">/obra/mês</span><div class="note">condição para ' + n + ' obra' + (n === 1 ? '' : 's') + '</div>'] }]);
  var obs = cfg.piloto ? '<div class="nt"><b>Modelo Piloto:</b> ' + propPilotoObs(cfg) + '</div>' : '';
  var mem = [];
  if (!cfg.progNA) mem.push(['Redesenho de Processos SIIGA', money(PROP_PROGRAMA_MENSAL) + '/mês × ' + cfg.progMeses + ' meses = <b>' + money(cfg.progPor) + '</b>' + (cfg.progPor < cfg.progDe - 0.5 ? ' (de ' + money(cfg.progDe) + ')' : '')]);
  if (!cfg.ativNA) mem.push(['Ativação SIIGA (' + ptEsc(plano.nome) + ')', 'setup único = <b>' + money(cfg.ativPor) + '</b>' + (cfg.ativPor < cfg.ativDe - 0.5 ? ' (de ' + money(cfg.ativDe) + ')' : '')]);
  mem.push(['Plataforma ' + (cfg.progNA ? '(mensalidade)' : 'pós-programa'), '<b>' + money(cfg.mensalPor) + '/obra/mês</b>' + (cfg.mensalPor < cfg.mensalDe - 0.5 ? ' (de ' + money(cfg.mensalDe) + ')' : '') + ' · condição válida para ' + n + ' obra' + (n === 1 ? '' : 's')]);
  if (cfg.piloto) mem.push(['Modelo Piloto', cfg.pilotoMeses + ' mensalidade(s) da plataforma isenta(s).']);
  var lead = cfg.progNA ? 'A <b>Ativação SIIGA</b> coloca a plataforma para rodar na ' + emp + '; a assinatura mensal, calculada <b>por obra</b>, é cobrada a partir do 1º mês de uso.'
    : (cfg.ativNA ? 'O <b>Redesenho de Processos SIIGA</b> (consultoria) conduz a evolução da ' + emp + '; a plataforma fica inclusa durante os ' + cfg.progMeses + ' meses e a assinatura recorrente, calculada <b>por obra</b>, entra depois, se a ' + emp + ' seguir.'
      : 'Dois produtos, um só programa: o <b>Redesenho de Processos SIIGA</b> (consultoria) em destaque e a <b>Ativação SIIGA</b> da plataforma; a plataforma fica inclusa durante os ' + cfg.progMeses + ' meses e a assinatura recorrente entra depois, se a ' + emp + ' seguir.');
  var b1 = ptpHead(num, 'Investimento personalizado para a ' + emp) +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Produtos</div></div><div><p class="lead">' + lead + '</p><div style="margin-top:4mm">' + strip + '</div></div></div>';
  var b2 = ptpRow('Plataforma', plat + obs);
  var b3 = ptpRow('Memória de cálculo', ptpTabela([{ t: 'Item', w: '56mm' }, { t: 'Valor' }], mem.map(function(m){ return { c: [m[0], m[1]] }; })));
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }, { sec: num, html: b3 }];
}

// ── 10 · Retorno projetado ───────────────────────────────────────────────
function ptpRetorno(M, num) {
  var cfg = M.cfg, roi = M.roi, emp = ptpEmp(M), prazo = S.prazoMedio || 18, nObras = cfg.nObras, money = function(v) { return 'R$ ' + Math.round(v).toLocaleString('pt-BR'); };
  var perdaBruta = Math.round(roi.totalBase * nObras);
  var NOME_RED = { time: 'horas', retrabalho: 'retrabalho', velocidade: 'custo do prazo', erros: 'erros de medição', mo: 'estouro de MO' };
  var reducoes = roi.items.map(function(it) { return NOME_RED[it.key] + ' ' + Math.round((it.reducao != null ? it.reducao : 1) * 100) + '%'; }).join(' · ');
  var pb = propPayback(roi, cfg, prazo, 3);
  var ganhoMes = pb.ganhoMes, mesesGanho = Math.max(0, prazo - 2), ganhoPeriodo = ganhoMes * mesesGanho;
  var CC = ROI_CENARIO_CONSERVADOR, ccPct = Math.round(CC * 100) + '%', ganhoMesC = ganhoMes * CC, ganhoPeriodoC = ganhoPeriodo * CC;
  var pbTxt, pbSub;
  if (pb.mes != null) { pbTxt = pb.mes + (pb.mes === 1 ? ' mês' : ' meses'); pbSub = 'Investimento total até o mês ' + pb.mes + ': ' + money(pb.inv) + ' · ganho acumulado: ' + money(pb.ganho) + ' (ganho a partir do 3º mês).'; }
  else { pbTxt = 'Sem payback'; pbSub = 'O ganho acumulado não cobre o investimento total nos ' + prazo + ' meses da duração média das obras.'; }
  var linhaInv = [];
  if (!cfg.progNA) linhaInv.push('Redesenho ' + money(pb.invRed));
  if (!cfg.ativNA) linhaInv.push('Ativação ' + money(pb.invAtiv));
  if (pb.invPlat) linhaInv.push(pb.mesesPlat + ' mensalidade' + (pb.mesesPlat === 1 ? '' : 's') + ' da plataforma' + (cfg.nObras > 1 ? ' (' + cfg.nObras + ' obras)' : '') + ' ' + money(pb.invPlat));
  var strip = '<div class="strip">' +
    '<div><div class="lbl">Exposição em Risco</div><div class="big p">' + fmtNum(perdaBruta) + '</div><div class="note">Perda estimada no portfólio, sem intervenção.</div></div>' +
    '<div><div class="lbl">Ganho capturável com o programa</div><div class="big g">' + fmtNum(ganhoPeriodo) + '</div><div class="note">No período da obra, a partir do 3º mês (' + mesesGanho + ' meses × ' + money(ganhoMes) + ').</div></div>' +
    '<div><div class="lbl">Payback</div><div class="big">' + pbTxt + '</div><div class="note">' + pbSub + '</div></div></div>';
  var nt = function(t) { return t ? '<div class="note">' + t + '</div>' : ''; };
  var calc = ptpTabela([{ t: 'Item' }, { t: 'Valor', n: true }], [
    { c: ['<span class="b6">Ganho mensal com o plano</span>' + nt('soma do ganho de cada fonte: ' + reducoes + (nObras > 1 ? ' · ganho por obra × ' + nObras + ' obras' : '')), money(ganhoMes) + '/mês'] },
    { c: ['<span class="b6">Ganho no período da obra</span>', fmtNum(ganhoPeriodo)] },
    { c: ['<span class="b6">Investimento até o payback</span>' + nt(linhaInv.join(' + ')), pb.mes != null ? money(pb.inv) : '—'] },
    { c: ['<span class="b6">Payback</span>', pb.mes != null ? pb.mes + (pb.mes === 1 ? ' mês' : ' meses') : 'sem payback em ' + prazo + ' meses'], cls: 'tot' },
  ], 'ax');
  var b1 = ptpHead(num, 'Retorno projetado para a ' + emp) +
    '<div class="row" style="margin-top:5mm"><div><div class="lbl rule">Retorno</div></div><div><p class="lead">Consultoria de resultado não promete número mágico. Partimos da perda estimada de <b>' + fmtNum(perdaBruta) + '</b> do diagnóstico; aplicando a redução com o SIIGA de cada fonte, o ganho mensal do portfólio é <b>' + money(ganhoMes) + '</b>. No período da obra, a partir do 3º mês, após a implantação inicial (' + mesesGanho + ' dos ' + prazo + ' meses de duração média), o ganho é <b>' + fmtNum(ganhoPeriodo) + '</b>.</p><div style="margin-top:4mm">' + strip + '</div><div class="faixa"><b>Cenário conservador:</b> mesmo recuperando só ' + ccPct + ' do proposto, o ganho é de <b>' + money(ganhoMesC) + ' por mês</b> (' + fmtNum(ganhoPeriodoC) + ' no período da obra).</div></div></div>';
  var b2 = ptpRow('Como é calculado', calc);
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }];
}

// ── 11 · Termos e próximo passo ──────────────────────────────────────────
function ptpTermos(M, num) {
  var cfg = M.cfg, dias = cfg.validade, validadeFmt = new Date(new Date().getTime() + dias * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'), kickTxt = '';
  if (cfg.kickoff) { var kd = new Date(cfg.kickoff + 'T00:00:00'); if (!isNaN(kd.getTime())) kickTxt = kd.toLocaleDateString('pt-BR'); }
  var termos = [];
  if (!cfg.progNA) termos.push(['Redesenho de Processos SIIGA', fmtBRL(PROP_PROGRAMA_MENSAL) + '/mês · ' + cfg.progMeses + ' meses']);
  if (!cfg.ativNA) termos.push(['Ativação SIIGA', fmtBRL(cfg.ativPor) + ' · setup único']);
  termos.push([cfg.progNA ? 'Plataforma' : 'Plataforma (após)', fmtBRL(cfg.mensalPor) + '/obra/mês · para ' + cfg.nObras + ' obra' + (cfg.nObras === 1 ? '' : 's') + (cfg.progNA ? ' · cobrança desde o 1º mês' : '')]);
  termos.push(['Validade', dias + ' dias — até ' + validadeFmt]);
  var tab = ptpCols(termos.length, termos.map(function(t){ return ptpCol(t[0], '', t[1]).replace('<div class="k">', '<div class="k">'); }), '3mm');
  var obs = cfg.piloto ? '<div class="nt"><b>Modelo Piloto:</b> ' + propPilotoObs(cfg) + '</div>' : '';
  var passo = cfg.progNA
    ? 'Para avançarmos, será necessário <b>confirmarmos a data de início da Ativação SIIGA</b>' + (kickTxt ? ' — nossa sugestão é <b>' + kickTxt + '</b>' : '') + ' e <b>recebermos o planejamento e o orçamento das obras</b> que serão contempladas. A assinatura da plataforma é cobrada a partir do 1º mês de uso.'
    : 'Para avançarmos, será necessário <b>confirmarmos a data do Kick-Off</b>' + (kickTxt ? ' — nossa sugestão é <b>' + kickTxt + '</b>' : '') + ' e <b>recebermos o planejamento e o orçamento das obras</b> que serão contempladas no programa. Confirmada a data, a Agilean inicia a Fase de Implementação I na semana seguinte, começando pelo Workshop Lean Experience.';
  var card = '<div class="plano"><div class="kk sq">Próximo passo</div><h3>Próximo passo</h3><p>' + passo + '</p><p class="note" style="margin-bottom:0">Validade até ' + validadeFmt + ' · ' + dias + ' dias' + (kickTxt ? ' · ' + (cfg.progNA ? 'Início' : 'Kick-Off') + ' sugerido: ' + kickTxt : '') + '</p></div>';
  var b1 = ptpHead(num, 'Termos & Próximo Passo') + ptpRow('Termos', tab + obs);
  var b2 = '<div class="row sec"><div><div class="lbl rule">Próximo passo</div></div><div>' + card + '</div></div>';
  return [{ sec: num, html: b1 }, { sec: num, html: b2 }];
}

// ── Capa ────────────────────────────────────────────────────────────────
function ptpCapa(M) {
  var pg = document.createElement('div');
  pg.className = 'page cover';
  var emp = ptpEmp(M), so = M.soAtiv;
  var idt = [['Empresa', emp], ['Data de emissão', M.dataEmissao], ['Escopo', so ? 'Ativação SIIGA' : 'Programa de Redesenho SIIGA'], ['Versão', M.versao]];
  pg.innerHTML = ptNb('<img class="logo" src="' + PT_LOGO + '" alt="Agilean">' +
    '<div class="ctit"><div class="lbl sq">Proposta de Escopo · ' + (so ? 'Ativação SIIGA' : 'Programa SIIGA') + '</div>' +
      '<h1 style="margin-top:2mm">Proposta do Escopo de Projeto para a Evolução da</h1><div class="cco">' + emp + '</div></div>' +
    '<table class="idt">' + idt.map(function(r, i){ return '<tr><td class="lbl"' + (i === 0 ? ' style="width:42mm"' : '') + '>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
    '<p class="lead" style="margin-top:9mm;max-width:140mm">Este escopo nasce diretamente do diagnóstico SIIGA da ' + emp + '. ' + (so
      ? 'Ele coloca a plataforma SIIGA para rodar na sua operação, apoiando a gestão das obras com os dados do diagnóstico.'
      : 'Ele traduz os pontos críticos identificados em um programa de ' + M.cfg.progMeses + ' meses para redesenhar a forma de planejar e executar — destravando valor real na sua operação e deixando o time autônomo para sustentar o ganho.') + '</p>' +
    (so ? '' : '<div class="fotos"><div class="lbl rule" style="margin-bottom:3mm">Workshop Lean Experience · o ponto de partida do programa</div><div class="fg"><img src="img/lean/lean1.jpg" alt="Workshop Lean Experience"><img src="img/lean/lean2.jpg" alt="Workshop Lean Experience"></div></div>'));
  return pg;
}

// ── Montagem ────────────────────────────────────────────────────────────
function ptpBuild() {
  var M = ptpModel();
  var old = document.getElementById('ptr-root');
  if (old) old.parentNode.removeChild(old);
  var root = document.createElement('div');
  root.id = 'ptr-root';
  root.className = 'ptr prop';
  document.body.appendChild(root);
  var secs = [['Recapitulação executiva', ptpRecap, 'Recapitulação'], ['Principais pontos críticos', ptpPontos, 'Pontos críticos']];
  if (!M.soAtiv) secs.push(['Objetivo do Redesenho SIIGA', ptpObjetivo, 'Objetivo'], ['O Programa de Redesenho SIIGA', ptpPrograma, 'Programa'], ['Resultados esperados por nível', ptpResultados, 'Resultados'], ['Governança, Ritos e Time', ptpGov, 'Governança'], ['O Método SIIGA', ptpMetodo, 'Método']);
  secs.push(['Pareceres e resultados comprovados', ptpDepoimentos, 'Pareceres'], ['Investimento personalizado', ptpInvestimento, 'Investimento'], ['Retorno projetado', ptpRetorno, 'Retorno'], ['Termos e próximo passo', ptpTermos, 'Termos']);
  M.secoes = {};
  M.flowRows = 2;   // a seção seguinte começa na folha corrente se o título e 2 linhas couberem (o relatório mantém 3)
  var blocks = [];
  secs.forEach(function(s, i) {
    var num = ptPad(i + 1);
    M.secoes[num] = { run: s[2] || s[0], toc: s[0], cls: 'tight dense', flowIfWhole: true };   // run = título curto do cabeçalho corrente (cabe numa linha mesmo com várias seções na folha)
    blocks = blocks.concat(s[1](M, num));
  });
  var pg = ptPaginate(root, M, blocks);
  var total = pg.pages.length + 1;
  pg.pages.forEach(function(p, i) { p.el.querySelector('.carimbo').innerHTML = ptNb(ptCarimbo(M, i + 2, total)); });
  root.insertBefore(ptpCapa(M), root.firstChild);
  ptHatch(root);
  return { root: root, model: M, total: total };
}

function generatePropostaPrancha() {
  var loadDiv = document.createElement('div');
  loadDiv.id = 'pdf-loading';
  loadDiv.style.cssText = 'position:fixed;inset:0;background:rgba(15,16,21,0.95);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
  loadDiv.innerHTML = '<div style="width:48px;height:48px;border:3px solid rgba(255,255,255,0.1);border-top-color:#ea580c;border-radius:50%;animation:spin 0.8s linear infinite"></div>' +
    '<div style="font-family:Bai Jamjuree;font-size:14px;color:white">Gerando Proposta...</div><div style="font-size:12px;color:var(--gray2)">Aguarde alguns segundos</div>';
  document.body.appendChild(loadDiv);
  if (!document.getElementById('spin-style')) {
    var st = document.createElement('style'); st.id = 'spin-style'; st.textContent = '@keyframes spin{to{transform:rotate(360deg)}}'; document.head.appendChild(st);
  }
  var built = null;
  function cleanup() {
    if (loadDiv.parentNode) loadDiv.parentNode.removeChild(loadDiv);
    if (built && built.root.parentNode && !window.__PT_KEEP_DOM) built.root.parentNode.removeChild(built.root);
  }
  var probe = document.createElement('div');
  probe.className = 'ptr';
  probe.innerHTML = '<div class="page">' + PT_FONT_FACES.map(function(f) {
    var m = /^(\d+) 10px "(.+)"$/.exec(f);
    return '<span style="font-family:&quot;' + m[2] + '&quot;;font-weight:' + m[1] + '">Ação</span>';
  }).join('') + '</div>';
  document.body.appendChild(probe);
  ptFontsReady().then(function() {
    probe.parentNode.removeChild(probe);
    built = ptpBuild();
    return ptImagesReady(built.root).then(ptFontsReady);
  }).then(function() {
    var jsPDFNS = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    var pdf = new jsPDFNS({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    var M = built.model;
    pdf.setProperties({ title: 'Proposta SIIGA · ' + M.empresa, author: 'Agilean', subject: 'Proposta de escopo SIIGA · ' + M.empresa, keywords: 'SIIGA, proposta', creator: 'SIIGA Assessment' });
    var pageEls = Array.prototype.slice.call(built.root.querySelectorAll(':scope > .page'));
    var paper = ptToken('--papel') || '#FFFFFF';
    var idx = 0;
    return new Promise(function(resolve, reject) {
      function next() {
        if (idx >= pageEls.length) { resolve(pdf); return; }
        html2canvas(pageEls[idx], { scale: 2.5, useCORS: true, allowTaint: true, backgroundColor: paper, logging: false }).then(function(canvas) {
          if (idx > 0) pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
          idx++;
          next();
        }).catch(reject);
      }
      next();
    });
  }).then(function(pdf) {
    var empresa = (built.model.empresa || 'prospect').replace(/[^a-zA-Z0-9]/g, '_');
    var data = (S.data || new Date().toISOString().split('T')[0]);
    window.__LAST_PROPOSTA_PDF_DATA = pdf.output('datauristring');
    pdf.save('SIIGA_Proposta_' + empresa + '_' + data + '.pdf');
    cleanup();
    if (typeof showToast === 'function') showToast('Proposta gerada com sucesso!');
  }).catch(function(err) {
    cleanup();
    console.error('Proposta PDF error:', err);
    alert('Erro ao gerar a Proposta. Tente novamente.');
  });
}
