const SUPABASE_URL = 'https://ghtdfhupjoddfwiqzdpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGRmaHVwam9kZGZ3aXF6ZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjY4MTYsImV4cCI6MjA5NTMwMjgxNn0.d0FDQk-P_xTWslTN2zIfxi8wNpxpf1Xwz5AhX3cnUnc';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let allData = [];

// Handle Enter key on login
document.getElementById('pass-input').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') {
    checkLogin();
  }
});

function checkLogin() {
  const pass = document.getElementById('pass-input').value;
  // Senha simples definida via solicitação de segurança básica
  if (pass === 'siigaadmin26') {
    document.getElementById('login-overlay').style.display = 'none';
    fetchData();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

async function fetchData() {
  const tbody = document.getElementById('table-body');
  const countSpan = document.getElementById('total-count');
  
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center"><div class="loader"></div></td></tr>';
  
  if (!supabaseClient) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ff4444">Erro: Supabase não inicializado.</td></tr>';
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('assessments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    allData = data || [];
    countSpan.textContent = `${allData.length} registros encontrados`;
    renderTable();
  } catch (err) {
    console.error('Error fetching data:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ff4444">Erro ao carregar dados: ${err.message}</td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  if (allData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gray)">Nenhum diagnóstico encontrado.</td></tr>';
    return;
  }

  allData.forEach((row, index) => {
    // A data no banco costuma estar em created_at ou no payload json
    const rawDate = row.created_at || new Date().toISOString();
    const dateObj = new Date(rawDate);
    const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;

    // Tenta extrair dados do JSON se as colunas normais estiverem vazias
    let parsedJson = {};
    try { parsedJson = JSON.parse(row.json_data || '{}'); } catch(e) {}

    const empresa = row.empresa || parsedJson.empresa || '—';
    const consultor = row.consultor || parsedJson.consultor || '—';
    const contato = row.contato || parsedJson.contato || '—';
    const telefone = parsedJson.telefone || '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td style="font-weight:600;color:var(--orange)">${empresa}</td>
      <td>${consultor}</td>
      <td>${contato}</td>
      <td>${telefone}</td>
      <td>
        <button class="btn btn-sm" onclick="openDetails(${index})">Ver Detalhes</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openDetails(index) {
  const row = allData[index];
  if (!row) return;

  let parsedJson = {};
  try { parsedJson = JSON.parse(row.json_data || '{}'); } catch(e) {}

  document.getElementById('modal-title').textContent = `Detalhes: ${row.empresa || parsedJson.empresa || 'Diagnóstico'}`;
  
  const summary = document.getElementById('modal-summary');
  summary.innerHTML = `
    <div><strong>E-mail:</strong> ${parsedJson.email || '—'}</div>
    <div><strong>Cargo:</strong> ${parsedJson.cargo || '—'}</div>
    <div><strong>Telefone:</strong> ${parsedJson.telefone || '—'}</div>
    <div><strong>Consultor:</strong> ${parsedJson.consultor || '—'}</div>
    <div><strong>Qtd Obras:</strong> ${parsedJson.numObras || '—'}</div>
    <div><strong>Orçamento Médio:</strong> R$ ${parsedJson.orcamentoMedio ? parsedJson.orcamentoMedio.toLocaleString('pt-BR') : '—'}</div>
  `;

  document.getElementById('modal-json').textContent = JSON.stringify(parsedJson, null, 2);
  
  document.getElementById('details-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('details-modal').style.display = 'none';
}

// Close modal when clicking outside content
document.getElementById('details-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
