// ═══════════════════════════════════════════
//  LOGIN POR VENDEDOR (Supabase Auth, e-mail + senha)
//  Usado por index.html e admin.html. Mesma origem = mesma sessão nas duas páginas.
//  Compatível com a RLS aberta de hoje: sem login (ou sem a tabela "perfis" / coluna
//  "owner_id" criadas) o app continua gravando como antes.
// ═══════════════════════════════════════════
// O link do convite/recuperação chega com #access_token=...&type=invite|recovery; o supabase-js lê e apaga o hash.
var SIIGA_LINK_TIPO = ((typeof location !== 'undefined' && /[#&]type=(invite|recovery)/.exec(location.hash || '')) || [])[1] || null;

var SiigaAuth = (function () {
  var client = null, session = null, profile = null, ready = false, listeners = [];

  // A chave da Anthropic que a "Análise Consultiva" guardava no navegador foi removida do app: apaga o que sobrou.
  try { localStorage.removeItem('siiga_api_key'); } catch (e) {}

  function notify() { listeners.forEach(function (fn) { try { fn(api); } catch (e) { console.error(e); } }); }

  async function loadProfile() {
    profile = null;
    if (!client || !session) return;
    try {
      var r = await client.from('perfis').select('user_id,nome,papel,ativo').eq('user_id', session.user.id).maybeSingle();
      if (!r.error && r.data && r.data.ativo !== false) profile = r.data;
    } catch (e) { /* tabela ainda não existe: segue sem perfil */ }
  }

  async function setSession(s) {
    session = s || null;
    await loadProfile();
    notify();
  }

  var api = {
    init: async function (c) {
      client = c;
      if (!client || !client.auth) { ready = true; notify(); return; }
      // listener ANTES do getSession: o supabase-js dispara PASSWORD_RECOVERY durante a inicialização
      client.auth.onAuthStateChange(function (ev, s) {
        if (ev === 'PASSWORD_RECOVERY') { session = s || session; setSession(session).then(function () { siigaAbrirDefinirSenha('recovery'); }); return; }
        // evita laço: só reage a mudança real de usuário
        var antes = session && session.user && session.user.id, depois = s && s.user && s.user.id;
        if (ev === 'TOKEN_REFRESHED' || antes === depois) { session = s || null; return; }
        setSession(s);
      });
      try {
        var r = await client.auth.getSession();
        await setSession(r && r.data ? r.data.session : null);
      } catch (e) { await setSession(null); }
      ready = true;
      // chegou pelo link de convite ou de recuperação: a pessoa ainda não tem senha (ou esqueceu) => definir agora
      if (SIIGA_LINK_TIPO && session) siigaAbrirDefinirSenha(SIIGA_LINK_TIPO);
      notify();
    },
    definirSenha: async function (senha) {
      if (!client) throw new Error('Supabase não inicializado.');
      var r = await client.auth.updateUser({ password: senha });
      if (r.error) throw new Error(traduz(r.error));
      SIIGA_LINK_TIPO = null;
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    },
    // "Esqueci minha senha": manda o link de recuperação para o e-mail; volta para esta mesma página.
    recuperar: async function (email) {
      if (!client) throw new Error('Supabase não inicializado.');
      email = String(email || '').trim();
      if (!email) throw new Error('Informe o e-mail.');
      var r = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (r.error) throw new Error(traduz(r.error));
    },
    onChange: function (fn) { listeners.push(fn); if (ready) fn(api); },
    isReady: function () { return ready; },
    logado: function () { return !!session; },
    userId: function () { return session ? session.user.id : null; },
    email: function () { return session ? session.user.email : ''; },
    nome: function () { return profile && profile.nome ? profile.nome : ''; },
    papel: function () { return profile ? profile.papel : null; },
    isAdmin: function () { return !!profile && profile.papel === 'admin'; },
    // vendedor edita só o que é dele; registro sem dono (os antigos) só o admin edita
    podeEditar: function (row) {
      if (api.isAdmin()) return true;
      return !!(row && row.owner_id && session && row.owner_id === session.user.id);
    },
    entrar: async function (email, senha) {
      if (!client) throw new Error('Supabase não inicializado.');
      var r = await client.auth.signInWithPassword({ email: String(email || '').trim(), password: senha });
      if (r.error) throw new Error(traduz(r.error));
      await setSession(r.data.session);
    },
    sair: async function () {
      if (client) { try { await client.auth.signOut(); } catch (e) {} }
      await setSession(null);
    },
    // Campos de dono para gravar junto do registro. Vazio se não houver login.
    donoDe: function (rec) {
      var id = (rec && rec.owner_id) || api.userId();
      return id ? { owner_id: id } : {};
    },
    // upsert em assessments que tolera o banco ainda sem a coluna owner_id (antes da fase 1 do SQL):
    // se o erro citar owner_id, repete sem ela.
    upsertAssessments: async function (c, rows) {
      var res = await c.from('assessments').upsert(rows);
      if (res.error && /owner_id/i.test((res.error.message || '') + (res.error.details || ''))) {
        res = await c.from('assessments').upsert(rows.map(function (r) { var o = Object.assign({}, r); delete o.owner_id; return o; }));
      }
      return res;
    }
  };

  function traduz(err) {
    var m = (err && err.message) || '';
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Use o link do convite.';
    if (/password should be|weak password|at least/i.test(m)) return 'Senha fraca: use pelo menos 8 caracteres.';
    if (/same password|different from the old/i.test(m)) return 'Escolha uma senha diferente da anterior.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    if (/failed to fetch|network/i.test(m)) return 'Sem conexão com o servidor.';
    return m || 'Não foi possível entrar.';
  }

  return api;
})();

// ── Interface de login (modal simples, usado no index; o admin tem a própria tela) ──
function siigaLoginHtml() {
  return '<div style="background:#14141b;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:28px;width:min(92vw,380px);color:#fff;font-family:inherit">' +
    '<h3 style="margin:0 0 6px;font-size:18px">Entrar</h3>' +
    '<p style="margin:0 0 16px;font-size:12px;color:#9a9aa8">Use o e-mail e a senha do seu convite. Sem entrar, o diagnóstico fica só neste dispositivo.</p>' +
    '<input id="siiga-login-email" type="email" autocomplete="username" placeholder="E-mail" style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:#0d0d12;color:#fff">' +
    '<input id="siiga-login-senha" type="password" autocomplete="current-password" placeholder="Senha" style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:#0d0d12;color:#fff">' +
    '<div id="siiga-login-erro" style="display:none;color:#f87171;font-size:12px;margin-bottom:10px"></div>' +
    '<div id="siiga-login-info" style="display:none;color:#34d399;font-size:12px;margin-bottom:10px"></div>' +
    '<a href="#" id="siiga-login-esqueci" style="display:inline-block;margin-bottom:12px;font-size:12px;color:#ff8a50">Esqueci minha senha</a>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end">' +
    '<button type="button" id="siiga-login-cancelar" style="padding:9px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#ccc;cursor:pointer">Cancelar</button>' +
    '<button type="button" id="siiga-login-ok" style="padding:9px 18px;border-radius:8px;border:none;background:#ff5f1f;color:#fff;font-weight:700;cursor:pointer">Entrar</button>' +
    '</div></div>';
}

function siigaAbrirLogin() {
  var ov = document.getElementById('siiga-login-modal');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'siiga-login-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center';
    ov.innerHTML = siigaLoginHtml();
    document.body.appendChild(ov);
    var fazer = async function () {
      var erro = document.getElementById('siiga-login-erro');
      erro.style.display = 'none';
      var btn = document.getElementById('siiga-login-ok');
      btn.disabled = true;
      try {
        await SiigaAuth.entrar(document.getElementById('siiga-login-email').value, document.getElementById('siiga-login-senha').value);
        ov.style.display = 'none';
        document.getElementById('siiga-login-senha').value = '';
      } catch (e) {
        erro.textContent = e.message; erro.style.display = 'block';
      }
      btn.disabled = false;
    };
    document.getElementById('siiga-login-ok').onclick = fazer;
    document.getElementById('siiga-login-esqueci').onclick = function (e) {
      e.preventDefault();
      siigaEsqueciSenha(document.getElementById('siiga-login-email').value, document.getElementById('siiga-login-erro'), document.getElementById('siiga-login-info'));
    };
    document.getElementById('siiga-login-cancelar').onclick = function () { ov.style.display = 'none'; };
    ov.addEventListener('keypress', function (e) { if (e.key === 'Enter') fazer(); });
  }
  ov.style.display = 'flex';
  setTimeout(function () { var i = document.getElementById('siiga-login-email'); if (i) i.focus(); }, 50);
}

// Chip fixo no canto: "Entrar" ou "Nome · Sair" (não imprime).
function siigaDesenharChip() {
  var chip = document.getElementById('siiga-auth-chip');
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'siiga-auth-chip';
    chip.className = 'no-print';
    chip.style.cssText = 'position:fixed;top:10px;right:12px;z-index:500;font-size:12px;background:rgba(20,20,27,0.92);border:1px solid rgba(255,255,255,0.14);color:#dcdce4;border-radius:999px;padding:6px 12px;display:flex;gap:10px;align-items:center';
    var st = document.createElement('style');
    st.textContent = '@media print{#siiga-auth-chip{display:none!important}}';
    document.head.appendChild(st);
    document.body.appendChild(chip);
  }
  if (SiigaAuth.logado()) {
    var nome = SiigaAuth.nome() || SiigaAuth.email();
    chip.innerHTML = '<span>' + String(nome).replace(/[<>&"]/g, '') + '</span><a href="#" id="siiga-chip-sair" style="color:#ff8a50;text-decoration:none;font-weight:700">Sair</a>';
    document.getElementById('siiga-chip-sair').onclick = function (e) { e.preventDefault(); SiigaAuth.sair(); };
  } else {
    chip.innerHTML = '<a href="#" id="siiga-chip-entrar" style="color:#ff8a50;text-decoration:none;font-weight:700">Entrar</a>';
    document.getElementById('siiga-chip-entrar').onclick = function (e) { e.preventDefault(); siigaAbrirLogin(); };
  }
}

// "Esqueci minha senha" (usado pelo modal do index e pela tela de login do admin).
async function siigaEsqueciSenha(email, erroEl, infoEl) {
  if (erroEl) erroEl.style.display = 'none';
  if (infoEl) infoEl.style.display = 'none';
  try {
    await SiigaAuth.recuperar(email);
    if (infoEl) { infoEl.textContent = 'Se este e-mail tiver acesso, enviamos o link para criar uma nova senha.'; infoEl.style.display = 'block'; }
  } catch (e) {
    if (erroEl) { erroEl.textContent = e.message; erroEl.style.display = 'block'; }
  }
}

// ── "Defina sua senha": convite ou recuperação. Obrigatório (sem cancelar); mínimo de 8 caracteres e confirmação. ──
function siigaAbrirDefinirSenha(tipo) {
  var ov = document.getElementById('siiga-senha-modal');
  if (ov && ov.style.display !== 'none') return;
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'siiga-senha-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9500;display:flex;align-items:center;justify-content:center';
    ov.innerHTML = '<div style="background:#14141b;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:28px;width:min(92vw,380px);color:#fff;font-family:inherit">' +
      '<h3 id="siiga-senha-titulo" style="margin:0 0 6px;font-size:18px">Defina sua senha</h3>' +
      '<p style="margin:0 0 16px;font-size:12px;color:#9a9aa8">Mínimo de 8 caracteres. Use esta senha nas próximas vezes que entrar.</p>' +
      '<input id="siiga-senha-nova" type="password" autocomplete="new-password" placeholder="Nova senha" style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:#0d0d12;color:#fff">' +
      '<input id="siiga-senha-conf" type="password" autocomplete="new-password" placeholder="Repita a senha" style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:#0d0d12;color:#fff">' +
      '<div id="siiga-senha-erro" style="display:none;color:#f87171;font-size:12px;margin-bottom:10px"></div>' +
      '<div style="display:flex;justify-content:flex-end"><button type="button" id="siiga-senha-ok" style="padding:9px 18px;border-radius:8px;border:none;background:#ff5f1f;color:#fff;font-weight:700;cursor:pointer">Salvar senha</button></div></div>';
    document.body.appendChild(ov);
    var salvar = async function () {
      var erro = document.getElementById('siiga-senha-erro'), a = document.getElementById('siiga-senha-nova').value, b = document.getElementById('siiga-senha-conf').value;
      erro.style.display = 'none';
      if (a.length < 8) { erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; erro.style.display = 'block'; return; }
      if (a !== b) { erro.textContent = 'As duas senhas não são iguais.'; erro.style.display = 'block'; return; }
      var btn = document.getElementById('siiga-senha-ok'); btn.disabled = true;
      try {
        await SiigaAuth.definirSenha(a);
        ov.style.display = 'none';
        document.getElementById('siiga-senha-nova').value = ''; document.getElementById('siiga-senha-conf').value = '';
        if (typeof showToast === 'function') showToast('Senha definida. Você já está dentro.');
      } catch (e) { erro.textContent = e.message; erro.style.display = 'block'; }
      btn.disabled = false;
    };
    document.getElementById('siiga-senha-ok').onclick = salvar;
    ov.addEventListener('keypress', function (e) { if (e.key === 'Enter') salvar(); });
  }
  document.getElementById('siiga-senha-titulo').textContent = tipo === 'recovery' ? 'Crie uma nova senha' : 'Defina sua senha';
  ov.style.display = 'flex';
  setTimeout(function () { var i = document.getElementById('siiga-senha-nova'); if (i) i.focus(); }, 50);
}
