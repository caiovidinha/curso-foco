import Link from "next/link";
import { notFound } from "next/navigation";
import { excluirTurma, importarAlunos, salvarTurma } from "@/app/actions/pessoas";
import { GraficoBarras, GraficoEvolucao } from "@/components/charts";
import { BotaoAcao, BotaoSubmit, FormAcao } from "@/components/forms";
import { IconChevron, IconTrash } from "@/components/icons";
import { EmptyState, Field, Meter, PageHeader, Stat } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getAlunos, getDetalhes } from "@/lib/queries";
import { fmtPct, porAluno, porMateria, porSimulado, resumo } from "@/lib/scoring";
import type { Turma } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TurmaPage({ params }: PageProps<"/turmas/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: turma } = await supabase.from("turmas").select("*").eq("id", id).maybeSingle();
  if (!turma) notFound();

  const t = turma as Turma;
  const [alunos, linhas] = await Promise.all([getAlunos({ turmaId: id }), getDetalhes({ turmaId: id })]);

  const total = resumo(linhas);
  const materias = porMateria(linhas);
  const ranking = porAluno(linhas);
  const evolucao = porSimulado(linhas).map((s) => ({
    rotulo: s.rotulo.length > 18 ? s.rotulo.slice(0, 17) + "…" : s.rotulo,
    media: Number(s.percentual.toFixed(1)),
  }));

  return (
    <>
      <PageHeader
        titulo={t.nome}
        voltar="/turmas"
        subtitulo={[t.ano, t.turno].filter(Boolean).join(" · ") || undefined}
        acoes={
          <BotaoAcao
            action={excluirTurma}
            campos={{ id: t.id }}
            className="btn btn-outline btn-sm"
            confirmar={`Excluir a turma "${t.nome}"? Os alunos ficarão sem turma.`}
          >
            <IconTrash width={15} height={15} />
            Excluir
          </BotaoAcao>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alunos" valor={alunos.length} />
        <Stat label="Média de acerto" valor={fmtPct(total.percentual)} />
        <Stat label="Questões corrigidas" valor={total.total} />
        <Stat label="Em branco" valor={total.brancos} />
      </section>

      {linhas.length > 0 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-1 text-base font-semibold">Acerto por matéria</h2>
            <p className="mb-4 text-xs text-muted">Média da turma em todos os simulados corrigidos.</p>
            <GraficoBarras
              dados={materias.map((m) => ({
                rotulo: m.rotulo,
                valor: Number(m.percentual.toFixed(1)),
                extra: `${m.acertos}/${m.total}`,
              }))}
            />
          </section>

          <section className="card p-5">
            <h2 className="mb-1 text-base font-semibold">Evolução da turma</h2>
            <p className="mb-4 text-xs text-muted">Percentual médio por simulado.</p>
            <GraficoEvolucao dados={evolucao} series={[{ nome: "Média da turma", chave: "media" }]} />
          </section>
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-3 text-base font-semibold">Alunos</h2>

        {alunos.length === 0 ? (
          <EmptyState
            titulo="Turma sem alunos"
            descricao="Use a importação rápida abaixo para cadastrar vários de uma vez."
          />
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {alunos.map((a) => {
              const desempenho = ranking.find((r) => r.chave === a.id);
              return (
                <li key={a.id}>
                  <Link
                    href={`/alunos/${a.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-soft"
                  >
                    <span className="tabular w-12 shrink-0 text-xs text-sub">
                      {String(a.codigo).padStart(4, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {a.nome}
                      {!a.ativo && <span className="badge ml-2">inativo</span>}
                    </span>
                    <div className="w-32 shrink-0 sm:w-44">
                      {desempenho ? (
                        <Meter valor={desempenho.percentual} label={fmtPct(desempenho.percentual)} />
                      ) : (
                        <span className="block text-right text-xs text-sub">sem correções</span>
                      )}
                    </div>
                    <IconChevron width={16} height={16} className="shrink-0 text-sub" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormAcao action={salvarTurma} className="card p-4">
          <div className="section-title mb-3">Editar turma</div>
          <input type="hidden" name="id" value={t.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nome">
              <input className="input" name="nome" defaultValue={t.nome} required />
            </Field>
            <Field label="Ano">
              <input className="input tabular" name="ano" type="number" defaultValue={t.ano ?? ""} />
            </Field>
            <Field label="Turno">
              <select className="select" name="turno" defaultValue={t.turno ?? ""}>
                <option value="">—</option>
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
                <option value="Noite">Noite</option>
                <option value="Integral">Integral</option>
              </select>
            </Field>
          </div>
          <BotaoSubmit className="btn btn-primary mt-3">Salvar alterações</BotaoSubmit>
        </FormAcao>

        <FormAcao action={importarAlunos} limpar className="card p-4">
          <div className="section-title mb-3">Importação rápida</div>
          <input type="hidden" name="turma_id" value={t.id} />
          <Field
            label="Um aluno por linha"
            hint='Opcionalmente "Nome; matrícula". O código do cartão é gerado automaticamente.'
          >
            <textarea
              className="textarea font-mono text-xs"
              name="lista"
              rows={6}
              placeholder={"Ana Beatriz Souza\nCarlos Eduardo Lima; 20241\nDaniela Rocha"}
              required
            />
          </Field>
          <BotaoSubmit className="btn btn-primary mt-3" pendente="Importando…">
            Importar alunos
          </BotaoSubmit>
        </FormAcao>
      </div>
    </>
  );
}
