// Função serverless da Vercel: convida usuários (e reenvia o convite) para o painel SIIGA.
// Existe porque o convite precisa da service role do Supabase, que NUNCA pode ir para o navegador.
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables, Production e Preview):
//   SUPABASE_URL                 ex.: https://<projeto>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    chave service_role (secreta; só existe aqui)
//
// Quem chama precisa mandar o JWT do próprio login (Authorization: Bearer <access_token>) e ser admin ATIVO
// em `perfis`. Sem dependências: usa o fetch do Node 18+ direto nas APIs do Supabase (GoTrue e PostgREST).
//
// POST /api/usuarios
//   { acao: 'convidar', nome, email, papel: 'admin'|'vendedor', redirectTo? }  -> envia o convite e grava o perfil
//   { acao: 'reenviar', email, redirectTo? }                                   -> reenvia o acesso (e-mail de definir senha)
// Respostas: { ok: true, ... } ou { ok: false, erro: <codigo>, mensagem } com o status HTTP adequado.

var PAPEIS = ['admin', 'vendedor'];
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}

async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return null; } }
  return await new Promise(function (resolve) {
    var buf = '';
    req.on('data', function (c) { buf += c; if (buf.length > 20000) { resolve(null); req.destroy(); } });
    req.on('end', function () { try { resolve(JSON.parse(buf || '{}')); } catch (e) { resolve(null); } });
    req.on('error', function () { resolve(null); });
  });
}

// Só a ORIGEM de redirectTo é usada (e o Supabase ainda confere contra a lista de Redirect URLs).
function origemSegura(redirectTo, req) {
  var cand = redirectTo || req.headers.origin || '';
  try {
    var u = new URL(cand);
    if (u.protocol === 'https:' || u.hostname === 'localhost') return u.origin;
  } catch (e) {}
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return responder(res, 405, { ok: false, erro: 'metodo', mensagem: 'Use POST.' }); }

  var URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  var CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!URL_BASE || !CHAVE) return responder(res, 500, { ok: false, erro: 'config', mensagem: 'Servidor sem configuração do Supabase. Avise o administrador do sistema.' });

  var auth = String(req.headers.authorization || '');
  var m = /^Bearer\s+(\S+)$/i.exec(auth);
  if (!m) return responder(res, 401, { ok: false, erro: 'sem_token', mensagem: 'Entre novamente.' });
  var jwt = m[1];

  try {
    // 1) o JWT é de um usuário válido?
    var ru = await fetch(URL_BASE + '/auth/v1/user', { headers: { apikey: CHAVE, Authorization: 'Bearer ' + jwt } });
    if (!ru.ok) return responder(res, 401, { ok: false, erro: 'token_invalido', mensagem: 'Sessão inválida ou expirada. Entre novamente.' });
    var quem = await ru.json();
    if (!quem || !quem.id) return responder(res, 401, { ok: false, erro: 'token_invalido', mensagem: 'Sessão inválida.' });

    // 2) e é admin ATIVO?
    var rp = await fetch(URL_BASE + '/rest/v1/perfis?user_id=eq.' + encodeURIComponent(quem.id) + '&select=papel,ativo',
      { headers: { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE } });
    var perfil = rp.ok ? (await rp.json())[0] : null;
    if (!perfil || perfil.papel !== 'admin' || perfil.ativo !== true) {
      return responder(res, 403, { ok: false, erro: 'proibido', mensagem: 'Só administradores podem gerenciar usuários.' });
    }

    var corpo = await lerCorpo(req);
    if (!corpo || typeof corpo !== 'object') return responder(res, 400, { ok: false, erro: 'corpo', mensagem: 'Pedido inválido.' });
    var email = String(corpo.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 200) return responder(res, 400, { ok: false, erro: 'email_invalido', mensagem: 'E-mail inválido.' });
    var origem = origemSegura(corpo.redirectTo, req);
    var qs = origem ? '?redirect_to=' + encodeURIComponent(origem + '/') : '';

    var H = { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE, 'Content-Type': 'application/json' };

    // upsert do perfil por user_id (service role: ignora a RLS)
    async function gravarPerfil(uid, nome, papel) {
      var rg = await fetch(URL_BASE + '/rest/v1/perfis?on_conflict=user_id', {
        method: 'POST',
        headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify([{ user_id: uid, nome: nome, email: email, papel: papel, ativo: true }])
      });
      return rg.ok;
    }
    async function convite(corpoInvite) {
      var r = await fetch(URL_BASE + '/auth/v1/invite' + qs, { method: 'POST', headers: H, body: JSON.stringify(corpoInvite) });
      return { status: r.status, dados: await r.json().catch(function () { return {}; }) };
    }
    function jaExiste(r) { return r.status === 422 && /exist|registered/i.test(String(r.dados.error_code || '') + ' ' + String(r.dados.msg || r.dados.message || '')); }

    if (corpo.acao === 'convidar') {
      var nome = String(corpo.nome || '').trim();
      var papel = String(corpo.papel || '');
      if (!nome || nome.length > 100) return responder(res, 400, { ok: false, erro: 'nome_invalido', mensagem: 'Informe o nome (até 100 caracteres).' });
      if (PAPEIS.indexOf(papel) < 0) return responder(res, 400, { ok: false, erro: 'papel_invalido', mensagem: 'Papel deve ser admin ou vendedor.' });

      var ri = await convite({ email: email, data: { nome: nome } });
      if (ri.status >= 200 && ri.status < 300) {
        if (!ri.dados.id) return responder(res, 502, { ok: false, erro: 'convite', mensagem: 'O Supabase não devolveu o usuário convidado.' });
        // Se a gravação do perfil falhar, o convite já saiu: tentar de novo com o mesmo e-mail completa o cadastro (ramo abaixo).
        if (!(await gravarPerfil(ri.dados.id, nome, papel))) {
          return responder(res, 502, { ok: false, erro: 'perfil', mensagem: 'O convite foi enviado, mas o perfil não foi gravado. Tente adicionar de novo com o mesmo e-mail: o cadastro é completado.' });
        }
        return responder(res, 200, { ok: true, user_id: ri.dados.id, email: email });
      }

      if (jaExiste(ri)) {
        // O usuário já existe no Supabase Auth (criado pelo painel, ou convite anterior cujo perfil não foi gravado).
        // Descobre o id por uma função SQL que só a service role executa (12f: public.user_id_por_email).
        var rid = await fetch(URL_BASE + '/rest/v1/rpc/user_id_por_email', { method: 'POST', headers: H, body: JSON.stringify({ p_email: email }) });
        if (!rid.ok) return responder(res, 502, { ok: false, erro: 'sql_pendente', mensagem: 'Este e-mail já existe no Supabase, mas falta aplicar o SQL 12f para completar o cadastro. Avise o administrador do sistema.' });
        var uid = await rid.json();
        if (typeof uid !== 'string' || !uid) return responder(res, 409, EMAIL_EXISTE);
        var rp2 = await fetch(URL_BASE + '/rest/v1/perfis?user_id=eq.' + encodeURIComponent(uid) + '&select=user_id', { headers: H });
        var existentes = rp2.ok ? await rp2.json() : null;
        if (!Array.isArray(existentes)) return responder(res, 502, { ok: false, erro: 'perfil', mensagem: 'Não foi possível conferir o perfil deste e-mail.' });
        if (existentes.length) return responder(res, 409, EMAIL_EXISTE);   // já tem perfil: só reenviar
        if (!(await gravarPerfil(uid, nome, papel))) return responder(res, 502, { ok: false, erro: 'perfil', mensagem: 'O usuário já existia, mas não foi possível gravar o perfil. Tente de novo.' });
        return responder(res, 200, { ok: true, user_id: uid, email: email, perfil_criado: true, mensagem: 'Este e-mail já tinha usuário; o perfil foi criado. A pessoa entra com a senha que já tem (ou use "Esqueci minha senha").' });
      }
      return responder(res, ri.status === 429 ? 429 : 502, erroInvite(ri.status, ri.dados));
    }

    if (corpo.acao === 'reenviar') {
      // 1) convidado que ainda não confirmou: o GoTrue reenvia o convite.
      var r1 = await convite({ email: email });
      if (r1.status >= 200 && r1.status < 300) return responder(res, 200, { ok: true, email: email, via: 'convite' });
      if (r1.status === 429) return responder(res, 429, erroInvite(429, r1.dados));
      if (!jaExiste(r1)) return responder(res, 502, erroInvite(r1.status, r1.dados));
      // 2) já confirmado: e-mail de recuperação (leva a "Crie uma nova senha").
      var rr = await fetch(URL_BASE + '/auth/v1/recover' + qs, { method: 'POST', headers: H, body: JSON.stringify({ email: email }) });
      if (!rr.ok) { var dr = await rr.json().catch(function () { return {}; }); return responder(res, rr.status === 429 ? 429 : 502, erroInvite(rr.status, dr)); }
      return responder(res, 200, { ok: true, email: email, via: 'recuperacao' });
    }

    return responder(res, 400, { ok: false, erro: 'acao', mensagem: 'Ação desconhecida.' });
  } catch (e) {
    // nunca registrar corpo, cabeçalhos nem chaves
    return responder(res, 500, { ok: false, erro: 'interno', mensagem: 'Erro interno ao falar com o Supabase.' });
  }
};

var EMAIL_EXISTE = { ok: false, erro: 'email_existe', mensagem: 'Este e-mail já tem usuário. Use "Reenviar convite" para mandar o acesso de novo.' };

function erroInvite(status, d) {
  var cod = String((d && (d.error_code || d.code)) || '');
  var msg = String((d && (d.msg || d.message || d.error_description)) || '');
  if (status === 422 && (/exist|registered/i.test(cod + ' ' + msg))) {
    return EMAIL_EXISTE;
  }
  if (status === 429 || /rate.?limit/i.test(cod + ' ' + msg)) {
    return { ok: false, erro: 'limite_email', mensagem: 'Limite de e-mails do Supabase atingido. Aguarde cerca de uma hora e tente de novo.' };
  }
  return { ok: false, erro: 'convite', mensagem: 'Não foi possível enviar o convite agora. Tente de novo em instantes.' };
}
