-- Geração Tech 5.0: cadastro acadêmico (formações, polos, lideranças territoriais).
-- Fonte: docs/GT5-DIRETRIZES.md, seções 2 e 3. Só o que o documento define; o que falta fica em branco/nulo.
-- As formações entram ocultas e sem matrícula pelo site (visible = false, self_enrolment = false)
-- até a liberação da edição.

-- Polos são locais presenciais, como as sedes que já existem. O tipo separa uns dos outros.
alter table sedes add column if not exists tipo text not null default 'sede' check (tipo in ('sede', 'polo'));

-- Dados da edição 5.0 de cada formação. Carga horária e duração ficam nulas quando o documento não informa.
-- As vagas são divididas por modalidade e local, e a soma tem que bater com o total.
create table if not exists formacoes_edicao (
  course_id        uuid primary key references courses (id) on delete cascade,
  edicao           text not null default 'GT5' check (edicao = 'GT5'),
  carga_horaria    integer check (carga_horaria is null or carga_horaria > 0),
  duracao_semanas  integer check (duracao_semanas is null or duracao_semanas > 0),
  vagas_total      integer not null check (vagas_total > 0),
  vagas_online     integer not null check (vagas_online >= 0),
  vagas_fortaleza  integer not null check (vagas_fortaleza >= 0),
  vagas_interior   integer not null check (vagas_interior >= 0),
  constraint formacoes_edicao_vagas_somam check (vagas_online + vagas_fortaleza + vagas_interior = vagas_total)
);

-- Lideranças territoriais. Ligadas a um polo quando o polo é conhecido.
create table if not exists liderancas_territoriais (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(trim(nome)) > 0),
  email       text not null default '',
  telefone    text not null default '',
  polo_id     uuid references sedes (id) on delete set null,
  ativa       boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists liderancas_polo_idx on liderancas_territoriais (polo_id);

alter table formacoes_edicao          enable row level security;
alter table liderancas_territoriais   enable row level security;

-- Formações da edição 5.0 (título e perfil profissional conforme o documento, seção 2).
insert into courses (slug, title, summary, estimated_hours, visible, self_enrolment)
values
  ('gt5-desenvolvedor-ia-first', 'Desenvolvedor Inteligência Artificial First',
   'Desenvolvedor capaz de especificar arquiteturas, utilizar IA para geração de código e garantir qualidade, segurança e confiabilidade das soluções.',
   192, false, false),
  ('gt5-projetos-ia-empresas', 'Projetos de Inteligência Artificial para Empresas',
   'Pessoa capaz de identificar oportunidades de aplicação da IA nos negócios, diagnosticar processos, trabalhar com dados e desenvolver soluções de automação empresarial.',
   0, false, false),
  ('gt5-full-cycle-ai', 'Full Cycle AI',
   'Desenvolvedor com capacidade de construir e manter sistemas completos utilizando Inteligência Artificial, agentes e arquiteturas modernas.',
   0, false, false)
on conflict (slug) do nothing;

insert into formacoes_edicao (course_id, carga_horaria, duracao_semanas, vagas_total, vagas_online, vagas_fortaleza, vagas_interior)
select c.id, v.carga_horaria, v.duracao_semanas, v.vagas_total, v.vagas_online, v.vagas_fortaleza, v.vagas_interior
from (values
  ('gt5-desenvolvedor-ia-first', 192, 12, 1000, 600, 200, 200),
  ('gt5-projetos-ia-empresas',   null, null, 400, 240, 40, 120),
  ('gt5-full-cycle-ai',          null, null, 300, 220, 80, 0)
) as v(slug, carga_horaria, duracao_semanas, vagas_total, vagas_online, vagas_fortaleza, vagas_interior)
join courses c on c.slug = v.slug
on conflict (course_id) do nothing;

-- Polos presenciais (seção 3): Sobral, Juazeiro do Norte e Limoeiro do Norte.
insert into sedes (nome, cidade, uf, tipo, ativa)
select v.cidade, v.cidade, 'CE', 'polo', true
from (values ('Sobral'), ('Juazeiro do Norte'), ('Limoeiro do Norte')) as v(cidade)
where not exists (select 1 from sedes s where lower(s.nome) = lower(v.cidade));
