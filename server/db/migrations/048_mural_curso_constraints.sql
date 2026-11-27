-- Reaplica o estado final do mural (037 e 040) de forma idempotente.
-- Sintoma: aviso ou tópico do fórum de curso recusado com "Dados inválidos" (violação de check).
-- O banco pode ter registrado a 037/040 sem concluir todos os passos; rodar esta é seguro mesmo assim.

alter table turma_posts alter column turma_id drop not null;
alter table turma_posts add column if not exists grupo_id uuid references course_groups (id) on delete cascade;
alter table turma_posts add column if not exists curso_id uuid references courses (id) on delete cascade;
alter table turma_posts add column if not exists ocultado boolean not null default false;
alter table turma_respostas add column if not exists ocultada boolean not null default false;

update turma_posts set tipo = 'forum' where tipo = 'duvida';
alter table turma_posts alter column tipo set default 'forum';
alter table turma_posts drop constraint if exists turma_posts_tipo_check;
alter table turma_posts add constraint turma_posts_tipo_check check (tipo in ('aviso', 'forum'));

-- Um post pertence a exatamente um espaço: turma, grupo ou curso.
alter table turma_posts drop constraint if exists turma_posts_espaco_check;
alter table turma_posts add constraint turma_posts_espaco_check
  check ((turma_id is not null)::int + (grupo_id is not null)::int + (curso_id is not null)::int = 1);

create index if not exists turma_posts_curso_idx on turma_posts (curso_id);
