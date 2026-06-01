const url = 'https://ghtdfhupjoddfwiqzdpa.supabase.co/rest/v1/assessments?limit=1';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGRmaHVwam9kZGZ3aXF6ZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjY4MTYsImV4cCI6MjA5NTMwMjgxNn0.d0FDQk-P_xTWslTN2zIfxi8wNpxpf1Xwz5AhX3cnUnc';

fetch(url, {
  method: 'GET',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
  }
})
.then(res => res.json())
.then(json => console.log(Object.keys(json[0] || {})))
.catch(err => console.error(err));
