const SUPABASE_URL = 'https://ghtdfhupjoddfwiqzdpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGRmaHVwam9kZGZ3aXF6ZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjY4MTYsImV4cCI6MjA5NTMwMjgxNn0.d0FDQk-P_xTWslTN2zIfxi8wNpxpf1Xwz5AhX3cnUnc';

async function test() {
  // 1. Fetch assessments to see one ID
  const res = await fetch(`${SUPABASE_URL}/rest/v1/assessments?select=id,empresa&limit=3`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  const data = await res.json();
  console.log('Assessments found:', data);

  if (data.length > 0) {
    const idToDelete = data[0].id;
    console.log(`Attempting to delete ID: ${idToDelete}`);

    // Attempt delete
    const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${idToDelete}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation' // This makes PostgREST return the deleted rows
      }
    });

    console.log('Delete status:', deleteRes.status);
    try {
      const deleteData = await deleteRes.json();
      console.log('Delete response data:', deleteData);
    } catch (e) {
      console.log('No JSON response or error parsing JSON:', e.message);
    }
  }
}

test().catch(console.error);
