-- Geração Tech 5.0: gestão do cadastro acadêmico.
-- Configurações da gestão (chave e valor). A regra de matrícula concluída ocupar vaga começa desligada:
-- a gestão ainda não confirmou essa regra (pendência no PR).
create table if not exists gt5_configuracao (
  chave          text primary key,
  valor          boolean not null,
  atualizado_em  timestamptz not null default now()
);

insert into gt5_configuracao (chave, valor)
values ('matriculas_concluidas_ocupam_vaga', false)
on conflict (chave) do nothing;

-- Última sincronização de turmas, por fonte: planilha (gestão) ou integração (site do GT).
create table if not exists gt5_sincronizacoes (
  fonte             text primary key check (fonte in ('planilha', 'integracao')),
  sincronizado_em   timestamptz not null default now(),
  turmas            integer not null default 0 check (turmas >= 0)
);

alter table gt5_configuracao enable row level security;
alter table gt5_sincronizacoes enable row level security;
