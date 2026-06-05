const SUPABASE_URL = 'https://ghtdfhupjoddfwiqzdpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodGRmaHVwam9kZGZ3aXF6ZHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjY4MTYsImV4cCI6MjA5NTMwMjgxNn0.d0FDQk-P_xTWslTN2zIfxi8wNpxpf1Xwz5AhX3cnUnc';

async function testUpdate() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/assessments?select=id,empresa&limit=1`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  const data = await res.json();
  console.log('Assessment to update:', data);

  if (data.length > 0) {
    const idToUpdate = data[0].id;
    console.log(`Attempting to update ID: ${idToUpdate}`);

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${idToUpdate}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        empresa: data[0].empresa + ' (Updated)'
      })
    });

    console.log('Update status:', updateRes.status);
    try {
      const updateData = await updateRes.json();
      console.log('Update response data:', updateData);
    } catch (e) {
      console.log('No JSON response or error parsing JSON:', e.message);
    }
  }
}

testUpdate().catch(console.error);
