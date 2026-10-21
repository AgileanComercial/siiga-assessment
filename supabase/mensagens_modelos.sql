-- Tabela "mensagens_modelos": modelos editáveis das mensagens de envio do material
-- prévio (aba Agendamentos do admin, botão "Modelos de mensagem"). Valem para todos.
-- Sem linha para uma chave = a tela usa o texto padrão que está em material-previo.js.
--
-- Aplicar no Supabase de produção pelo SQL Editor (projeto ghtdfhupjoddfwiqzdpa).
-- É idempotente: pode rodar de novo sem erro.
--
-- Chaves: email_assunto, email_corpo, whatsapp_agendamento, whatsapp_lembrete.
-- Variáveis entre chaves no texto: {contato} {contato_completo} {empresa} {data_longa}
-- {data_curta} {hora} {link} {consultor} {pre_vendedor} {quem_aprova} {quem_aprova_na_empresa}.

create table if not exists public.mensagens_modelos (
  chave      text primary key
             check (chave in ('email_assunto', 'email_corpo', 'whatsapp_agendamento', 'whatsapp_lembrete')),
  texto      text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.mensagens_modelos enable row level security;

drop policy if exists "mensagens_modelos_select" on public.mensagens_modelos;
drop policy if exists "mensagens_modelos_insert" on public.mensagens_modelos;
drop policy if exists "mensagens_modelos_update" on public.mensagens_modelos;
drop policy if exists "mensagens_modelos_delete" on public.mensagens_modelos;

create policy "mensagens_modelos_select" on public.mensagens_modelos for select to anon, authenticated using (true);
create policy "mensagens_modelos_insert" on public.mensagens_modelos for insert to anon, authenticated with check (true);
create policy "mensagens_modelos_update" on public.mensagens_modelos for update to anon, authenticated using (true) with check (true);
-- Sem política de DELETE de propósito: "Restaurar padrão" grava o texto padrão por cima.
