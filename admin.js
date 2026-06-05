// ═══════════════════════════════════════════
//  SUPABASE SETUP
// ═══════════════════════════════════════════
const SUPABASE_URL = 'https://ghtdfhupjoddfwiqzdpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGRmaHVwam9kZGZ3aXF6ZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjY4MTYsImV4cCI6MjA5NTMwMjgxNn0.d0FDQk-P_xTWslTN2zIfxi8wNpxpf1Xwz5AhX3cnUnc';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let allData = [];
let filteredData = [];
let selectedIds = [];

// ═══════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════
document.getElementById('pass-input').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') checkLogin();
});

function checkLogin() {
  const pass = document.getElementById('pass-input').value;
  if (pass === '@Agilean2026') {
    document.getElementById('login-overlay').style.display = 'none';
    fetchData();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

// ═══════════════════════════════════════════
//  LEAD SCORING
// ═══════════════════════════════════════════
const CARGOS_AB = [
  'c-level', 'coordenador', 'diretor', 'engenheiro', 'engenheiro de obra',
  'engenheiro de planejamento', 'gerente', 'proprietário', 'proprietario',
  'sócio', 'socio', 'supervisor'
];
const CARGOS_C_EXTRA = ['analista', 'autônomo', 'autonomo', 'consultor'];
const CARGOS_C = CARGOS_AB.concat(CARGOS_C_EXTRA);

const TIPOLOGIA_A = ['vert'];
const TIPOLOGIA_B = ['com'];
const TIPOLOGIA_C = ['vert', 'com', 'div'];

function matchCargo(cargo, allowedList) {
  if (!cargo) return false;
  var cargoLower = cargo.toLowerCase().trim();
  return allowedList.some(function (c) { return cargoLower.indexOf(c) >= 0; });
}

function getObrasRange(numObras) {
  if (!numObras || numObras <= 0) return '—';
  if (numObras === 1) return '1';
  if (numObras <= 4) return '2 a 4';
  if (numObras <= 9) return '5 a 9';
  if (numObras <= 15) return '10 a 15';
  if (numObras <= 20) return '16 a 20';
  return 'Acima de 20';
}

function getTipologiaLabel(tipologia) {
  var map = { 'vert': 'Residencial Vertical', 'horiz': 'Residencial Horizontal', 'mcmv': 'MCMV / Habitação Popular', 'com': 'Comercial / Industrial', 'div': 'Portfólio Diversificado' };
  return map[tipologia] || tipologia || '—';
}

function fmtOrcamento(val) {
  if (!val || isNaN(val)) return '—';
  if (val >= 1000000) return 'R$ ' + (val / 1000000).toFixed(1).replace('.', ',') + 'M';
  if (val >= 1000) return 'R$ ' + Math.round(val / 1000) + 'K';
  return 'R$ ' + Math.round(val);
}

function calcLeadScore(row) {
  var state = getState(row);
  var cargo = row.cargo || (state && state.cargo) || '';
  var tipologia = (state && state.tipologia) || '';
  var numObras = parseInt(row.num_obras || (state && state.numObras) || 0);
  var orcamento = parseFloat(row.orcamento_medio || (state && state.orcamentoMedio) || 0);

  var cargoAB = matchCargo(cargo, CARGOS_AB);
  var tipoA = TIPOLOGIA_A.indexOf(tipologia) >= 0;
  if (cargoAB && tipoA && numObras >= 1 && orcamento >= 1000000) return 'A';

  var tipoB = TIPOLOGIA_B.indexOf(tipologia) >= 0;
  if (cargoAB && tipoB && numObras >= 1 && orcamento >= 1000000) return 'B';

  var cargoC = matchCargo(cargo, CARGOS_C);
  var tipoC = TIPOLOGIA_C.indexOf(tipologia) >= 0;
  if (cargoC && tipoC && numObras >= 5 && orcamento >= 500000) return 'C';

  return null;
}

function getScoreBadgeHTML(score) {
  if (score === 'A') return '<span class="badge badge-a">A</span>';
  if (score === 'B') return '<span class="badge badge-b">B</span>';
  if (score === 'C') return '<span class="badge badge-c">C</span>';
  return '<span class="badge badge-none">—</span>';
}

function getNivel(row) { return row.nivel || '—'; }

function getNivelBadgeHTML(nivel) {
  if (!nivel || nivel === '—') return '<span class="badge-nivel" style="color:var(--gray)">—</span>';
  if (nivel === 'Reativo') return '<span class="badge-nivel nivel-reativo">Reativo</span>';
  if (nivel === 'Em Construção') return '<span class="badge-nivel nivel-construcao">Em Construção</span>';
  if (nivel === 'Estruturado') return '<span class="badge-nivel nivel-estruturado">Estruturado</span>';
  if (nivel.indexOf('Referência') >= 0 || nivel.indexOf('Referencia') >= 0) return '<span class="badge-nivel nivel-referencia">Referência</span>';
  return '<span class="badge-nivel" style="color:var(--gray)">' + nivel + '</span>';
}

// ═══════════════════════════════════════════
//  DATA EXTRACTION HELPERS
// ═══════════════════════════════════════════
function getState(row) {
  if (row.state && typeof row.state === 'object') return row.state;
  if (typeof row.state === 'string') { try { return JSON.parse(row.state); } catch (e) { } }
  if (row.json_data) { try { return JSON.parse(row.json_data); } catch (e) { } }
  return {};
}

function getField(row, directKey, stateKey) {
  if (row[directKey]) return row[directKey];
  var state = getState(row);
  return (state && state[stateKey]) || '';
}

// ═══════════════════════════════════════════
//  PHASE DEFINITIONS (for display)
// ═══════════════════════════════════════════
var PHASES = {
  f1: {
    label: 'Fase 1 · Planejamento Estratégico', color: '#60a5fa', max: 21, qCount: 7,
    questions: ['Planejamento formal', 'Técnica de planejamento', 'Dimensionamento de duração', 'Integração orçamento × plano', 'Análise da Curva S', 'Cronograma bancário', 'Integração com suprimentos']
  },
  f2: {
    label: 'Fase 2 · Proteção da Execução', color: '#2dd4bf', max: 12, qCount: 4,
    questions: ['Lookahead / rotina de médio prazo', 'Antecedência de riscos', 'Confirmação de equipes', 'Reprogramação formal']
  },
  f3: {
    label: 'Fase 3 · Gestão da Produção', color: '#34d399', max: 18, qCount: 6,
    questions: ['Programação semanal', 'Check-in / Check-out diário', 'Registro de causas de desvio', 'Frequência coleta avanço', 'Vínculo qualidade × pagamento', 'Análise intermediária']
  },
  f4: {
    label: 'Fase 4 · Controle e Performance', color: '#9ca3af', max: 12, qCount: 4,
    questions: ['Reunião de fechamento técnico', 'Reunião executiva com diretoria', 'Painel integrado de indicadores', 'Fechamento financeiro rastreável']
  }
};

function getPhaseScores(row) {
  var scores = row.scores;
  if (!scores && row.state) {
    var st = getState(row);
    scores = st && st.scores;
  }
  if (typeof scores === 'string') { try { scores = JSON.parse(scores); } catch (e) { scores = {}; } }
  return scores || {};
}

function sumArray(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce(function (a, b) { return a + (b || 0); }, 0);
}

function levelFromPct(p) {
  if (p < 0.35) return 'Reativo';
  if (p < 0.6) return 'Em Construção';
  if (p < 0.85) return 'Estruturado';
  return 'Referência SIIGA';
}

function colorFromPct(p) {
  if (p < 0.35) return '#f87171';
  if (p < 0.6) return '#fbbf24';
  if (p < 0.85) return '#60a5fa';
  return '#34d399';
}

// ═══════════════════════════════════════════
//  FETCH & RENDER
// ═══════════════════════════════════════════
async function fetchData() {
  var tbody = document.getElementById('table-body');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center"><div class="loader"></div></td></tr>';

  if (!supabaseClient) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#ff4444">Erro: Supabase não inicializado.</td></tr>';
    return;
  }

  try {
    var result = await supabaseClient
      .from('assessments')
      .select('*')
      .order('created_at', { ascending: false });

    if (result.error) throw result.error;

    allData = result.data || [];
    allData.forEach(function (row) {
      row._leadScore = calcLeadScore(row);
      row._nivel = getNivel(row);
    });

    selectedIds = []; // clear selection on fetch
    populateConsultorFilter();
    updateStats();
    applyFilters();
  } catch (err) {
    console.error('Error fetching data:', err);
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#ff4444">Erro ao carregar dados: ' + err.message + '</td></tr>';
  }
}

function populateConsultorFilter() {
  var select = document.getElementById('filter-consultor');
  var currentVal = select.value;
  var consultors = {};
  allData.forEach(function (row) {
    var c = getField(row, 'consultor', 'consultor');
    if (c && c.trim()) consultors[c.trim()] = true;
  });
  var sorted = Object.keys(consultors).sort();
  select.innerHTML = '<option value="">Todos</option>';
  sorted.forEach(function (c) {
    var opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    if (c === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

function updateStats() {
  var countA = 0, countB = 0, countC = 0, countNone = 0;
  allData.forEach(function (row) {
    if (row._leadScore === 'A') countA++;
    else if (row._leadScore === 'B') countB++;
    else if (row._leadScore === 'C') countC++;
    else countNone++;
  });
  document.getElementById('stat-total').textContent = allData.length;
  document.getElementById('stat-a').textContent = countA;
  document.getElementById('stat-b').textContent = countB;
  document.getElementById('stat-c').textContent = countC;
  document.getElementById('stat-none').textContent = countNone;
}

function applyFilters() {
  var search = (document.getElementById('filter-search').value || '').toLowerCase().trim();
  var scoreFilter = document.getElementById('filter-score').value;
  var nivelFilter = document.getElementById('filter-nivel').value;
  var consultorFilter = document.getElementById('filter-consultor').value;

  filteredData = allData.filter(function (row) {
    if (search) {
      var empresa = getField(row, 'empresa', 'empresa').toLowerCase();
      var consultor = getField(row, 'consultor', 'consultor').toLowerCase();
      var contato = getField(row, 'contato', 'contato').toLowerCase();
      var email = getField(row, 'email', 'email').toLowerCase();
      var telefone = getField(row, 'telefone', 'telefone').toLowerCase();
      if (empresa.indexOf(search) < 0 && consultor.indexOf(search) < 0 &&
        contato.indexOf(search) < 0 && email.indexOf(search) < 0 && telefone.indexOf(search) < 0) return false;
    }
    if (scoreFilter) {
      if (scoreFilter === '-') { if (row._leadScore) return false; }
      else { if (row._leadScore !== scoreFilter) return false; }
    }
    if (nivelFilter) {
      var rn = row._nivel || '';
      if (nivelFilter === 'Referência SIIGA') { if (rn.indexOf('Referência') < 0 && rn.indexOf('Referencia') < 0) return false; }
      else { if (rn !== nivelFilter) return false; }
    }
    if (consultorFilter) {
      if (getField(row, 'consultor', 'consultor').trim() !== consultorFilter) return false;
    }
    return true;
  });

  document.getElementById('total-count').textContent = filteredData.length + ' de ' + allData.length + ' registros';
  updateSelectAllCheckbox();
  updateExportButtonState();
  renderTable();
}

function renderTable() {
  var tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  if (filteredData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray)">Nenhum diagnóstico encontrado.</td></tr>';
    return;
  }
  filteredData.forEach(function (row, index) {
    var rawDate = row.created_at || new Date().toISOString();
    var d = new Date(rawDate);
    var dateStr = d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getFullYear() + ' ' + d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    var empresa = getField(row, 'empresa', 'empresa') || '—';
    var consultor = getField(row, 'consultor', 'consultor') || '—';
    var contato = getField(row, 'contato', 'contato') || '—';
    var telefone = getField(row, 'telefone', 'telefone') || '—';

    var isChecked = selectedIds.indexOf(String(row.id)) >= 0;

    var tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = function () { openDetails(index); };
    tr.innerHTML =
      '<td style="text-align:center;" onclick="event.stopPropagation();">' +
      '<input type="checkbox" class="row-checkbox" data-id="' + row.id + '" onchange="toggleRowSelect(this, \'' + row.id + '\')" ' + (isChecked ? 'checked' : '') + ' style="cursor:pointer;">' +
      '</td>' +
      '<td>' + getScoreBadgeHTML(row._leadScore) + '</td>' +
      '<td style="color:var(--gray);font-size:12px">' + dateStr + '</td>' +
      '<td style="font-weight:600;color:var(--orange)">' + empresa + '</td>' +
      '<td>' + consultor + '</td>' +
      '<td>' + contato + '</td>' +
      '<td>' + telefone + '</td>' +
      '<td>' + getNivelBadgeHTML(row._nivel) + '</td>' +
      '<td style="position:relative; text-align:center;" onclick="event.stopPropagation();">' +
      '<button onclick="toggleActionMenu(event, ' + index + ')" style="background:none; border:none; color:var(--gray); cursor:pointer; font-size:18px; padding:4px 8px; font-weight:bold; outline:none;">⋮</button>' +
      '<div id="action-menu-' + index + '" class="action-dropdown">' +
      '<a onclick="handleAction(\'view\', ' + index + ')">📄 Detalhes</a>' +
      '<a onclick="handleAction(\'edit\', ' + index + ')">✏️ Editar</a>' +
      '<a onclick="handleAction(\'delete\', ' + index + ')" style="color:var(--red);">🗑️ Excluir</a>' +
      '</div>' +
      '</td>';
    tbody.appendChild(tr);
  });
}

// ═══════════════════════════════════════════
//  DETAILS MODAL — FULL DIAGNOSTIC VIEW
// ═══════════════════════════════════════════
let radarChartInstDetails = null;

function calculateLeadROI(row) {
  var state = getState(row);
  var scores = getPhaseScores(row);

  var obras = parseInt(row.num_obras || (state && state.numObras) || 5);
  var orcamento = parseFloat(row.orcamento_medio || (state && state.orcamentoMedio) || 8000000);
  var prazo = parseInt((state && state.prazoMedio) || 18);
  var mo = (state && state.modeloMO) || '';

  var maxes = { f1: 21, f2: 12, f3: 18, f4: 12 };

  function getAvgPct(key) {
    var arr = scores[key];
    if (!Array.isArray(arr)) return 0;
    var sum = arr.reduce(function (a, b) { return a + (b || 0); }, 0);
    return sum / (maxes[key] || 1);
  }

  var f1p = getAvgPct('f1');
  var f2p = getAvgPct('f2');
  var f3p = getAvgPct('f3');
  var f4p = getAvgPct('f4');

  var PCT_MO = 0.45;
  var ESTOURO_MO = 0.15;
  var CAPTURA_MO = 0.70;
  var CUSTO_ENG_DIA = 800;
  var diasLib = 13.75;

  function capFactor(scoreComposto) {
    return Math.max(0.20, Math.min(1.0, 0.20 + (1 - scoreComposto) * 0.80));
  }

  var fatTime = capFactor(f3p * 0.50 + f4p * 0.50);
  var fatRetr = capFactor(f2p * 0.30 + f3p * 0.70);
  var fatVeloc = capFactor(f1p * 0.50 + f2p * 0.50);
  var fatMO = capFactor(f3p * 0.70 + f2p * 0.30);
  var fatErros = capFactor(f3p * 0.40 + f4p * 0.60);

  var engBase = diasLib * CUSTO_ENG_DIA * prazo;
  var retrBase = orcamento * 0.10 * 0.40;
  var velocBase = orcamento * 0.10 * 0.15;
  var erroBase = orcamento * PCT_MO * 0.02;

  var moBase = 0;
  var moLabel = '', moBasis = '';
  if (mo === 'propria') {
    moBase = orcamento * PCT_MO * ESTOURO_MO * CAPTURA_MO;
    moLabel = 'Redução de estouro de mão de obra';
    moBasis = 'Orçamento × 45% MO × 15% estouro × 70% de redução com SIIGA';
  } else if (mo === 'mista') {
    moBase = orcamento * PCT_MO * 0.50 * ESTOURO_MO * CAPTURA_MO;
    moLabel = 'Redução de estouro de MO (50% própria)';
    moBasis = 'Orçamento × 45% × 50% própria × 15% estouro × 70% de redução';
  }

  var items = [
    {
      label: 'Otimização do time de gestão',
      basis: '13.75 dias/mês × R$800/dia × ' + prazo + ' meses',
      fator: fatTime,
      porObra: Math.round(engBase * fatTime),
      portfolio: Math.round(engBase * fatTime * obras)
    },
    {
      label: 'Redução de retrabalhos',
      basis: 'Orçamento × 10% (retrabalho mercado) × 40% (redução com SIIGA)',
      fator: fatRetr,
      porObra: Math.round(retrBase * fatRetr),
      portfolio: Math.round(retrBase * fatRetr * obras)
    },
    {
      label: 'Ganho em velocidade de produção',
      basis: 'Orçamento × 10% (redução prazo) × 15% (custos proporcionais)',
      fator: fatVeloc,
      porObra: Math.round(velocBase * fatVeloc),
      portfolio: Math.round(velocBase * fatVeloc * obras)
    },
    {
      label: 'Erros de medição e folha de produção',
      basis: 'Orçamento × 45% (custo MO) × 2% (desvio médio)',
      fator: fatErros,
      porObra: Math.round(erroBase * fatErros),
      portfolio: Math.round(erroBase * fatErros * obras)
    }
  ];

  if (moBase > 0) {
    items.push({
      label: moLabel,
      basis: moBasis,
      fator: fatMO,
      porObra: Math.round(moBase * fatMO),
      portfolio: Math.round(moBase * fatMO * obras)
    });
  }

  var totalPorObra = items.reduce(function (a, b) { return a + b.porObra; }, 0);
  var totalPortfolio = items.reduce(function (a, b) { return a + b.portfolio; }, 0);

  return {
    items: items,
    totalPorObra: totalPorObra,
    totalPortfolio: totalPortfolio
  };
}

function generateLeadOpportunities(row) {
  var state = getState(row);
  var scores = getPhaseScores(row);

  var opps = [];
  var f1 = scores.f1 || [], f2 = scores.f2 || [], f3 = scores.f3 || [], f4 = scores.f4 || [];

  if ((f1[0] || 0) <= 1) opps.push({ gap: 'Sem linha de base técnica com equipes dimensionadas', phase: 'F1', color: '#60a5fa', impact: 'Obras sem LB têm 20–30% mais estouro de prazo. Cada semana de atraso tem custo de oportunidade direto.' });
  if ((f1[1] || 0) <= 1) opps.push({ gap: 'Planejamento sem Linha de Balanço por lotes', phase: 'F1', color: '#60a5fa', impact: 'Impossível visualizar gargalos antecipadamente. Decisões de equipe são feitas no feeling.' });
  if ((f1[4] || 0) <= 1) opps.push({ gap: 'Suprimentos desconectado do planejamento', phase: 'F1', color: '#60a5fa', impact: 'Compras emergenciais têm custo 15–25% maior. Paradas por material faltante são evitáveis.' });
  if ((f1[5] || 0) <= 1) opps.push({ gap: 'Sem acompanhamento estratégico da Curva S', phase: 'F1', color: '#60a5fa', impact: 'Desvios de prazo são identificados semanas tarde. Sem projeção de término, não há decisão estruturada de recuperação.' });
  if ((f1[6] || 0) <= 1) opps.push({ gap: 'Cronograma bancário desconectado do planejamento', phase: 'F1', color: '#60a5fa', impact: 'Retrabalho duplo em toda reprogramação. Exposição de caixa invisível gera risco financeiro não mapeado.' });
  if ((f2[0] || 0) <= 1) opps.push({ gap: 'Sem lookahead estruturado e gestão de restrições', phase: 'F2', color: '#2dd4bf', impact: 'Restrições aparecem quando já atrasaram. Antecipação reduz paradas não planejadas em até 40%.' });
  if ((f3[0] || 0) <= 1) opps.push({ gap: 'Sem plano semanal e cadência diária (Last Planner)', phase: 'F3', color: '#34d399', impact: 'Obra opera sem feedback real. Uma semana de decisão perdida a cada ciclo.' });
  if ((f3[2] || 0) <= 1) opps.push({ gap: 'Avanço físico coletado por estimativa mensal', phase: 'F3', color: '#34d399', impact: 'Dado chega semanas atrasado. Improdutividade de MO invisível até o fechamento.' });
  if ((f4[0] || 0) <= 1) opps.push({ gap: 'Reunião executiva sem dados estruturados', phase: 'F4', color: '#9ca3af', impact: 'Decisões tomadas no feeling. Cada reunião termina com narrativa — não com plano.' });

  return opps.slice(0, 5);
}

function openDetails(index) {
  var row = filteredData[index];
  if (!row) return;

  var state = getState(row);
  var scores = getPhaseScores(row);
  var empresa = getField(row, 'empresa', 'empresa') || 'Diagnóstico';
  var contato = getField(row, 'contato', 'contato') || '—';
  var cargo = getField(row, 'cargo', 'cargo') || '—';
  var email = getField(row, 'email', 'email') || '—';
  var telefone = getField(row, 'telefone', 'telefone') || '—';
  var consultor = getField(row, 'consultor', 'consultor') || '—';
  var numObras = parseInt(row.num_obras || (state && state.numObras) || 0);
  var orcamento = parseFloat(row.orcamento_medio || (state && state.orcamentoMedio) || 0);
  var tipologia = (state && state.tipologia) || '—';
  var modeloMO = (state && state.modeloMO) || '—';
  var momento = (state && state.momento) || '—';
  var totalScore = row.total_score || 0;
  var totalMax = row.total_max || 66;
  var totalPct = totalMax > 0 ? totalScore / totalMax : 0;

  var rawDate = row.created_at || new Date().toISOString();
  var d = new Date(rawDate);
  var dateStr = d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getFullYear() + ' ' + d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');

  document.getElementById('modal-title').textContent = empresa;
  document.getElementById('modal-subtitle').textContent = 'Diagnóstico realizado em ' + dateStr + ' · Consultor: ' + consultor;

  var clientPct = ['f1', 'f2', 'f3', 'f4'].map(function (k) {
    var arr = scores[k];
    if (!Array.isArray(arr)) return 0;
    var sum = arr.reduce(function (a, b) { return a + (b || 0); }, 0);
    return sum / (PHASES[k].max || 1);
  });

  var opps = generateLeadOpportunities(row);
  var oppHtml = '';
  if (opps.length > 0) {
    oppHtml += '<div style="display:grid;grid-template-columns:1fr;gap:10px;">';
    opps.forEach(function (o) {
      oppHtml += '<div style="padding:12px;background:rgba(255,94,30,0.03);border-left:3px solid var(--orange);border-radius:0 8px 8px 0;font-size:12px;">';
      oppHtml += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><strong style="color:white;">' + o.gap + '</strong><span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.05);color:' + o.color + ';font-weight:bold;">' + o.phase + '</span></div>';
      oppHtml += '<div style="color:var(--gray);font-size:11px;line-height:1.4;">' + o.impact + '</div>';
      oppHtml += '</div>';
    });
    oppHtml += '</div>';
  } else {
    oppHtml += '<div style="font-size:12px;color:var(--gray);font-style:italic;">Nenhuma oportunidade identificada (Maturidade ideal).</div>';
  }

  var roiData = calculateLeadROI(row);
  var portfolio = numObras * orcamento;

  var roiHtml = '';
  roiHtml += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">';
  roiHtml += '<div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;text-align:center;"><div style="font-size:9px;color:var(--gray);text-transform:uppercase;margin-bottom:4px;">Portfólio Estimado</div><div style="font-family:Outfit;font-size:14px;font-weight:700;color:white;">' + fmtOrcamento(portfolio) + '</div></div>';
  roiHtml += '<div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;text-align:center;"><div style="font-size:9px;color:var(--gray);text-transform:uppercase;margin-bottom:4px;">Retorno por Obra</div><div style="font-family:Outfit;font-size:14px;font-weight:700;color:var(--green);">' + fmtOrcamento(roiData.totalPorObra) + '</div></div>';
  roiHtml += '<div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:6px;text-align:center;"><div style="font-size:9px;color:var(--gray);text-transform:uppercase;margin-bottom:4px;">Retorno no Portfólio</div><div style="font-family:Outfit;font-size:14px;font-weight:700;color:var(--green);">' + fmtOrcamento(roiData.totalPortfolio) + '</div></div>';
  roiHtml += '</div>';

  roiHtml += '<div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;background:rgba(0,0,0,0.15);">';
  roiHtml += '<table style="width:100%;border-collapse:collapse;text-align:left;font-size:11px;">';
  roiHtml += '<thead><tr style="background:rgba(255,255,255,0.03);"><th style="padding:8px 10px;color:var(--gray);text-transform:uppercase;font-size:9px;">Fonte de Ganho</th><th style="padding:8px 10px;color:var(--gray);text-transform:uppercase;font-size:9px;text-align:center;">Fator</th><th style="padding:8px 10px;color:var(--gray);text-transform:uppercase;font-size:9px;text-align:right;">Por Obra</th><th style="padding:8px 10px;color:var(--gray);text-transform:uppercase;font-size:9px;text-align:right;">Portfólio</th></tr></thead>';
  roiHtml += '<tbody>';
  roiData.items.forEach(function (item, index) {
    var fp = Math.round(item.fator * 100);
    var rowBg = index % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent';
    roiHtml += '<tr style="border-bottom:1px solid var(--border);background:' + rowBg + ';">';
    roiHtml += '<td style="padding:8px 10px;"><strong style="color:white;">' + item.label + '</strong><br><span style="color:var(--gray);font-size:10px;">' + item.basis + '</span></td>';
    roiHtml += '<td style="padding:8px 10px;text-align:center;font-weight:bold;color:var(--orange);">' + fp + '%</td>';
    roiHtml += '<td style="padding:8px 10px;text-align:right;">' + fmtOrcamento(item.porObra) + '</td>';
    roiHtml += '<td style="padding:8px 10px;text-align:right;font-weight:600;color:white;">' + fmtOrcamento(item.portfolio) + '</td>';
    roiHtml += '</tr>';
  });
  roiHtml += '<tr style="background:rgba(255,94,30,0.05);font-weight:bold;">';
  roiHtml += '<td colspan="2" style="padding:10px;color:white;text-transform:uppercase;font-size:10px;">POTENCIAL TOTAL DE GANHO</td>';
  roiHtml += '<td style="padding:10px;text-align:right;color:white;">' + fmtOrcamento(roiData.totalPorObra) + '</td>';
  roiHtml += '<td style="padding:10px;text-align:right;color:var(--green);font-size:12px;">' + fmtOrcamento(roiData.totalPortfolio) + '</td>';
  roiHtml += '</tr>';
  roiHtml += '</tbody></table></div>';

  var html = '';
  html += '<div class="detail-layout">';

  // LEFT COLUMN
  html += '<div class="detail-left">';

  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">';
  html += '<div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;text-align:center;"><div style="font-size:9px;color:var(--gray);text-transform:uppercase;margin-bottom:4px;">Lead Score</div>' + getScoreBadgeHTML(row._leadScore) + '</div>';
  html += '<div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;text-align:center;"><div style="font-size:9px;color:var(--gray);text-transform:uppercase;margin-bottom:4px;">Nível SIIGA</div>' + getNivelBadgeHTML(row._nivel) + '</div>';
  html += '<div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;text-align:center;"><div style="font-size:9px;color:var(--gray);text-transform:uppercase;margin-bottom:4px;">Score Total</div><div style="font-family:Outfit;font-size:15px;font-weight:700;color:' + colorFromPct(totalPct) + ';margin-top:4px;">' + totalScore + '<span style="font-size:11px;color:var(--gray)">/' + totalMax + '</span></div></div>';
  html += '<div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;text-align:center;"><div style="font-size:9px;color:var(--gray);text-transform:uppercase;margin-bottom:4px;">Maturidade</div><div style="font-family:Outfit;font-size:15px;font-weight:700;color:' + colorFromPct(totalPct) + ';margin-top:4px;">' + Math.round(totalPct * 100) + '%</div></div>';
  html += '</div>';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;">';
  html += '<h3 style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Gráfico de Radar SIIGA</h3>';
  html += '<div style="height:320px;position:relative;"><canvas id="radarChartDetails"></canvas></div>';
  html += '</div>';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;">';
  html += '<h3 style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Principais Oportunidades Mapeadas</h3>';
  html += oppHtml;
  html += '</div>';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;">';
  html += '<h3 style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Potencial de Ganhos Estimado (ROI)</h3>';
  html += roiHtml;
  html += '</div>';

  html += '</div>';

  // RIGHT COLUMN
  html += '<div class="detail-right">';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;">';
  html += '<h3 style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Dados do Prospect</h3>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
  html += detailItem('Empresa', empresa);
  html += detailItem('Contato', contato);
  html += detailItem('Cargo', cargo);
  html += detailItem('E-mail', email);
  html += detailItem('Telefone', telefone);
  html += detailItem('Consultor', consultor);
  html += '</div></div>';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;">';
  html += '<h3 style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Contexto Estratégico</h3>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
  html += detailItem('Tipologia', getTipologiaLabel(tipologia));
  html += detailItem('Modelo de MO', modeloMO === 'propria' ? 'Predominantemente Própria' : modeloMO === 'mista' ? 'Modelo Misto' : modeloMO === 'terceirizada' ? 'Predominantemente Empreitada' : modeloMO);
  html += detailItem('Momento', momento === 'crescimento' ? 'Crescimento Acelerado' : momento === 'consolidacao' ? 'Consolidação e Melhoria' : momento === 'estavel' ? 'Operação Estável' : momento);
  html += detailItem('Nº Obras', numObras + ' (' + getObrasRange(numObras) + ')');
  html += detailItem('Orçamento Médio', fmtOrcamento(orcamento));
  html += detailItem('Prazo Médio', (state && state.prazoMedio ? state.prazoMedio + ' meses' : '—'));
  html += detailItem('Estrutura de Time (B0.3)', (scores.b03 !== undefined ? scores.b03 + '/3' : '—'));
  html += detailItem('Estrutura do Orçamento (B0.6)', (scores.b06 !== undefined ? scores.b06 + '/3' : '—'));
  html += '</div></div>';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;">';
  html += '<h3 style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Critérios do Lead Scoring</h3>';
  html += buildScoringExplanation(row);
  html += '</div>';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;">';
  html += '<h3 style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Maturidade por Fase</h3>';

  ['f1', 'f2', 'f3', 'f4'].forEach(function (key) {
    var phase = PHASES[key];
    var phaseScores = scores[key];
    var phaseTotal = sumArray(phaseScores);
    var phasePct = phase.max > 0 ? phaseTotal / phase.max : 0;
    var phaseColor = colorFromPct(phasePct);
    var phaseLevel = levelFromPct(phasePct);

    html += '<div style="margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid var(--border)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    html += '<div style="font-family:Outfit;font-size:12px;font-weight:600;color:' + phase.color + '">' + phase.label + '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span style="font-family:Outfit;font-size:13px;font-weight:700;color:' + phaseColor + '">' + phaseTotal + '/' + phase.max + '</span>';
    html += '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:' + phaseColor + '22;color:' + phaseColor + ';font-weight:600">' + phaseLevel + '</span>';
    html += '</div></div>';

    html += '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;margin-bottom:8px;overflow:hidden">';
    html += '<div style="height:100%;width:' + Math.round(phasePct * 100) + '%;background:' + phaseColor + ';border-radius:3px;transition:width 0.5s"></div>';
    html += '</div>';

    if (Array.isArray(phaseScores)) {
      html += '<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:11px;color:var(--gray);outline:none;">Perguntas individuais</summary>';
      html += '<div style="display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px;">';
      phaseScores.forEach(function (qScore, qi) {
        var qLabel = phase.questions[qi] || ('Pergunta ' + (qi + 1));
        var qPct = qScore / 3;
        var qColor = colorFromPct(qPct);
        html += '<div style="display:flex;align-items:center;gap:10px">';
        html += '<div style="font-size:10px;color:var(--gray);width:160px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + qLabel + '">' + qLabel + '</div>';
        html += '<div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + Math.round(qPct * 100) + '%;background:' + qColor + ';border-radius:2px"></div></div>';
        html += '<div style="font-size:11px;font-weight:600;color:' + qColor + ';width:28px;text-align:right">' + (qScore || 0) + '/3</div>';
        html += '</div>';
      });
      html += '</div></details>';
    }
    html += '</div>';
  });

  if (scores.mo && typeof scores.mo === 'object' && Object.keys(scores.mo).length > 0) {
    var moKeys = Object.keys(scores.mo);
    var moTotal = moKeys.reduce(function (a, k) { return a + (scores.mo[k] || 0); }, 0);
    var moMax = moKeys.length * 3;
    var moPct = moMax > 0 ? moTotal / moMax : 0;
    var moColor = colorFromPct(moPct);
    var moLabels = {
      'MO.1': 'Transparência de metas de ganho',
      'MO.2': 'Visibilidade de improdutividade',
      'MO.3': 'Processo de verba extra',
      'MO.4': 'Tempo de fechamento de folha',
      'MO.5': 'Metas de empreiteiros',
      'MO.6': 'Comunicação de bloqueios',
      'MO.7': 'Tempo de medição'
    };

    html += '<div style="margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid var(--border)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    html += '<div style="font-family:Outfit;font-size:12px;font-weight:600;color:#34d399">Bloco MO · Gestão de Mão de Obra</div>';
    html += '<span style="font-family:Outfit;font-size:13px;font-weight:700;color:' + moColor + '">' + moTotal + '/' + moMax + '</span>';
    html += '</div>';
    html += '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;margin-bottom:8px;overflow:hidden">';
    html += '<div style="height:100%;width:' + Math.round(moPct * 100) + '%;background:' + moColor + ';border-radius:3px"></div></div>';

    html += '<details style="margin-top:6px;"><summary style="cursor:pointer;font-size:11px;color:var(--gray);outline:none;">Perguntas individuais</summary>';
    html += '<div style="display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px;">';
    moKeys.forEach(function (k) {
      var qs = scores.mo[k] || 0;
      var qp = qs / 3;
      var qc = colorFromPct(qp);
      var ql = moLabels[k] || k;
      html += '<div style="display:flex;align-items:center;gap:10px">';
      html += '<div style="font-size:10px;color:var(--gray);width:160px;flex-shrink:0">' + ql + '</div>';
      html += '<div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + Math.round(qp * 100) + '%;background:' + qc + ';border-radius:2px"></div></div>';
      html += '<div style="font-size:11px;font-weight:600;color:' + qc + ';width:28px;text-align:right">' + qs + '/3</div>';
      html += '</div>';
    });
    html += '</div></details></div>';
  }

  html += '</div>';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;">';
  html += '<details><summary style="cursor:pointer;color:var(--orange);font-weight:600;font-family:var(--font-display);font-size:13px;outline:none;">VER DADOS BRUTOS (JSON)</summary>';
  html += '<pre id="modal-json" style="margin-top:14px;background:rgba(0,0,0,0.3);padding:14px;border-radius:8px;overflow-x:auto;font-size:11px;color:#00ffaa;line-height:1.4;"></pre>';
  html += '</details></div>';

  html += '</div>';
  html += '</div>';

  var summary = document.getElementById('modal-summary');
  summary.innerHTML = html;

  document.getElementById('modal-json').textContent = JSON.stringify(state, null, 2);
  document.getElementById('details-modal').style.display = 'flex';

  if (radarChartInstDetails) {
    radarChartInstDetails.destroy();
    radarChartInstDetails = null;
  }

  var ctx = document.getElementById('radarChartDetails').getContext('2d');
  radarChartInstDetails = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4'],
      datasets: [
        {
          label: 'Sua empresa',
          data: clientPct.map(function (p) { return Math.round(p * 100); }),
          borderColor: '#ff5e1e',
          backgroundColor: 'rgba(255,94,30,0.15)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#ff5e1e'
        },
        {
          label: 'Média de mercado',
          data: [45, 38, 35, 30],
          borderColor: 'rgba(255,255,255,0.25)',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderWidth: 1.5,
          pointRadius: 3,
          borderDash: [5, 3]
        },
        {
          label: 'Referência SIIGA',
          data: [90, 85, 88, 82],
          borderColor: '#34d399',
          backgroundColor: 'rgba(52,211,153,0.05)',
          borderWidth: 1.5,
          pointRadius: 3,
          borderDash: [3, 3]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 25,
            color: 'rgba(255,255,255,0.3)',
            backdropColor: 'transparent',
            font: { size: 9 }
          },
          grid: { color: 'rgba(255,255,255,0.08)' },
          angleLines: { color: 'rgba(255,255,255,0.08)' },
          pointLabels: {
            color: 'rgba(255,255,255,0.7)',
            font: { family: 'Outfit', size: 11, weight: '600' }
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#a1a6b0',
            boxWidth: 12,
            font: { size: 10 }
          }
        }
      }
    }
  });
}

function detailItem(label, value) {
  return '<div class="detail-item"><label>' + label + '</label><span>' + (value || '—') + '</span></div>';
}

function buildScoringExplanation(row) {
  var state = getState(row);
  var cargo = getField(row, 'cargo', 'cargo') || '';
  var tipologia = (state && state.tipologia) || '';
  var numObras = parseInt(row.num_obras || (state && state.numObras) || 0);
  var orcamento = parseFloat(row.orcamento_medio || (state && state.orcamentoMedio) || 0);

  var cargoAB = matchCargo(cargo, CARGOS_AB);
  var cargoC = matchCargo(cargo, CARGOS_C);
  var tipoA = TIPOLOGIA_A.indexOf(tipologia) >= 0;
  var tipoB = TIPOLOGIA_B.indexOf(tipologia) >= 0;
  var tipoC = TIPOLOGIA_C.indexOf(tipologia) >= 0;

  var check = '<span style="color:var(--green);font-weight:bold;margin-right:6px">✓</span>';
  var cross = '<span style="color:var(--red);font-weight:bold;margin-right:6px">✗</span>';

  var html = '';

  // Score A Card
  var scoreA_ok = (cargoAB && tipoA && numObras >= 1 && orcamento >= 1000000);
  html += '<div style="margin-bottom:14px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid ' + (scoreA_ok ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255,255,255,0.05)') + '">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  html += '<strong style="color:' + (scoreA_ok ? 'var(--green)' : 'white') + ';font-size:12px">Score A ' + (scoreA_ok ? '(Atingido)' : '') + '</strong>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--gray);display:grid;grid-template-columns:1fr;gap:6px">';
  html += '<div>' + (cargoAB ? check : cross) + 'Cargo Executivo (' + cargo + ')</div>';
  html += '<div>' + (tipoA ? check : cross) + 'Tipologia Residencial Vertical</div>';
  html += '<div>' + (numObras >= 1 ? check : cross) + 'Obras ≥ 1 (' + numObras + ')</div>';
  html += '<div>' + (orcamento >= 1000000 ? check : cross) + 'Orçamento ≥ R$1M (' + fmtOrcamento(orcamento) + ')</div>';
  html += '</div></div>';

  // Score B Card
  var scoreB_ok = (cargoAB && tipoB && numObras >= 1 && orcamento >= 1000000);
  html += '<div style="margin-bottom:14px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid ' + (scoreB_ok ? 'rgba(96, 165, 250, 0.3)' : 'rgba(255,255,255,0.05)') + '">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  html += '<strong style="color:' + (scoreB_ok ? 'var(--blue)' : 'white') + ';font-size:12px">Score B ' + (scoreB_ok ? '(Atingido)' : '') + '</strong>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--gray);display:grid;grid-template-columns:1fr;gap:6px">';
  html += '<div>' + (cargoAB ? check : cross) + 'Cargo Executivo (' + cargo + ')</div>';
  html += '<div>' + (tipoB ? check : cross) + 'Tipologia Comercial/Industrial</div>';
  html += '<div>' + (numObras >= 1 ? check : cross) + 'Obras ≥ 1 (' + numObras + ')</div>';
  html += '<div>' + (orcamento >= 1000000 ? check : cross) + 'Orçamento ≥ R$1M (' + fmtOrcamento(orcamento) + ')</div>';
  html += '</div></div>';

  // Score C Card
  var scoreC_ok = (cargoC && tipoC && numObras >= 5 && orcamento >= 500000);
  html += '<div style="margin-bottom:6px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid ' + (scoreC_ok ? 'rgba(251, 191, 36, 0.3)' : 'rgba(255,255,255,0.05)') + '">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  html += '<strong style="color:' + (scoreC_ok ? 'var(--yellow)' : 'white') + ';font-size:12px">Score C ' + (scoreC_ok ? '(Atingido)' : '') + '</strong>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--gray);display:grid;grid-template-columns:1fr;gap:6px">';
  html += '<div>' + (cargoC ? check : cross) + 'Cargo Executivo/Ampliado (' + cargo + ')</div>';
  html += '<div>' + (tipoC ? check : cross) + 'Tipologia Residencial/Comercial/Diversificado</div>';
  html += '<div>' + (numObras >= 5 ? check : cross) + 'Obras ≥ 5 (' + numObras + ')</div>';
  html += '<div>' + (orcamento >= 500000 ? check : cross) + 'Orçamento ≥ R$500k (' + fmtOrcamento(orcamento) + ')</div>';
  html += '</div></div>';

  return html;
}

function closeModal() {
  document.getElementById('details-modal').style.display = 'none';
  if (radarChartInstDetails) {
    radarChartInstDetails.destroy();
    radarChartInstDetails = null;
  }
}

document.getElementById('details-modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ═══════════════════════════════════════════
//  INSERT TEST RECORDS
// ═══════════════════════════════════════════
async function insertTestRecords() {
  if (!supabaseClient) { alert('Supabase não inicializado'); return; }

  var btn = document.getElementById('btn-test');
  if (btn) { btn.disabled = true; btn.textContent = 'Inserindo...'; }

  var testRecords = [
    {
      id: Date.now(),
      nome: 'Teste Score A — MRV Engenharia',
      empresa: 'MRV ENGENHARIA',
      consultor: 'Lucas Fernandes',
      contato: 'Roberto Silva',
      cargo: 'Diretor de Engenharia',
      email: 'roberto.silva@mrv.com.br',
      telefone: '(85) 99999-1234',
      data: '2026-05-29',
      modelo_mo: 'mista',
      num_obras: 12,
      orcamento_medio: 15000000,
      total_score: 42,
      total_max: 66,
      nivel: 'Estruturado',
      scores: {
        b03: 2, b06: 3,
        f1: [2, 2, 1, 2, 2, 1, 2],
        f2: [2, 2, 2, 2],
        f3: [2, 1, 1, 2, 1, 1],
        f4: [2, 2, 1, 2],
        mo: { 'MO.1': 2, 'MO.2': 1, 'MO.3': 2, 'MO.4': 1, 'MO.5': 2, 'MO.6': 1, 'MO.7': 2 }
      },
      state: {
        empresa: 'MRV ENGENHARIA', consultor: 'Lucas Fernandes', contato: 'Roberto Silva',
        cargo: 'Diretor de Engenharia', email: 'roberto.silva@mrv.com.br', telefone: '(85) 99999-1234',
        data: '2026-05-29', numObras: 12, orcamentoMedio: 15000000, prazoMedio: 24,
        tipologia: 'vert', modeloMO: 'mista', momento: 'crescimento',
        scores: { b03: 2, b06: 3, f1: [2, 2, 1, 2, 2, 1, 2], f2: [2, 2, 2, 2], f3: [2, 1, 1, 2, 1, 1], f4: [2, 2, 1, 2], mo: { 'MO.1': 2, 'MO.2': 1, 'MO.3': 2, 'MO.4': 1, 'MO.5': 2, 'MO.6': 1, 'MO.7': 2 } },
        showMO: true
      }
    },
    {
      id: Date.now() + 1,
      nome: 'Teste Score B — Galpões Nordeste',
      empresa: 'GALPÕES NORDESTE LTDA',
      consultor: 'Ana Costa',
      contato: 'Carlos Mendes',
      cargo: 'Gerente de Projetos',
      email: 'carlos@galpoesnordeste.com.br',
      telefone: '(81) 98888-5678',
      data: '2026-05-28',
      modelo_mo: 'terceirizada',
      num_obras: 6,
      orcamento_medio: 8000000,
      total_score: 22,
      total_max: 66,
      nivel: 'Em Construção',
      scores: {
        b03: 1, b06: 1,
        f1: [1, 1, 0, 1, 0, 0, 1],
        f2: [1, 1, 1, 1],
        f3: [1, 0, 0, 1, 0, 0],
        f4: [1, 1, 0, 1],
        mo: { 'MO.5': 1, 'MO.6': 0, 'MO.7': 1 }
      },
      state: {
        empresa: 'GALPÕES NORDESTE LTDA', consultor: 'Ana Costa', contato: 'Carlos Mendes',
        cargo: 'Gerente de Projetos', email: 'carlos@galpoesnordeste.com.br', telefone: '(81) 98888-5678',
        data: '2026-05-28', numObras: 6, orcamentoMedio: 8000000, prazoMedio: 14,
        tipologia: 'com', modeloMO: 'terceirizada', momento: 'consolidacao',
        scores: { b03: 1, b06: 1, f1: [1, 1, 0, 1, 0, 0, 1], f2: [1, 1, 1, 1], f3: [1, 0, 0, 1, 0, 0], f4: [1, 1, 0, 1], mo: { 'MO.5': 1, 'MO.6': 0, 'MO.7': 1 } },
        showMO: true
      }
    },
    {
      id: Date.now() + 2,
      nome: 'Teste Reativo — Construtora Alfa',
      empresa: 'CONSTRUTORA ALFA',
      consultor: 'Lucas Fernandes',
      contato: 'João Pereira',
      cargo: 'Engenheiro de Obra',
      email: 'joao@alfa.eng.br',
      telefone: '(11) 97777-4321',
      data: '2026-05-27',
      modelo_mo: 'propria',
      num_obras: 3,
      orcamento_medio: 4000000,
      total_score: 12,
      total_max: 66,
      nivel: 'Reativo',
      scores: {
        b03: 0, b06: 0,
        f1: [0, 0, 0, 0, 1, 0, 0],
        f2: [0, 0, 1, 0],
        f3: [0, 0, 0, 1, 0, 0],
        f4: [0, 0, 0, 0],
        mo: { 'MO.1': 0, 'MO.2': 0, 'MO.3': 1, 'MO.4': 0 }
      },
      state: {
        empresa: 'CONSTRUTORA ALFA', consultor: 'Lucas Fernandes', contato: 'João Pereira',
        cargo: 'Engenheiro de Obra', email: 'joao@alfa.eng.br', telefone: '(11) 97777-4321',
        data: '2026-05-27', numObras: 3, orcamentoMedio: 4000000, prazoMedio: 12,
        tipologia: 'horiz', modeloMO: 'propria', momento: 'estavel',
        scores: { b03: 0, b06: 0, f1: [0, 0, 0, 0, 1, 0, 0], f2: [0, 0, 1, 0], f3: [0, 0, 0, 1, 0, 0], f4: [0, 0, 0, 0], mo: { 'MO.1': 0, 'MO.2': 0, 'MO.3': 1, 'MO.4': 0 } },
        showMO: true
      }
    }
  ];

  try {
    for (var i = 0; i < testRecords.length; i++) {
      var rec = testRecords[i];
      var result = await supabaseClient.from('assessments').insert([rec]);
      if (result.error) {
        console.error('Erro ao inserir teste ' + (i + 1) + ':', result.error);
      } else {
        console.log('Teste ' + (i + 1) + ' inserido com sucesso');
      }
    }
    alert('3 registros de teste inseridos com sucesso!');
    fetchData();
  } catch (err) {
    console.error('Erro:', err);
    alert('Erro ao inserir testes: ' + err.message);
  }

  if (btn) { btn.disabled = false; btn.textContent = '＋ Inserir Testes'; }
}

// ═══════════════════════════════════════════
//  SELECTION & EXPORT TO CSV
// ═══════════════════════════════════════════
function toggleRowSelect(checkbox, id) {
  var strId = String(id);
  if (checkbox.checked) {
    if (selectedIds.indexOf(strId) < 0) selectedIds.push(strId);
  } else {
    selectedIds = selectedIds.filter(function (x) { return x !== strId; });
  }
  updateSelectAllCheckbox();
  updateExportButtonState();
}

function toggleSelectAll(masterCheckbox) {
  filteredData.forEach(function (row) {
    var strId = String(row.id);
    if (masterCheckbox.checked) {
      if (selectedIds.indexOf(strId) < 0) selectedIds.push(strId);
    } else {
      selectedIds = selectedIds.filter(function (x) { return x !== strId; });
    }
  });
  renderTable();
  updateExportButtonState();
}

function updateSelectAllCheckbox() {
  var master = document.getElementById('check-all');
  if (!master) return;

  if (filteredData.length === 0) {
    master.checked = false;
    master.disabled = true;
    return;
  }
  master.disabled = false;

  var allFilteredSelected = filteredData.every(function (row) {
    return selectedIds.indexOf(String(row.id)) >= 0;
  });
  master.checked = allFilteredSelected;
}

function updateExportButtonState() {
  var btn = document.getElementById('btn-export');
  var btnDel = document.getElementById('btn-delete-selected');
  if (selectedIds.length > 0) {
    if (btn) {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
      btn.textContent = '📥 Exportar Selecionados (' + selectedIds.length + ') em CSV';
    }
    if (btnDel) {
      btnDel.style.opacity = '1';
      btnDel.style.pointerEvents = 'auto';
      btnDel.textContent = '🗑️ Excluir Selecionados (' + selectedIds.length + ')';
    }
  } else {
    if (btn) {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
      btn.textContent = '📥 Exportar Selecionados (CSV)';
    }
    if (btnDel) {
      btnDel.style.opacity = '0.5';
      btnDel.style.pointerEvents = 'none';
      btnDel.textContent = '🗑️ Excluir Selecionados';
    }
  }
}

function exportSelectedCSV() {
  if (selectedIds.length === 0) {
    alert('Nenhum registro selecionado para exportação.');
    return;
  }

  var exportRows = allData.filter(function (row) {
    return selectedIds.indexOf(String(row.id)) >= 0;
  });

  var headers = [
    'ID', 'Data', 'Empresa', 'Contato', 'Cargo', 'E-mail', 'Telefone',
    'Consultor', 'Nivel', 'Lead Score', 'N_Obras', 'Orcamento_Medio',
    'Tipologia', 'Modelo_MO', 'Momento', 'Total_Score', 'Maturidade_Pct'
  ];

  var csvLines = [];
  csvLines.push(headers.join(';'));

  exportRows.forEach(function (row) {
    var state = getState(row);
    var totalScore = row.total_score || 0;
    var totalMax = row.total_max || 66;
    var totalPct = totalMax > 0 ? (totalScore / totalMax) : 0;
    var maturityPct = Math.round(totalPct * 100) + '%';

    var line = [
      row.id,
      row.created_at || '',
      '"' + (row.empresa || '').replace(/"/g, '""') + '"',
      '"' + (row.contato || '').replace(/"/g, '""') + '"',
      '"' + (row.cargo || '').replace(/"/g, '""') + '"',
      '"' + (row.email || '').replace(/"/g, '""') + '"',
      row.telefone || '',
      '"' + (row.consultor || '').replace(/"/g, '""') + '"',
      row.nivel || '',
      row._leadScore || 'Nenhum',
      row.num_obras || (state && state.numObras) || 0,
      row.orcamento_medio || (state && state.orcamentoMedio) || 0,
      getTipologiaLabel((state && state.tipologia) || ''),
      (state && state.modeloMO) || '',
      (state && state.momento) || '',
      totalScore,
      maturityPct
    ];

    csvLines.push(line.join(';'));
  });

  var csvContent = '\uFEFF' + csvLines.join('\n');
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);

  var link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'diagnosticos_siiga_selecionados.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function deleteSelected() {
  if (selectedIds.length === 0) {
    alert('Nenhum registro selecionado para exclusão.');
    return;
  }

  if (!confirm('Tem certeza de que deseja excluir permanentemente os ' + selectedIds.length + ' registros selecionados? Essa ação não pode ser desfeita.')) {
    return;
  }

  var btnDel = document.getElementById('btn-delete-selected');
  var originalText = btnDel.textContent;
  btnDel.textContent = 'Excluindo...';
  btnDel.style.pointerEvents = 'none';

  try {
    var errorCount = 0;
    var rlsCount = 0;
    for (var i = 0; i < selectedIds.length; i++) {
      var id = selectedIds[i];
      var result = await supabaseClient
        .from('assessments')
        .delete()
        .eq('id', Number(id))
        .select();

      if (result.error) {
        console.error('Erro ao excluir ID ' + id + ':', result.error);
        errorCount++;
      } else if (!result.data || result.data.length === 0) {
        console.warn('Nenhum registro excluído para o ID ' + id + '. Possível bloqueio de RLS.');
        rlsCount++;
      } else {
        allData = allData.filter(function (r) { return r.id != id; });
      }
    }

    if (rlsCount > 0) {
      alert('Erro: A exclusão de ' + rlsCount + ' registro(s) foi negada pelas políticas de Row Level Security (RLS) do Supabase. Verifique se a política de DELETE está habilitada.');
    } else if (errorCount > 0) {
      alert('Aviso: ' + errorCount + ' registro(s) não puderam ser excluídos. Verifique o console para mais detalhes.');
    } else {
      alert(selectedIds.length + ' registro(s) excluído(s) com sucesso!');
    }

    selectedIds = [];
    updateStats();
    applyFilters();
  } catch (err) {
    console.error('Erro ao excluir selecionados:', err);
    alert('Erro ao excluir registros: ' + err.message);
  } finally {
    if (btnDel) {
      btnDel.textContent = originalText;
      btnDel.style.pointerEvents = 'auto';
    }
    updateExportButtonState();
  }
}

// ═══════════════════════════════════════════
//  ACTIONS DROPDOWN MENU
// ═══════════════════════════════════════════
function toggleActionMenu(event, index) {
  event.stopPropagation();
  var menu = document.getElementById('action-menu-' + index);
  var isAlreadyOpen = menu.style.display === 'block';
  closeAllActionMenus();
  if (!isAlreadyOpen) {
    menu.style.display = 'block';
  }
}

function closeAllActionMenus() {
  var menus = document.querySelectorAll('.action-dropdown');
  menus.forEach(function (m) {
    m.style.display = 'none';
  });
}

function handleAction(action, index) {
  closeAllActionMenus();
  if (action === 'view') {
    openDetails(index);
  } else if (action === 'edit') {
    openEditModal(index);
  } else if (action === 'delete') {
    var row = filteredData[index];
    if (row) {
      deleteRow(row.id, row.empresa || 'Diagnóstico');
    }
  }
}

// Close menus when clicking anywhere else
document.addEventListener('click', function () {
  closeAllActionMenus();
});

// ═══════════════════════════════════════════
//  EDIT MODAL LOGIC
// ═══════════════════════════════════════════
function openEditModal(index) {
  var row = filteredData[index];
  if (!row) return;

  var state = getState(row);

  document.getElementById('edit-id').value = row.id;
  document.getElementById('edit-empresa').value = getField(row, 'empresa', 'empresa');
  document.getElementById('edit-contato').value = getField(row, 'contato', 'contato');
  document.getElementById('edit-cargo').value = getField(row, 'cargo', 'cargo');
  document.getElementById('edit-email').value = getField(row, 'email', 'email');
  document.getElementById('edit-telefone').value = getField(row, 'telefone', 'telefone');
  document.getElementById('edit-consultor').value = getField(row, 'consultor', 'consultor');
  document.getElementById('edit-num-obras').value = row.num_obras || (state && state.numObras) || 0;
  document.getElementById('edit-orcamento').value = row.orcamento_medio || (state && state.orcamentoMedio) || 0;
  document.getElementById('edit-tipologia').value = (state && state.tipologia) || 'vert';
  document.getElementById('edit-modelo-mo').value = (state && state.modeloMO) || 'propria';
  document.getElementById('edit-momento').value = (state && state.momento) || 'crescimento';

  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

async function saveEdit() {
  var id = document.getElementById('edit-id').value;
  var row = allData.find(function (r) { return r.id == id; });
  if (!row) return;

  var state = getState(row);

  var empresa = document.getElementById('edit-empresa').value;
  var contato = document.getElementById('edit-contato').value;
  var cargo = document.getElementById('edit-cargo').value;
  var email = document.getElementById('edit-email').value;
  var telefone = document.getElementById('edit-telefone').value;
  var consultor = document.getElementById('edit-consultor').value;
  var numObras = parseInt(document.getElementById('edit-num-obras').value || 0);
  var orcamento = parseFloat(document.getElementById('edit-orcamento').value || 0);
  var tipologia = document.getElementById('edit-tipologia').value;
  var modeloMO = document.getElementById('edit-modelo-mo').value;
  var momento = document.getElementById('edit-momento').value;

  row.empresa = empresa;
  row.contato = contato;
  row.cargo = cargo;
  row.email = email;
  row.telefone = telefone;
  row.consultor = consultor;
  row.num_obras = numObras;
  row.orcamento_medio = orcamento;

  state.empresa = empresa;
  state.contato = contato;
  state.cargo = cargo;
  state.email = email;
  state.telefone = telefone;
  state.consultor = consultor;
  state.numObras = numObras;
  state.orcamentoMedio = orcamento;
  state.tipologia = tipologia;
  state.modeloMO = modeloMO;
  state.momento = momento;

  row.state = state;
  row._leadScore = calcLeadScore(row);

  var totalScore = row.total_score || 0;
  var totalMax = row.total_max || 66;
  row.nivel = levelFromPct(totalScore / totalMax);
  row._nivel = row.nivel;

  try {
    var updatePayload = {
      empresa: row.empresa,
      contato: row.contato,
      cargo: row.cargo,
      email: row.email,
      telefone: row.telefone,
      consultor: row.consultor,
      num_obras: row.num_obras,
      orcamento_medio: row.orcamento_medio,
      nivel: row.nivel,
      state: row.state
    };

    var result = await supabaseClient
      .from('assessments')
      .update(updatePayload)
      .eq('id', Number(id))
      .select();

    if (result.error) throw result.error;

    if (!result.data || result.data.length === 0) {
      alert('Erro: A atualização foi negada pelas políticas de Row Level Security (RLS) do Supabase. Verifique se a política de UPDATE está habilitada.');
      return;
    }

    alert('Diagnóstico atualizado com sucesso!');
    closeEditModal();
    updateStats();
    applyFilters();
  } catch (err) {
    console.error('Erro ao salvar edição:', err);
    alert('Erro ao salvar alterações: ' + err.message);
  }
}

// ═══════════════════════════════════════════
//  DELETE RECORD
// ═══════════════════════════════════════════
async function deleteRow(id, name) {
  if (!confirm('Tem certeza de que deseja excluir permanentemente o diagnóstico da empresa "' + name + '"?')) return;

  try {
    var result = await supabaseClient
      .from('assessments')
      .delete()
      .eq('id', Number(id))
      .select();

    if (result.error) throw result.error;

    if (!result.data || result.data.length === 0) {
      alert('Erro: A exclusão foi negada pelas políticas de Row Level Security (RLS) do Supabase. Verifique se a política de DELETE está habilitada.');
      return;
    }

    alert('Diagnóstico excluído com sucesso!');
    allData = allData.filter(function (r) { return r.id != id; });
    selectedIds = selectedIds.filter(function (x) { return x != id; });
    updateStats();
    applyFilters();
  } catch (err) {
    console.error('Erro ao excluir:', err);
    alert('Erro ao excluir registro: ' + err.message);
  }
}
