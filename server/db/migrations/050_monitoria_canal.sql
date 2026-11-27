-- Canal de monitoria: conversas técnicas com o robô e com a monitoria, separadas do atendimento geral.
-- Um aluno pode ter uma conversa aberta em cada canal ao mesmo tempo.
alter table atendimento_sessoes
  add column if not exists canal text not null default 'atendimento' check (canal in ('atendimento', 'monitoria'));
drop index if exists atendimento_sessoes_ativa_idx;
create unique index if not exists atendimento_sessoes_ativa_idx
  on atendimento_sessoes (user_id, canal) where status <> 'finalizado';

-- Perguntas do robô também por canal (as da monitoria são técnicas).
alter table atendimento_faq
  add column if not exists canal text not null default 'atendimento' check (canal in ('atendimento', 'monitoria'));
