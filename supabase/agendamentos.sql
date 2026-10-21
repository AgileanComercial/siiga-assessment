-- Tabela "agendamentos": reuniões de diagnóstico agendadas pela pré-venda na aba
-- Agendamentos do admin (admin.html / admin.js). Cada linha gera o PDF
-- "Preparação para o Diagnóstico SIIGA" (material-previo.js) e as mensagens de envio.
--
-- Aplicar no Supabase de produção pelo SQL Editor (projeto ghtdfhupjoddfwiqzdpa).
-- É idempotente: pode rodar de novo sem erro.
--
-- RLS: espelha o acesso que o admin já usa em "assessments". O repositório não
-- tem o SQL de "assessments"; pelo código, o admin lê, insere, atualiza e exclui
-- assessments com a chave anon (admin.js: select/insert/upsert/delete), então a
-- política efetiva lá é de acesso total para anon. As políticas abaixo dão o
-- mesmo acesso a "agendamentos", exceto DELETE (a tela não exclui). Se as políticas de "assessments" forem mais
-- restritas do que isso, ajuste estas para ficarem iguais.

create table if not exists public.agendamentos (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  empresa            text not null,
  contato            text not null,
  cargo              text,
  email              text,
  whatsapp           text,
  data_reuniao       date not null,
  hora_reuniao       time not null,
  link               text,
  consultor          text not null,
  consultor_email    text,
  consultor_whatsapp text,          -- só dígitos, com DDI (ex.: 5511978119471)
  pre_vendedor       text not null,
  decisor            text,
  decisor_cargo      text,
  status             text not null default 'agendado'
                     check (status in ('agendado', 'realizado', 'cancelado')),
  pdf_gerado_em      timestamptz,
  assessment_id      bigint         -- futuro: liga ao diagnóstico (assessments.id); sem FK por enquanto
);

create index if not exists agendamentos_data_idx on public.agendamentos (data_reuniao desc, hora_reuniao desc);

alter table public.agendamentos enable row level security;

drop policy if exists "agendamentos_select" on public.agendamentos;
drop policy if exists "agendamentos_insert" on public.agendamentos;
drop policy if exists "agendamentos_update" on public.agendamentos;
drop policy if exists "agendamentos_delete" on public.agendamentos;

create policy "agendamentos_select" on public.agendamentos for select to anon, authenticated using (true);
create policy "agendamentos_insert" on public.agendamentos for insert to anon, authenticated with check (true);
create policy "agendamentos_update" on public.agendamentos for update to anon, authenticated using (true) with check (true);
-- Sem política de DELETE de propósito: a aba não exclui agendamentos (cancelar = status "cancelado").
-- Com RLS ligado e sem política, ninguém exclui pela chave anon.
