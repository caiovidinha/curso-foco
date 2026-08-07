import Link from "next/link";
import { notFound } from "next/navigation";
import { excluirAluno, salvarAluno } from "@/app/actions/pessoas";
import { GraficoBarras, GraficoEvolucao } from "@/components/charts";
import { BotaoAcao, BotaoSubmit, FormAcao } from "@/components/forms";
import { IconTrash } from "@/components/icons";
import { EmptyState, Field, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { getAluno, getDetalhes, getTurmas } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { fmtData, fmtPct, porMateria, porSimulado, resumo } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function AlunoPage({ params }: PageProps<"/alunos/[id]">) {
  const { id } = await params;

  const aluno = await getAluno(id);
  if (!aluno) notFound();

  const supabase = await createClient();
  const [linhas, turmas, { data: provasRaw }] = await Promise.all([
    getDetalhes({ alunoId: id }),
    getTurmas(),
    supabase
      .from("provas")
      .select("id, status, simulados(id, titulo, data)")
      .eq("aluno_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const linhasTurma = aluno.turma_id ? await getDetalhes({ turmaId: aluno.turma_id }) : [];

  const total = resumo(linhas);
  const materias = porMateria(linhas);

  // evolução do aluno com a média da turma como referência tracejada
  const doAluno = porSimulado(linhas);
  const daTurma = new Map(porSimulado(linhasTurma).map((s) => [s.chave, s.percentual]));
  const evolucao = doAluno.map((s) => ({
    rotulo: s.rotulo.length > 18 ? s.rotulo.slice(0, 17) + "…" : s.rotulo,
    aluno: Number(s.percentual.toFixed(1)),
    turma: daTurma.has(s.chave) ? Number(daTurma.get(s.chave)!.toFixed(1)) : 0,
  }));

  type ProvaLinha = {
    id: string;
    status: string;
    simulados: { id: string; titulo: string; data: string | null } | null;
  };
  const provas = (provasRaw ?? []) as unknown as ProvaLinha[];

  return (
    <>
      <PageHeader
        titulo={aluno.nome}
        voltar="/alunos"
        subtitulo={
          <span className="tabular">
            Código {String(aluno.codigo).padStart(4, "0")}
            {aluno.turmas && ` · ${aluno.turmas.nome}`}
            {aluno.matricula && ` · mat. ${aluno.matricula}`}
          </span>
        }
        acoes={
          <BotaoAcao
            action={excluirAluno}
            campos={{ id: aluno.id }}
            className="btn btn-outline btn-sm"
            confirmar={`Excluir "${aluno.nome}" e todas as suas correções?`}
          >
            <IconTrash width={15} height={15} />
            Excluir
          </BotaoAcao>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Média de acerto" valor={fmtPct(total.percentual)} />
        <Stat label="Acertos" valor={total.acertos} sufixo={`/ ${total.total}`} />
        <Stat label="Erros" valor={total.erros} />
        <Stat label="Em branco" valor={total.brancos} />
      </section>

      {linhas.length === 0 ? (
        <EmptyState
          titulo="Sem correções ainda"
          descricao="Assim que uma prova deste aluno for corrigida, o histórico e os gráficos aparecem aqui."
        />
      ) : (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-1 text-base font-semibold">Acerto por matéria</h2>
            <p className="mb-4 text-xs text-muted">Todas as questões objetivas já corrigidas.</p>
            <GraficoBarras
              dados={materias.map((m) => ({
                rotulo: m.rotulo,
                valor: Number(m.percentual.toFixed(1)),
                extra: `${m.acertos}/${m.total}`,
              }))}
            />
          </section>

          <section className="card p-5">
            <h2 className="mb-1 text-base font-semibold">Evolução por simulado</h2>
            <p className="mb-4 text-xs text-muted">
              {aluno.turmas ? `Comparado à média de ${aluno.turmas.nome}.` : "Percentual de acerto."}
            </p>
            <GraficoEvolucao
              dados={evolucao}
              series={
                aluno.turma_id
                  ? [
                      { nome: aluno.nome.split(" ")[0], chave: "aluno" },
                      { nome: "Média da turma", chave: "turma", tracejado: true },
                    ]
                  : [{ nome: "Acerto", chave: "aluno" }]
              }
            />
          </section>
        </div>
      )}

      {materias.length > 0 && (
        <section className="card mb-6 overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-base font-semibold">Detalhamento por matéria</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Matéria</th>
                  <th className="text-right">Acertos</th>
                  <th className="text-right">Erros</th>
                  <th className="text-right">Branco</th>
                  <th className="text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {materias.map((m) => (
                  <tr key={m.chave}>
                    <td className="font-medium">{m.rotulo}</td>
                    <td className="tabular text-right">{m.acertos}</td>
                    <td className="tabular text-right">{m.erros}</td>
                    <td className="tabular text-right">{m.brancos}</td>
                    <td className="tabular text-right font-semibold">{fmtPct(m.percentual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {provas.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-base font-semibold">Provas</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {provas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/correcao/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-soft"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.simulados?.titulo ?? "—"}</div>
                    <div className="tabular mt-0.5 text-xs text-muted">
                      {fmtData(p.simulados?.data ?? null)}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FormAcao action={salvarAluno} className="card p-4">
        <div className="section-title mb-3">Editar cadastro</div>
        <input type="hidden" name="id" value={aluno.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo">
            <input className="input" name="nome" defaultValue={aluno.nome} required />
          </Field>
          <Field label="Turma">
            <select className="select" name="turma_id" defaultValue={aluno.turma_id ?? ""}>
              <option value="">Sem turma</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Matrícula">
            <input className="input" name="matricula" defaultValue={aluno.matricula ?? ""} />
          </Field>
          <Field label="E-mail">
            <input className="input" name="email" type="email" defaultValue={aluno.email ?? ""} />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={aluno.ativo} className="size-4 accent-[var(--ink)]" />
          Aluno ativo
        </label>
        <BotaoSubmit className="btn btn-primary mt-4">Salvar alterações</BotaoSubmit>
      </FormAcao>
    </>
  );
}
