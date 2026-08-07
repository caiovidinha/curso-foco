-- =============================================================================
-- Curso Foco · Simulados — schema completo
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).
-- Ele é idempotente: pode ser reexecutado sem quebrar nada.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Catálogo de áreas e matérias (configurável)
-- -----------------------------------------------------------------------------

create table if not exists areas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  ordem       int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists materias (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references areas(id) on delete cascade,
  nome        text not null,
  ordem       int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (area_id, nome)
);

create index if not exists materias_area_idx on materias(area_id);

-- -----------------------------------------------------------------------------
-- 2. Turmas e alunos
-- -----------------------------------------------------------------------------

create table if not exists turmas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  ano         int,
  turno       text,
  created_at  timestamptz not null default now()
);

-- Código numérico de 4 dígitos usado no cartão-resposta (bolhas).
create sequence if not exists aluno_codigo_seq start 1 minvalue 1 maxvalue 9999 no cycle;

create table if not exists alunos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  codigo      int  not null unique default nextval('aluno_codigo_seq'),
  matricula   text,
  email       text,
  turma_id    uuid references turmas(id) on delete set null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists alunos_turma_idx on alunos(turma_id);

-- -----------------------------------------------------------------------------
-- 3. Simulados
-- -----------------------------------------------------------------------------

create table if not exists simulados (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  descricao      text,
  data           date,
  status         text not null default 'rascunho'
                 check (status in ('rascunho', 'aplicado', 'encerrado')),
  opcoes_padrao  int  not null default 5 check (opcoes_padrao between 2 and 10),
  created_at     timestamptz not null default now()
);

-- Blocos do simulado: quais matérias entram e em que ordem.
create table if not exists simulado_materias (
  id           uuid primary key default gen_random_uuid(),
  simulado_id  uuid not null references simulados(id) on delete cascade,
  materia_id   uuid not null references materias(id) on delete restrict,
  ordem        int  not null default 0,
  unique (simulado_id, materia_id)
);

create index if not exists simulado_materias_simulado_idx on simulado_materias(simulado_id);

create table if not exists questoes (
  id                   uuid primary key default gen_random_uuid(),
  simulado_id          uuid not null references simulados(id) on delete cascade,
  simulado_materia_id  uuid not null references simulado_materias(id) on delete cascade,
  numero               int  not null,
  -- multipla: objetiva, entra no cartão-resposta e no % de acerto
  -- discursiva: corrigida por nota (`peso` = nota máxima da questão)
  -- redacao: item único, `peso` = nota máxima (ENEM: 1000)
  tipo                 text not null default 'multipla'
                       check (tipo in ('multipla', 'discursiva', 'redacao')),
  -- 0 nos tipos sem alternativas
  num_opcoes           int  not null default 5 check (num_opcoes = 0 or num_opcoes between 2 and 10),
  gabarito             text,
  -- múltipla escolha: peso da questão. discursiva/redação: nota máxima.
  peso                 numeric(6, 2) not null default 1,
  enunciado_ref        text,
  created_at           timestamptz not null default now()
);

-- A numeração é recalculada em bloco quando a estrutura do simulado muda, o que
-- passa por estados intermediários duplicados. A restrição precisa ser adiada
-- para o fim da transação.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'questoes_simulado_numero_key'
  ) then
    alter table questoes
      add constraint questoes_simulado_numero_key
      unique (simulado_id, numero) deferrable initially deferred;
  end if;
end $$;

create index if not exists questoes_simulado_idx on questoes(simulado_id);
create index if not exists questoes_bloco_idx on questoes(simulado_materia_id);

-- Turmas às quais o simulado foi aplicado.
create table if not exists simulado_turmas (
  simulado_id  uuid not null references simulados(id) on delete cascade,
  turma_id     uuid not null references turmas(id) on delete cascade,
  primary key (simulado_id, turma_id)
);

-- -----------------------------------------------------------------------------
-- 4. Correção
-- -----------------------------------------------------------------------------

create table if not exists provas (
  id            uuid primary key default gen_random_uuid(),
  simulado_id   uuid not null references simulados(id) on delete cascade,
  aluno_id      uuid not null references alunos(id) on delete cascade,
  status        text not null default 'pendente'
                check (status in ('pendente', 'revisar', 'corrigida', 'ausente')),
  origem        text not null default 'manual' check (origem in ('manual', 'imagem')),
  imagem_path   text,
  observacoes   text,
  corrigida_em  timestamptz,
  created_at    timestamptz not null default now(),
  unique (simulado_id, aluno_id)
);

create index if not exists provas_simulado_idx on provas(simulado_id);
create index if not exists provas_aluno_idx on provas(aluno_id);

create table if not exists respostas (
  id          uuid primary key default gen_random_uuid(),
  prova_id    uuid not null references provas(id) on delete cascade,
  questao_id  uuid not null references questoes(id) on delete cascade,
  marcada     text,                       -- 'A'..'J', 'X' (rasura) ou null (branco)
  nota        numeric(6, 2),              -- usado em questões discursivas
  confianca   numeric(4, 3),              -- 0..1 quando veio de leitura automática
  revisada    boolean not null default false,
  unique (prova_id, questao_id)
);

create index if not exists respostas_prova_idx on respostas(prova_id);
create index if not exists respostas_questao_idx on respostas(questao_id);

-- -----------------------------------------------------------------------------
-- 5. View de análise (uma linha por resposta, já com acerto calculado)
-- -----------------------------------------------------------------------------

create or replace view vw_respostas_detalhe as
select
  r.id                as resposta_id,
  r.prova_id,
  r.marcada,
  r.nota,
  r.confianca,
  r.revisada,
  p.simulado_id,
  p.aluno_id,
  p.status            as prova_status,
  a.nome              as aluno_nome,
  a.codigo            as aluno_codigo,
  a.turma_id,
  t.nome              as turma_nome,
  s.titulo            as simulado_titulo,
  s.data              as simulado_data,
  q.id                as questao_id,
  q.numero,
  q.tipo,
  q.gabarito,
  q.peso,
  m.id                as materia_id,
  m.nome              as materia_nome,
  ar.id               as area_id,
  ar.nome             as area_nome,
  case
    -- só objetivas têm "acerto"; discursiva e redação valem pela nota
    when q.tipo <> 'multipla' then null
    when r.marcada is null or r.marcada = 'X' then false
    else r.marcada = q.gabarito
  end                 as acertou
from respostas r
join provas p             on p.id = r.prova_id
join questoes q           on q.id = r.questao_id
join simulados s          on s.id = p.simulado_id
join alunos a             on a.id = p.aluno_id
left join turmas t        on t.id = a.turma_id
join simulado_materias sm on sm.id = q.simulado_materia_id
join materias m           on m.id = sm.materia_id
join areas ar             on ar.id = m.area_id;

alter view vw_respostas_detalhe set (security_invoker = on);

-- -----------------------------------------------------------------------------
-- 6. RLS — acesso liberado para qualquer usuário autenticado (login do professor)
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'areas', 'materias', 'turmas', 'alunos', 'simulados', 'simulado_materias',
    'questoes', 'simulado_turmas', 'provas', 'respostas'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "auth_all" on %I', t);
    execute format(
      'create policy "auth_all" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Storage: bucket privado para as fotos dos cartões-resposta
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('cartoes', 'cartoes', false)
on conflict (id) do nothing;

drop policy if exists "cartoes_auth_all" on storage.objects;
create policy "cartoes_auth_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'cartoes')
  with check (bucket_id = 'cartoes');

-- -----------------------------------------------------------------------------
-- 8. Seed inicial do catálogo (padrão ENEM) — só insere se estiver vazio
-- -----------------------------------------------------------------------------

insert into areas (nome, ordem) values
  ('Linguagens e Códigos', 1),
  ('Ciências Humanas', 2),
  ('Ciências da Natureza', 3),
  ('Matemática', 4)
on conflict (nome) do nothing;

insert into materias (area_id, nome, ordem)
select a.id, v.nome, v.ordem
from (values
  ('Linguagens e Códigos', 'Português',   1),
  ('Linguagens e Códigos', 'Literatura',  2),
  ('Linguagens e Códigos', 'Inglês',      3),
  ('Linguagens e Códigos', 'Espanhol',    4),
  ('Linguagens e Códigos', 'Redação',     5),
  ('Ciências Humanas',     'História',    1),
  ('Ciências Humanas',     'Geografia',   2),
  ('Ciências Humanas',     'Filosofia',   3),
  ('Ciências Humanas',     'Sociologia',  4),
  ('Ciências da Natureza', 'Química',     1),
  ('Ciências da Natureza', 'Física',      2),
  ('Ciências da Natureza', 'Biologia',    3),
  ('Matemática',           'Matemática',  1)
) as v(area, nome, ordem)
join areas a on a.nome = v.area
on conflict (area_id, nome) do nothing;
