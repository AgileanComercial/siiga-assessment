// ═══════════════════════════════════════════
//  SUPABASE SETUP
// ═══════════════════════════════════════════
const SUPABASE_URL = 'https://ghtdfhupjoddfwiqzdpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGRmaHVwam9kZGZ3aXF6ZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjY4MTYsImV4cCI6MjA5NTMwMjgxNn0.d0FDQk-P_xTWslTN2zIfxi8wNpxpf1Xwz5AhX3cnUnc';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let allData = [];
let filteredData = [];
let selectedIds = [];
let currentDetailRow = null;

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
  // Nomenclatura antiga (registros salvos antes da recalibração) mapeada para os novos níveis.
  if (nivel === 'Reativo' || nivel.indexOf('Crítico') >= 0 || nivel.indexOf('Critico') >= 0) return '<span class="badge-nivel nivel-critico">Crítico / Vulnerável</span>';
  if (nivel === 'Em Construção' || nivel.indexOf('Operação Artesanal') >= 0 || nivel.indexOf('Operacao Artesanal') >= 0) return '<span class="badge-nivel nivel-artesanal">Operação Artesanal</span>';
  if (nivel.indexOf('Parcialmente Estruturado') >= 0) return '<span class="badge-nivel nivel-parcial">Parcialmente Estruturado</span>';
  if (nivel === 'Estruturado' || nivel.indexOf('Perdas Ocultas') >= 0) return '<span class="badge-nivel nivel-estruturado">Estruturado</span>';
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
  f1: { label: 'Pilar 1 · Planejamento Estratégico', color: '#60a5fa', max: 21, qCount: 7,
    questions: ['Planejamento formal', 'Técnica de planejamento', 'Dimensionamento de duração', 'Integração orçamento × plano', 'Análise da Curva S', 'Cronograma bancário', 'Integração com suprimentos'] },
  f2: { label: 'Pilar 2 · Proteção da Execução', color: '#2dd4bf', max: 9, qCount: 3,
    questions: ['Lookahead / antecipação de restrições', 'Confirmação de equipes', 'Reprogramação formal'] },
  f3: { label: 'Pilar 3 · Gestão da Produção', color: '#34d399', max: 15, qCount: 5,
    questions: ['Programação semanal', 'Check-in / Check-out e causa raiz', 'Frequência coleta avanço', 'Qualidade × avanço físico', 'Análise intermediária de PPC'] },
  f4: { label: 'Pilar 4 · Controle e Performance', color: '#9ca3af', max: 12, qCount: 4,
    questions: ['Reunião de fechamento técnico', 'Reunião executiva com diretoria', 'Painel integrado de indicadores', 'Governança financeira (ERP)'] }
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

// Score total = soma dos 4 pilares (máx. 57), mesma regra de
// getMaturityScoreSummary() em script.js. Registros antigos foram gravados com
// total_max 60 (incluía a B0.3) — recalcula a partir das respostas para o
// painel mostrar o mesmo número do radar e do relatório.
function normalizeTotalScore(row) {
  var scores = getPhaseScores(row);
  var total = 0, max = 0;
  ['f1', 'f2', 'f3', 'f4'].forEach(function (k) {
    total += sumArray(scores[k]);
    max += PHASES[k].max;
  });
  row.total_score = total;
  row.total_max = max;
  if (row.nivel && row.nivel !== 'Incompleto') row.nivel = levelFromPct(total / max);
}

function levelFromPct(p) {
  if (p < 0.40) return 'Crítico / Vulnerável';
  if (p < 0.60) return 'Operação Artesanal / Risco de Desvio';
  if (p < 0.75) return 'Parcialmente Estruturado (Gargalos de Escala)';
  if (p < 0.90) return 'Estruturado com Perdas Ocultas';
  return 'Referência SIIGA / Alta Performance';
}

function colorFromPct(p) {
  if (p < 0.40) return '#ef4444';
  if (p < 0.60) return '#f97316';
  if (p < 0.75) return '#eab308';
  if (p < 0.90) return '#3b82f6';
  return '#10b981';
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
      normalizeTotalScore(row);
      row._leadScore = calcLeadScore(row);
      row._nivel = getNivel(row);
    });

    selectedIds = []; // clear selection on fetch
    populateConsultorFilter();
    updateStats();
    applyFilters();
    renderPendingLocal();
  } catch (err) {
    console.error('Error fetching data:', err);
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#ff4444">Erro ao carregar dados: ' + err.message + '</td></tr>';
  }
}

// ═══════════════════════════════════════════
//  DIAGNÓSTICOS PRESOS NESTE DISPOSITIVO
// ═══════════════════════════════════════════
// Quando o Supabase está fora do ar, o diagnóstico é salvo no localStorage do
// navegador do consultor e nunca chega ao painel. Foi o que aconteceu entre
// 03/09 e 10/09 de 2026: a recuperação exigiu colar script no console, o que não
// se pode pedir a um vendedor em campo.
//
// admin.html e index.html são a mesma origem, então o painel enxerga o
// localStorage gravado pela ferramenta de diagnóstico.

var LOCAL_KEY = 'siiga_diagnosticos';

function getLocalDiagnosticos() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); }
  catch (e) { return []; }
}

// Mesmo mapeamento local -> colunas usado pelo script.js. Mantenha os dois iguais.
function localToRow(rec) {
  return {
    id: rec.id,
    nome: rec.nome,
    empresa: rec.empresa,
    consultor: rec.consultor,
    contato: rec.contato,
    cargo: rec.cargo || '',
    email: rec.email || '',
    telefone: rec.telefone || '',
    data: rec.data,
    modelo_mo: rec.modeloMO,
    num_obras: rec.numObras,
    orcamento_medio: rec.orcamentoMedio,
    total_score: rec.totalScore,
    total_max: rec.totalMax,
    nivel: rec.nivel,
    scores: rec.scores,
    state: rec.state
  };
}

function getPendingLocal() {
  var remotos = {};
  allData.forEach(function (r) { remotos[r.id] = true; });
  return getLocalDiagnosticos().filter(function (r) { return !remotos[r.id]; });
}

function renderPendingLocal() {
  var box = document.getElementById('pending-local');
  if (!box) return;
  var pendentes = getPendingLocal();
  if (!pendentes.length) { box.innerHTML = ''; return; }

  var itens = pendentes.map(function (r) {
    var rotulo = (r.empresa || r.nome || 'sem nome') + ' · ' + (r.consultor || 'sem consultor');
    return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid rgba(248,113,113,0.2)">' +
      '<div style="flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + rotulo + '</div>' +
      '<button class="btn btn-sm" onclick="resendLocal(' + r.id + ')" style="background:#f87171;color:#14141b;border:none;font-weight:700;flex-shrink:0">Reenviar</button>' +
    '</div>';
  }).join('');

  box.innerHTML =
    '<div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.35);border-radius:8px;padding:16px 20px;margin-bottom:20px">' +
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:6px">' +
        '<div style="flex:1;min-width:220px">' +
          '<div style="font-size:15px;font-weight:700;color:#f87171">' +
            pendentes.length + ' diagnóstico(s) neste dispositivo não estão no painel' +
          '</div>' +
          '<div style="font-size:12px;color:var(--gray);margin-top:2px">' +
            'Foram feitos neste computador enquanto o painel estava fora do ar. O restante do time não os enxerga.' +
          '</div>' +
        '</div>' +
        '<button class="btn btn-sm" onclick="resendAllLocal()" style="background:#f87171;color:#14141b;border:none;font-weight:700;flex-shrink:0">Reenviar todos</button>' +
      '</div>' +
      itens +
    '</div>';
}

async function resendLocal(id) {
  if (!supabaseClient) { alert('Supabase não inicializado.'); return; }
  var rec = getLocalDiagnosticos().find(function (r) { return r.id === id; });
  if (!rec) return;
  // upsert para ser seguro de repetir: se já estiver lá, atualiza em vez de
  // estourar erro de chave duplicada.
  var res = await supabaseClient.from('assessments').upsert([localToRow(rec)]);
  if (res.error) {
    console.error('Reenvio falhou:', res.error);
    alert('Não foi possível reenviar: ' + res.error.message);
    return;
  }
  fetchData();
}

async function resendAllLocal() {
  if (!supabaseClient) { alert('Supabase não inicializado.'); return; }
  var pendentes = getPendingLocal();
  if (!pendentes.length) return;
  var ok = 0, falhas = 0;
  for (var i = 0; i < pendentes.length; i++) {
    var res = await supabaseClient.from('assessments').upsert([localToRow(pendentes[i])]);
    if (res.error) { falhas++; console.error('Reenvio falhou:', pendentes[i].empresa, res.error); }
    else { ok++; }
  }
  if (falhas) alert(ok + ' enviado(s), ' + falhas + ' com falha. Veja o console para o motivo.');
  fetchData();
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
      // Compatível com registros salvos antes da recalibração (nomenclatura antiga de nível).
      if (nivelFilter.indexOf('Referência') >= 0) { if (rn.indexOf('Referência') < 0 && rn.indexOf('Referencia') < 0) return false; }
      else if (nivelFilter.indexOf('Crítico') >= 0) { if (rn !== 'Reativo' && rn.indexOf('Crítico') < 0 && rn.indexOf('Critico') < 0) return false; }
      else if (nivelFilter.indexOf('Operação Artesanal') >= 0) { if (rn !== 'Em Construção' && rn.indexOf('Operação Artesanal') < 0 && rn.indexOf('Operacao Artesanal') < 0) return false; }
      else if (nivelFilter.indexOf('Parcialmente Estruturado') >= 0) { if (rn.indexOf('Parcialmente Estruturado') < 0) return false; }
      else if (nivelFilter.indexOf('Perdas Ocultas') >= 0) { if (rn !== 'Estruturado' && rn.indexOf('Perdas Ocultas') < 0) return false; }
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
          '<a onclick="handleAction(\'pdf-resumido\', ' + index + ')">🖨️ Gerar PDF Resumido</a>' +
          '<a onclick="handleAction(\'pdf-detalhado\', ' + index + ')">🖥️ Gerar PDF Detalhado</a>' +
          '<a onclick="handleAction(\'export-questions\', ' + index + ')">📥 Exportar Perguntas (CSV)</a>' +
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

  var maxes = { f1: 21, f2: 9, f3: 15, f4: 12 };

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

// ═══════════════════════════════════════════
//  CSV DE PERGUNTAS DO LEAD (exportação individual)
// ═══════════════════════════════════════════
var MO_QUESTION_LABELS = {
  'MO.1': 'Transparência de metas de ganho',
  'MO.2': 'Visibilidade de improdutividade',
  'MO.3': 'Processo de verba extra',
  'MO.4': 'Tempo de fechamento de folha',
  'MO.5': 'Metas de empreiteiros',
  'MO.6': 'Comunicação de bloqueios',
  'MO.7': 'Tempo de medição'
};

function csvField(v) {
  return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}

function exportLeadQuestionsCSV() {
  var row = currentDetailRow;
  if (!row) { alert('Abra os Detalhes de um diagnóstico antes de exportar.'); return; }

  var state = getState(row);
  var scores = getPhaseScores(row);
  var empresa = getField(row, 'empresa', 'empresa') || 'Diagnóstico';
  var contato = getField(row, 'contato', 'contato') || '—';
  var cargo = getField(row, 'cargo', 'cargo') || '—';
  var consultor = getField(row, 'consultor', 'consultor') || '—';
  var rawDate = row.created_at || new Date().toISOString();
  var d = new Date(rawDate);
  var dateStr = d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear();

  var lines = [];
  lines.push([csvField('Empresa'), csvField(empresa)].join(';'));
  lines.push([csvField('Contato'), csvField(contato + (cargo && cargo !== '—' ? ' (' + cargo + ')' : ''))].join(';'));
  lines.push([csvField('Consultor'), csvField(consultor)].join(';'));
  lines.push([csvField('Data do diagnóstico'), csvField(dateStr)].join(';'));
  lines.push('');
  lines.push([csvField('Pilar'), csvField('Pergunta'), csvField('Score'), csvField('Score Máximo')].join(';'));

  ['f1', 'f2', 'f3', 'f4'].forEach(function(key) {
    var phase = PHASES[key];
    var phaseScores = scores[key];
    if (!Array.isArray(phaseScores)) return;
    phaseScores.forEach(function(qScore, qi) {
      var qLabel = phase.questions[qi] || ('Pergunta ' + (qi + 1));
      lines.push([csvField(phase.label), csvField(qLabel), csvField(qScore != null ? qScore : ''), csvField(3)].join(';'));
    });
  });

  if (scores.mo && typeof scores.mo === 'object') {
    Object.keys(scores.mo).forEach(function(k) {
      var qLabel = MO_QUESTION_LABELS[k] || k;
      lines.push([csvField('Bloco MO · Gestão de Mão de Obra'), csvField(qLabel), csvField(scores.mo[k] != null ? scores.mo[k] : ''), csvField(3)].join(';'));
    });
  }

  var csvContent = '﻿' + lines.join('\n');
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);

  var link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'diagnostico_' + empresa.replace(/[^a-z0-9]+/gi, '_') + '.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openDetails(index) {
  var row = filteredData[index];
  if (!row) return;
  currentDetailRow = row;

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
  var totalMax = row.total_max || 60;
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
  html += '</div></div>';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;">';
  html += '<h3 style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Critérios do Lead Scoring</h3>';
  html += buildScoringExplanation(row);
  html += '</div>';

  html += '<div style="background:rgba(255,255,255,0.01);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;">';
  html += '<h3 style="font-family:var(--font-display);font-size:13px;color:var(--orange);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em;">Maturidade por Pilar</h3>';

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
      labels: ['Pilar 1', 'Pilar 2', 'Pilar 3', 'Pilar 4'],
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
          data: [70, 62, 55, 58],
          borderColor: 'rgba(255,255,255,0.25)',
          backgroundColor: 'rgba(255,255,255,0.03)',
          borderWidth: 1.5,
          pointRadius: 3,
          borderDash: [5, 3]
        },
        {
          label: 'Referência SIIGA',
          data: [92, 88, 90, 85],
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
      total_score: 34,
      total_max: 60,
      nivel: 'Operação Artesanal / Risco de Desvio',
      scores: {
        b03: 2,
        f1: [2, 2, 1, 2, 2, 1, 2],
        f2: [2, 2, 2],
        f3: [2, 1, 2, 1, 1],
        f4: [2, 2, 1, 2],
        mo: { 'MO.1': 2, 'MO.2': 1, 'MO.3': 2, 'MO.4': 1, 'MO.5': 2, 'MO.6': 1, 'MO.7': 2 }
      },
      state: {
        empresa: 'MRV ENGENHARIA', consultor: 'Lucas Fernandes', contato: 'Roberto Silva',
        cargo: 'Diretor de Engenharia', email: 'roberto.silva@mrv.com.br', telefone: '(85) 99999-1234',
        data: '2026-05-29', numObras: 12, orcamentoMedio: 15000000, prazoMedio: 24,
        tipologia: 'vert', modeloMO: 'mista', momento: 'crescimento',
        scores: { b03: 2, f1: [2,2,1,2,2,1,2], f2: [2,2,2], f3: [2,1,2,1,1], f4: [2,2,1,2], mo: { 'MO.1':2,'MO.2':1,'MO.3':2,'MO.4':1,'MO.5':2,'MO.6':1,'MO.7':2 } },
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
      total_score: 13,
      total_max: 60,
      nivel: 'Crítico / Vulnerável',
      scores: {
        b03: 1,
        f1: [1, 1, 0, 1, 0, 0, 1],
        f2: [1, 1, 1],
        f3: [1, 0, 1, 0, 0],
        f4: [1, 1, 0, 1],
        mo: { 'MO.5': 1, 'MO.6': 0, 'MO.7': 1 }
      },
      state: {
        empresa: 'GALPÕES NORDESTE LTDA', consultor: 'Ana Costa', contato: 'Carlos Mendes',
        cargo: 'Gerente de Projetos', email: 'carlos@galpoesnordeste.com.br', telefone: '(81) 98888-5678',
        data: '2026-05-28', numObras: 6, orcamentoMedio: 8000000, prazoMedio: 14,
        tipologia: 'com', modeloMO: 'terceirizada', momento: 'consolidacao',
        scores: { b03: 1, f1: [1,1,0,1,0,0,1], f2: [1,1,1], f3: [1,0,1,0,0], f4: [1,1,0,1], mo: { 'MO.5':1,'MO.6':0,'MO.7':1 } },
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
      total_score: 2,
      total_max: 60,
      nivel: 'Crítico / Vulnerável',
      scores: {
        b03: 0,
        f1: [0, 0, 0, 0, 1, 0, 0],
        f2: [0, 0, 0],
        f3: [0, 0, 1, 0, 0],
        f4: [0, 0, 0, 0],
        mo: { 'MO.1': 0, 'MO.2': 0, 'MO.3': 1, 'MO.4': 0 }
      },
      state: {
        empresa: 'CONSTRUTORA ALFA', consultor: 'Lucas Fernandes', contato: 'João Pereira',
        cargo: 'Engenheiro de Obra', email: 'joao@alfa.eng.br', telefone: '(11) 97777-4321',
        data: '2026-05-27', numObras: 3, orcamentoMedio: 4000000, prazoMedio: 12,
        tipologia: 'horiz', modeloMO: 'propria', momento: 'estavel',
        scores: { b03: 0, f1: [0,0,0,0,1,0,0], f2: [0,0,0], f3: [0,0,1,0,0], f4: [0,0,0,0], mo: { 'MO.1':0,'MO.2':0,'MO.3':1,'MO.4':0 } },
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
    var totalMax = row.total_max || 60;
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
  } else if (action === 'pdf-resumido') {
    var row = filteredData[index];
    if (row) window.open('/?admin_pdf=' + row.id + '&pdf_mode=resumido', '_blank');
  } else if (action === 'pdf-detalhado') {
    var row = filteredData[index];
    if (row) window.open('/?admin_pdf=' + row.id + '&pdf_mode=detalhado', '_blank');
  } else if (action === 'export-questions') {
    var row = filteredData[index];
    if (row) {
      currentDetailRow = row;
      exportLeadQuestionsCSV();
    }
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
  var totalMax = row.total_max || 60;
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

// ═══════════════════════════════════════════
//  ABAS
// ═══════════════════════════════════════════
var agCarregado = false;
function showTab(nome) {
  ['diagnosticos', 'agendamentos'].forEach(function (t) {
    document.getElementById('tab-' + t).style.display = t === nome ? '' : 'none';
    document.getElementById('tabbtn-' + t).classList.toggle('active', t === nome);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.diag-only'), function (b) {
    b.style.display = nome === 'diagnosticos' ? '' : 'none';
  });
  if (nome === 'agendamentos' && !agCarregado) { agCarregado = true; initAgendamentos(); }
}

// ═══════════════════════════════════════════
//  AGENDAMENTOS (material prévio do diagnóstico)
// ═══════════════════════════════════════════
// O pré-vendedor registra a reunião agendada, gera o PDF "Preparação para o
// Diagnóstico SIIGA" (material-previo.js) e copia as mensagens de envio.
// Tabela Supabase: agendamentos (migração em supabase/agendamentos.sql).

// Consultores especialistas. WhatsApp só com dígitos (DDI + DDD + número); a
// exibição formata com mpvFone(). O cargo é só informativo na lista: PDF e
// mensagens tratam todos como "consultor da Agilean". Um consultor sem e-mail ou
// WhatsApp bloqueia a geração do PDF (o contato vai na capa do documento).
var CONSULTORES = [
  { nome: 'Felipe Façanha', cargo: '', email: 'felipe@agilean.com.br', whatsapp: '5585999183131' },
  { nome: 'Adailton Azevedo', cargo: '', email: 'adailton@agilean.com.br', whatsapp: '5511959679191' },
  { nome: 'Israel Chacon', cargo: 'Head Comercial', email: 'israel@agilean.com.br', whatsapp: '5511978119471' }
];
// Quem assina as mensagens de envio.
var PRE_VENDEDORES = [
  { nome: 'Thifany Araujo' },
  { nome: 'Hermeson Xavier' }
];

var agData = [];
var agTabelaOk = true;
var AG_STATUS = { agendado: 'Agendado', realizado: 'Realizado', cancelado: 'Cancelado' };

function agEl(id) { return document.getElementById(id); }
function agVal(id) { return agEl(id).value.trim(); }

function agMaskPhone(input) {
  var d = input.value.replace(/\D/g, '').slice(0, 11);
  if (d.length > 10) input.value = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  else if (d.length > 6) input.value = '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  else if (d.length > 2) input.value = '(' + d.slice(0, 2) + ') ' + d.slice(2);
  else input.value = d;
}

function agOptions(select, lista, rotulo) {
  select.innerHTML = '';
  var vazio = document.createElement('option');
  vazio.value = ''; vazio.textContent = 'Selecione...';
  select.appendChild(vazio);
  lista.forEach(function (p) {
    var o = document.createElement('option');
    o.value = p.nome; o.textContent = rotulo ? rotulo(p) : p.nome;
    select.appendChild(o);
  });
}

function initAgendamentos() {
  agOptions(agEl('ag-consultor'), CONSULTORES, function (c) { return c.nome + (c.cargo ? ' · ' + c.cargo : ''); });
  agOptions(agEl('ag-prevendedor'), PRE_VENDEDORES);
  fetchModelos();
  fetchAgendamentos();
}

function agAviso(msg) {
  var box = agEl('ag-aviso');
  box.innerHTML = '';
  if (!msg) return;
  var d = document.createElement('div');
  d.className = 'ag-aviso'; d.textContent = msg;
  box.appendChild(d);
}

// Tabela ainda não criada no Supabase: PostgREST responde PGRST205 / 42P01.
function agTabelaFaltando(err) {
  var t = (err && (err.code + ' ' + err.message)) || '';
  return /PGRST205|42P01/.test(t) || (/agendamentos/i.test(t) && /does not exist|could not find|schema cache/i.test(t));
}
var AG_MSG_SEM_TABELA = 'A tabela "agendamentos" ainda não existe no Supabase. Dá para gerar o PDF e as mensagens normalmente, mas o agendamento não fica salvo até a migração supabase/agendamentos.sql ser aplicada.';

async function fetchAgendamentos() {
  var tbody = agEl('ag-body');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center"><div class="loader"></div></td></tr>';
  if (!supabaseClient) { agAviso('Supabase não inicializado.'); agData = []; renderAgendamentos(); return; }
  try {
    var r = await supabaseClient.from('agendamentos').select('*')
      .order('data_reuniao', { ascending: false }).order('hora_reuniao', { ascending: false });
    if (r.error) throw r.error;
    agTabelaOk = true; agAviso('');
    agData = r.data || [];
  } catch (err) {
    console.error('Erro ao carregar agendamentos:', err);
    agData = [];
    if (agTabelaFaltando(err)) { agTabelaOk = false; agAviso(AG_MSG_SEM_TABELA); }
    else agAviso('Erro ao carregar agendamentos: ' + (err.message || err));
  }
  renderAgendamentos();
}

function agFmtDataHora(row) {
  if (!row.data_reuniao) return '—';
  return mpvDataCurta(row.data_reuniao) + ' ' + mpvHora(String(row.hora_reuniao || '00:00').slice(0, 5));
}

function renderAgendamentos() {
  var tbody = agEl('ag-body');
  var busca = agVal('ag-busca').toLowerCase();
  var st = agEl('ag-filtro-status').value;
  var linhas = agData.filter(function (r) {
    if (st && r.status !== st) return false;
    if (!busca) return true;
    return [r.empresa, r.contato, r.consultor, r.pre_vendedor, r.decisor].join(' ').toLowerCase().indexOf(busca) >= 0;
  });
  tbody.innerHTML = '';
  if (!linhas.length) {
    var tr0 = document.createElement('tr'), td0 = document.createElement('td');
    td0.colSpan = 8; td0.style.cssText = 'text-align:center;color:var(--gray)';
    td0.textContent = agTabelaOk ? 'Nenhum agendamento.' : 'Sem registros salvos.';
    tr0.appendChild(td0); tbody.appendChild(tr0);
    return;
  }
  linhas.forEach(function (r) {
    var tr = document.createElement('tr');
    [agFmtDataHora(r), r.empresa, r.contato, r.consultor, r.pre_vendedor].forEach(function (v) {
      var td = document.createElement('td'); td.textContent = v || '—'; tr.appendChild(td);
    });
    var tdS = document.createElement('td');
    var sel = document.createElement('select');
    sel.className = 'filter-input ag-status';
    Object.keys(AG_STATUS).forEach(function (k) {
      var o = document.createElement('option'); o.value = k; o.textContent = AG_STATUS[k];
      if (r.status === k) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = function () { mudarStatusAgendamento(r.id, sel.value); };
    tdS.appendChild(sel); tr.appendChild(tdS);
    var tdP = document.createElement('td');
    tdP.textContent = r.pdf_gerado_em ? new Date(r.pdf_gerado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    tr.appendChild(tdP);
    var tdA = document.createElement('td'); tdA.style.cssText = 'text-align:center;white-space:nowrap';
    var bE = document.createElement('button'); bE.className = 'btn btn-sm btn-ghost'; bE.textContent = 'Editar';
    bE.onclick = function () { abrirAgendamento(r); };
    var bG = document.createElement('button'); bG.className = 'btn btn-sm'; bG.textContent = 'Gerar PDF'; bG.style.marginLeft = '6px';
    bG.onclick = function () { abrirAgendamento(r); salvarAgendamento(true); };
    tdA.appendChild(bE); tdA.appendChild(bG); tr.appendChild(tdA);
    tbody.appendChild(tr);
  });
}

async function mudarStatusAgendamento(id, status) {
  try {
    var r = await supabaseClient.from('agendamentos').update({ status: status, updated_at: new Date().toISOString() }).eq('id', id);
    if (r.error) throw r.error;
    agData.forEach(function (x) { if (x.id === id) x.status = status; });
  } catch (err) {
    alert('Erro ao mudar o status: ' + (err.message || err));
    fetchAgendamentos();
  }
}

var AG_CAMPOS = { 'ag-empresa': 'empresa', 'ag-contato': 'contato', 'ag-cargo': 'cargo', 'ag-email': 'email', 'ag-whatsapp': 'whatsapp',
  'ag-data': 'data_reuniao', 'ag-link': 'link', 'ag-consultor': 'consultor', 'ag-prevendedor': 'pre_vendedor',
  'ag-decisor': 'decisor', 'ag-decisor-cargo': 'decisor_cargo' };

function novoAgendamento() {
  agEl('ag-id').value = '';
  Object.keys(AG_CAMPOS).forEach(function (id) { agEl(id).value = ''; });
  agEl('ag-hora').value = '';
  agEl('ag-form-title').textContent = 'Novo agendamento';
  agEl('ag-erros').textContent = '';
  agEl('ag-msgs-card').style.display = 'none';
  agEl('ag-form-card').style.display = '';
  agEl('ag-empresa').focus();
}

function abrirAgendamento(r) {
  agEl('ag-id').value = r.id || '';
  Object.keys(AG_CAMPOS).forEach(function (id) { agEl(id).value = r[AG_CAMPOS[id]] || ''; });
  agEl('ag-hora').value = String(r.hora_reuniao || '').slice(0, 5);
  agEl('ag-form-title').textContent = 'Agendamento · ' + (r.empresa || '');
  agEl('ag-erros').textContent = '';
  agEl('ag-msgs-card').style.display = 'none';
  agEl('ag-form-card').style.display = '';
  window.scrollTo(0, 0);
}

function fecharAgForm() {
  agEl('ag-form-card').style.display = 'none';
}

function agLerForm() {
  var d = {};
  Object.keys(AG_CAMPOS).forEach(function (id) { d[AG_CAMPOS[id]] = agVal(id); });
  d.hora_reuniao = agVal('ag-hora');
  return d;
}

// Validação. paraPdf = também exige o contato completo do consultor (vai na capa).
function agValidar(d, paraPdf) {
  var e = [];
  if (!d.empresa) e.push('Informe a empresa.');
  if (!d.contato) e.push('Informe o nome do contato.');
  if (!d.data_reuniao) e.push('Informe a data da reunião.');
  if (!d.hora_reuniao) e.push('Informe a hora da reunião.');
  if (d.data_reuniao && d.hora_reuniao) {
    var quando = new Date(d.data_reuniao + 'T' + d.hora_reuniao + ':00');
    if (isNaN(quando.getTime()) || quando.getTime() <= Date.now()) e.push('A data e a hora da reunião precisam estar no futuro.');
  }
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e.push('E-mail do contato inválido.');
  if (d.whatsapp && !/^\d{10,11}$/.test(d.whatsapp.replace(/\D/g, ''))) e.push('WhatsApp do contato inválido (DDD + número).');
  if (d.link && !/^https?:\/\/\S+$/i.test(d.link)) e.push('O link da videochamada precisa começar com http:// ou https://.');
  if (d.decisor_cargo && !d.decisor) e.push('Informe o nome do decisor (o cargo sozinho não entra no documento).');
  var cons = CONSULTORES.filter(function (c) { return c.nome === d.consultor; })[0];
  var pv = PRE_VENDEDORES.filter(function (p) { return p.nome === d.pre_vendedor; })[0];
  if (!cons) e.push('Escolha o consultor especialista.');
  if (!pv) e.push('Escolha o pré-vendedor.');
  if (paraPdf && cons && (!cons.email || !cons.whatsapp))
    e.push('O cadastro de ' + cons.nome + ' está sem e-mail ou WhatsApp no admin. O PDF não pode ser gerado sem o contato do consultor: complete a lista CONSULTORES.');
  return { erros: e, consultor: cons, preVendedor: pv };
}

async function salvarAgendamento(gerar) {
  var d = agLerForm();
  var v = agValidar(d, gerar);
  var boxErr = agEl('ag-erros');
  boxErr.innerHTML = '';
  if (v.erros.length) {
    v.erros.forEach(function (m) { var p = document.createElement('div'); p.textContent = m; boxErr.appendChild(p); });
    return;
  }
  var id = agVal('ag-id');
  var row = {};
  Object.keys(d).forEach(function (k) { row[k] = d[k] || null; });
  row.consultor_email = v.consultor.email || null;
  row.consultor_whatsapp = v.consultor.whatsapp || null;
  row.updated_at = new Date().toISOString();
  var btns = [agEl('ag-btn-salvar'), agEl('ag-btn-gerar')];
  btns.forEach(function (b) { b.disabled = true; b.style.opacity = '0.6'; });
  var salvo = false;
  try {
    var res = id ? await supabaseClient.from('agendamentos').update(row).eq('id', id).select()
                 : await supabaseClient.from('agendamentos').insert([row]).select();
    if (res.error) throw res.error;
    if (res.data && res.data[0]) { id = res.data[0].id; agEl('ag-id').value = id; }
    salvo = true; agTabelaOk = true; agAviso('');
  } catch (err) {
    console.error('Erro ao salvar agendamento:', err);
    if (agTabelaFaltando(err)) { agTabelaOk = false; agAviso(AG_MSG_SEM_TABELA); }
    else agAviso('O agendamento não foi salvo: ' + (err.message || err));
  }

  if (!gerar) {
    btns.forEach(function (b) { b.disabled = false; b.style.opacity = ''; });
    if (salvo) { fecharAgForm(); fetchAgendamentos(); }
    return;
  }

  var dados = {
    empresa: d.empresa, contato: d.contato, cargo: d.cargo, data: d.data_reuniao, hora: d.hora_reuniao, link: d.link,
    decisor: d.decisor, decisor_cargo: d.decisor_cargo, emissao: mpvHojeIso(),
    consultor: { nome: v.consultor.nome, email: v.consultor.email, whatsapp: v.consultor.whatsapp },
    pre_vendedor: { nome: v.preVendedor.nome }
  };
  try {
    var r = await gerarMaterialPrevio(dados);
    window.__MPV_LAST = { nome: r.nome, paginas: r.paginas, fit: r.fit, data: r.pdf.output('datauristring') };
    if (salvo && id) {
      var up = await supabaseClient.from('agendamentos').update({ pdf_gerado_em: new Date().toISOString() }).eq('id', id);
      if (up.error) console.error('Erro ao marcar pdf_gerado_em:', up.error);
    }
    mostrarMensagens(dados, d, r.nome);
    if (salvo) fetchAgendamentos();
  } catch (err) {
    console.error('Erro ao gerar o material prévio:', err);
    var p = document.createElement('div');
    p.textContent = 'O PDF não foi gerado: ' + (err.message || err);
    boxErr.appendChild(p);
  }
  btns.forEach(function (b) { b.disabled = false; b.style.opacity = ''; });
}

function agCopiar(texto, btn) {
  function ok() { var t = btn.textContent; btn.textContent = 'Copiado'; setTimeout(function () { btn.textContent = t; }, 1500); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, function () { agCopiarFallback(texto); ok(); });
  else { agCopiarFallback(texto); ok(); }
}
function agCopiarFallback(texto) {
  var ta = document.createElement('textarea');
  ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

function agWaLink(fone, texto) {
  var n = String(fone || '').replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto);
}

var agUltimo = null; // { dados, form, nome } da última geração, para regenerar ao salvar os modelos
function mostrarMensagens(dados, form, nomeArquivo) {
  agUltimo = { dados: dados, form: form, nome: nomeArquivo };
  var m = mpvMensagens(dados, agModelosTextos());
  var box = agEl('ag-msgs');
  box.innerHTML = '';
  agEl('ag-msgs-sub').textContent = 'PDF baixado: ' + nomeArquivo + '. Anexe o arquivo no e-mail e no WhatsApp.';
  var blocos = [
    { id: 'email', titulo: 'E-mail de agendamento', texto: 'Assunto: ' + m.assunto + '\n\n' + m.email, copiar: m.email, copiarAssunto: m.assunto,
      link: form.email ? 'mailto:' + form.email + '?subject=' + encodeURIComponent(m.assunto) + '&body=' + encodeURIComponent(m.email) : '', linkTxt: 'Abrir no e-mail' },
    { id: 'whats', titulo: 'WhatsApp de agendamento (com o PDF)', texto: m.whats, copiar: m.whats,
      link: form.whatsapp ? agWaLink(form.whatsapp, m.whats) : '', linkTxt: 'Abrir no WhatsApp' },
    { id: 'lembrete', titulo: 'WhatsApp de lembrete (24 h antes)', texto: m.lembrete, copiar: m.lembrete,
      link: form.whatsapp ? agWaLink(form.whatsapp, m.lembrete) : '', linkTxt: 'Abrir no WhatsApp' }
  ];
  blocos.forEach(function (b) {
    var div = document.createElement('div'); div.className = 'ag-msg'; div.id = 'ag-msg-' + b.id;
    var head = document.createElement('div'); head.className = 'ag-msg-head';
    var t = document.createElement('b'); t.textContent = b.titulo; head.appendChild(t);
    var acoes = document.createElement('span');
    if (b.link) { var a = document.createElement('a'); a.href = b.link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = b.linkTxt; acoes.appendChild(a); }
    if (b.copiarAssunto) {
      var bA = document.createElement('button'); bA.className = 'btn btn-sm btn-ghost'; bA.textContent = 'Copiar assunto';
      bA.onclick = function () { agCopiar(b.copiarAssunto, bA); }; acoes.appendChild(bA);
    }
    var bC = document.createElement('button'); bC.className = 'btn btn-sm'; bC.textContent = 'Copiar';
    bC.onclick = function () { agCopiar(b.copiar, bC); }; acoes.appendChild(bC);
    head.appendChild(acoes);
    var pre = document.createElement('pre'); pre.textContent = b.texto;
    div.appendChild(head); div.appendChild(pre);
    box.appendChild(div);
  });
  agEl('ag-msgs-card').style.display = '';
}

// ═══════════════════════════════════════════
//  MODELOS DE MENSAGEM (tabela mensagens_modelos; vale para todos)
// ═══════════════════════════════════════════
// Sem linha para uma chave, ou sem a tabela, a geração usa os padrões de
// material-previo.js (MPV_MODELOS_PADRAO). Nunca bloqueia a geração.
var agModelos = {};            // chave -> { texto, updated_at, updated_by }
var agModelosTabelaOk = true;
var AG_MSG_SEM_TABELA_MOD = 'Tabela ainda não criada — aplique supabase/mensagens_modelos.sql. Enquanto isso valem os textos padrão e não dá para salvar alterações.';

function agModelosTextos() {
  var o = {};
  MPV_MODELOS_CHAVES.forEach(function (k) { if (agModelos[k]) o[k] = agModelos[k].texto; });
  return o;
}
function agModelosTabelaFaltando(err) {
  var t = (err && (err.code + ' ' + err.message)) || '';
  return /PGRST205|42P01/.test(t) || (/mensagens_modelos/i.test(t) && /does not exist|could not find|schema cache/i.test(t));
}
async function fetchModelos() {
  if (!supabaseClient) return;
  try {
    var r = await supabaseClient.from('mensagens_modelos').select('*');
    if (r.error) throw r.error;
    agModelosTabelaOk = true; agModelos = {};
    (r.data || []).forEach(function (x) {
      if (MPV_MODELOS_CHAVES.indexOf(x.chave) >= 0 && typeof x.texto === 'string') agModelos[x.chave] = { texto: x.texto, updated_at: x.updated_at, updated_by: x.updated_by };
    });
  } catch (err) {
    agModelos = {};
    if (agModelosTabelaFaltando(err)) agModelosTabelaOk = false;
    else console.error('Erro ao carregar modelos de mensagem:', err);
  }
}

var modFoco = null;
function modEl(k) { return document.getElementById('mod-campo-' + k); }
function modExemplo() {
  var d = new Date(); d.setDate(d.getDate() + 7);
  return { empresa: 'Construtora Exemplo', contato: 'Marina Lopes Cavalcante', cargo: '', data: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2),
    hora: '14:00', link: 'https://meet.google.com/abc-defg-hij', decisor: '', decisor_cargo: '',
    consultor: { nome: 'Felipe Façanha' }, pre_vendedor: { nome: 'Thifany Araujo' } };
}
// Dados da prévia: agendamento aberto no formulário (se completo) > última geração > exemplo.
function modDadosPrevia() {
  var ex = modExemplo();
  if (agEl('ag-form-card').style.display !== 'none') {
    var f = agLerForm();
    if (f.empresa && f.contato && f.data_reuniao && f.hora_reuniao) {
      var c = CONSULTORES.filter(function (x) { return x.nome === f.consultor; })[0];
      var pv = PRE_VENDEDORES.filter(function (x) { return x.nome === f.pre_vendedor; })[0];
      return { fonte: 'o agendamento aberto (' + f.empresa + ')', dados: { empresa: f.empresa, contato: f.contato, cargo: f.cargo, data: f.data_reuniao, hora: f.hora_reuniao,
        link: f.link, decisor: f.decisor, decisor_cargo: f.decisor_cargo, consultor: { nome: c ? c.nome : ex.consultor.nome }, pre_vendedor: { nome: pv ? pv.nome : ex.pre_vendedor.nome } } };
    }
  }
  if (agUltimo) return { fonte: 'o último material gerado (' + agUltimo.dados.empresa + ')', dados: agUltimo.dados };
  return { fonte: 'um exemplo fixo (' + ex.empresa + ')', dados: ex };
}

function modInserirVariavel(nome) {
  var el = modFoco && document.body.contains(modFoco) ? modFoco : modEl('email_corpo');
  var ini = el.selectionStart == null ? el.value.length : el.selectionStart;
  var fim = el.selectionEnd == null ? ini : el.selectionEnd;
  var ins = '{' + nome + '}';
  el.value = el.value.slice(0, ini) + ins + el.value.slice(fim);
  el.focus(); el.setSelectionRange(ini + ins.length, ini + ins.length);
  modAtualizar();
}

function modMeta() {
  var ult = null;
  MPV_MODELOS_CHAVES.forEach(function (k) { var m = agModelos[k]; if (m && m.updated_at && (!ult || m.updated_at > ult.updated_at)) ult = m; });
  agEl('mod-meta').textContent = ult
    ? 'Última alteração em ' + new Date(ult.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + (ult.updated_by ? ' por ' + ult.updated_by : '') + '.'
    : 'Nenhuma alteração ainda: valem os textos padrão.';
}

function modAtualizar() {
  var pv = modDadosPrevia();
  agEl('mod-prev-fonte').textContent = 'Prévia com ' + pv.fonte + '.';
  var textos = {};
  MPV_MODELOS_CHAVES.forEach(function (k) {
    var t = modEl(k).value; textos[k] = t;
    var ruins = mpvVariaveisDesconhecidas(t);
    modEl(k).parentNode.querySelector('.err').textContent = ruins.length ? 'Variável desconhecida: ' + ruins.map(function (n) { return '{' + n + '}'; }).join(', ') + '.' : '';
  });
  var m = mpvMensagens(pv.dados, textos);
  var box = agEl('mod-prev'); box.innerHTML = '';
  [['E-mail de agendamento', 'Assunto: ' + m.assunto + '\n\n' + m.email], ['WhatsApp de agendamento', m.whats], ['WhatsApp de lembrete', m.lembrete]].forEach(function (b) {
    var div = document.createElement('div'); div.className = 'ag-msg';
    var h = document.createElement('div'); h.className = 'ag-msg-head';
    var t = document.createElement('b'); t.textContent = b[0]; h.appendChild(t);
    var pre = document.createElement('pre'); pre.textContent = b[1];
    div.appendChild(h); div.appendChild(pre); box.appendChild(div);
  });
}

async function abrirModelos() {
  await fetchModelos();
  var av = agEl('mod-aviso'); av.innerHTML = '';
  if (!agModelosTabelaOk) { var d = document.createElement('div'); d.className = 'ag-aviso'; d.textContent = AG_MSG_SEM_TABELA_MOD; av.appendChild(d); }
  var chips = agEl('mod-chips'); chips.innerHTML = '';
  MPV_VARIAVEIS.forEach(function (v) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'ag-chip'; b.textContent = '{' + v[0] + '}'; b.title = v[1];
    b.onmousedown = function (e) { e.preventDefault(); };
    b.onclick = function () { modInserirVariavel(v[0]); };
    chips.appendChild(b);
  });
  var campos = agEl('mod-campos'); campos.innerHTML = '';
  MPV_MODELOS_CHAVES.forEach(function (k) {
    var wrap = document.createElement('div'); wrap.className = 'ag-mod-campo';
    var lab = document.createElement('div'); lab.className = 'lab';
    var l = document.createElement('label'); l.className = 'filter-label'; l.textContent = MPV_MODELOS_ROTULOS[k]; lab.appendChild(l);
    var r = document.createElement('button'); r.type = 'button'; r.className = 'btn btn-sm btn-ghost'; r.textContent = 'Restaurar padrão'; r.id = 'mod-rest-' + k;
    r.onclick = function () { modEl(k).value = MPV_MODELOS_PADRAO[k]; modAtualizar(); };
    lab.appendChild(r); wrap.appendChild(lab);
    var inp = document.createElement(k === 'email_assunto' ? 'input' : 'textarea');
    if (k === 'email_assunto') inp.type = 'text'; else inp.rows = k === 'email_corpo' ? 12 : 6;
    inp.className = 'filter-input'; inp.id = 'mod-campo-' + k;
    inp.value = agModelos[k] ? agModelos[k].texto : MPV_MODELOS_PADRAO[k];
    inp.onfocus = function () { modFoco = inp; };
    inp.oninput = modAtualizar;
    wrap.appendChild(inp);
    var er = document.createElement('div'); er.className = 'err'; wrap.appendChild(er);
    campos.appendChild(wrap);
  });
  modFoco = null;
  var por = '';
  try { por = localStorage.getItem('siiga_mod_por') || ''; } catch (e) {}
  agEl('mod-por').value = por;
  agEl('mod-erros').textContent = '';
  modMeta(); modAtualizar();
  agEl('mod-modal').style.display = 'flex';
}
function fecharModelos() { agEl('mod-modal').style.display = 'none'; }

async function salvarModelos() {
  var box = agEl('mod-erros'); box.innerHTML = '';
  function erro(m) { var p = document.createElement('div'); p.textContent = m; box.appendChild(p); }
  var novos = {};
  MPV_MODELOS_CHAVES.forEach(function (k) {
    var t = modEl(k).value;
    novos[k] = k === 'email_assunto' ? t.replace(/\s*\n\s*/g, ' ').trim() : t.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
    if (!novos[k].trim()) erro(MPV_MODELOS_ROTULOS[k] + ': o texto não pode ficar vazio (use "Restaurar padrão").');
    mpvVariaveisDesconhecidas(novos[k]).forEach(function (n) { erro(MPV_MODELOS_ROTULOS[k] + ': variável desconhecida {' + n + '}.'); });
  });
  var por = agEl('mod-por').value.trim();
  if (!por) erro('Informe seu nome (fica registrado como autor da alteração).');
  if (box.childNodes.length) return;
  if (!agModelosTabelaOk) { erro(AG_MSG_SEM_TABELA_MOD); return; }
  try { localStorage.setItem('siiga_mod_por', por); } catch (e) {}
  var btn = agEl('mod-btn-salvar'); btn.disabled = true; btn.style.opacity = '0.6';
  try {
    for (var i = 0; i < MPV_MODELOS_CHAVES.length; i++) {
      var k = MPV_MODELOS_CHAVES[i];
      var atual = agModelos[k] ? agModelos[k].texto : MPV_MODELOS_PADRAO[k];
      if (novos[k] === atual) continue;
      var campos = { texto: novos[k], updated_at: new Date().toISOString(), updated_by: por };
      var res = agModelos[k] ? await supabaseClient.from('mensagens_modelos').update(campos).eq('chave', k)
                             : await supabaseClient.from('mensagens_modelos').insert([Object.assign({ chave: k }, campos)]);
      if (res.error) throw res.error;
      agModelos[k] = { texto: campos.texto, updated_at: campos.updated_at, updated_by: por };
    }
    fecharModelos();
    if (agUltimo) mostrarMensagens(agUltimo.dados, agUltimo.form, agUltimo.nome);
  } catch (err) {
    console.error('Erro ao salvar modelos:', err);
    if (agModelosTabelaFaltando(err)) { agModelosTabelaOk = false; erro(AG_MSG_SEM_TABELA_MOD); }
    else erro('Não foi possível salvar: ' + (err.message || err));
  }
  btn.disabled = false; btn.style.opacity = '';
}
