-- Papel de monitoria: ajuda os alunos (mural e espaços de código) e bate ponto como os professores.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin', 'teacher', 'student', 'atendente', 'gestao', 'editor', 'monitor'));
