const url = 'https://ghtdfhupjoddfwiqzdpa.supabase.co/rest/v1/assessments';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGRmaHVwam9kZGZ3aXF6ZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjY4MTYsImV4cCI6MjA5NTMwMjgxNn0.d0FDQk-P_xTWslTN2zIfxi8wNpxpf1Xwz5AhX3cnUnc';

const data = {
  id: 1780335942251, // Same ID as before
  nome: 'Teste de API Editado',
  nivel: 'Incompleto'
};

fetch(url, {
  method: 'POST', // Upsert is POST with Resolution and Conflict headers
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  },
  body: JSON.stringify(data)
})
.then(res => res.json())
.then(json => console.log(json))
.catch(err => console.error(err));
