-- =============================================================================
-- Migração 001 — tipos de questão lançados por nota
--
-- Rode no SQL Editor se você já tinha executado o schema.sql anterior.
-- Quem for instalar do zero não precisa: o schema.sql já está atualizado.
-- É idempotente.
--
-- O que muda:
--   1. `tipo` passa a aceitar 'redacao' (item único, nota máxima própria).
--   2. `num_opcoes` passa a aceitar 0 — CORREÇÃO DE BUG: a restrição antiga
--      exigia entre 2 e 10, então criar um bloco DISCURSIVO falhava, porque
--      questão sem alternativa é gravada com 0.
--   3. A view deixa de calcular "acerto" para qualquer tipo que não seja
--      múltipla escolha (antes ela só isentava 'discursiva').
-- =============================================================================

-- 1 e 3: tipo -----------------------------------------------------------------

alter table questoes drop constraint if exists questoes_tipo_check;

alter table questoes
  add constraint questoes_tipo_check
  check (tipo in ('multipla', 'discursiva', 'redacao'));

-- 2: alternativas -------------------------------------------------------------

alter table questoes drop constraint if exists questoes_num_opcoes_check;

-- normaliza o que já existe antes de apertar a regra de novo
update questoes set num_opcoes = 0 where tipo <> 'multipla' and num_opcoes <> 0;
update questoes set num_opcoes = 5 where tipo = 'multipla' and num_opcoes not between 2 and 10;

alter table questoes
  add constraint questoes_num_opcoes_check
  check (num_opcoes = 0 or num_opcoes between 2 and 10);

-- 3: view ---------------------------------------------------------------------

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
