const url = 'https://ghtdfhupjoddfwiqzdpa.supabase.co/rest/v1/assessments';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGRmaHVwam9kZGZ3aXF6ZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjY4MTYsImV4cCI6MjA5NTMwMjgxNn0.d0FDQk-P_xTWslTN2zIfxi8wNpxpf1Xwz5AhX3cnUnc';

const data = {
  id: Date.now(),
  nome: 'Teste de API',
  empresa: 'Test',
  consultor: 'Test',
  contato: 'Test',
  cargo: 'Test',
  email: 'test@test.com',
  telefone: '9999',
  data: '2026-06-01',
  modelo_mo: 'Test',
  num_obras: 5,
  orcamento_medio: 500000,
  total_score: 10,
  total_max: 66,
  nivel: 'Test',
  scores: {},
  state: {}
};

fetch(url, {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify(data)
})
.then(res => res.json())
.then(json => console.log(json))
.catch(err => console.error(err));
