import Link from "next/link";
import { notFound } from "next/navigation";
import { GraficoBarras, GraficoQuestoes } from "@/components/charts";
import { EmptyState, Meter, Stat } from "@/components/ui";
import { getDetalhes, getSimulado } from "@/lib/queries";
import {
  dificuldadePorQuestao,
  fmtPct,
  porAluno,
  porArea,
  porMateria,
  porTurma,
  resumo,
} from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function ResultadosPage({ params }: PageProps<"/simulados/[id]/resultados">) {
  const { id } = await params;
  const [simulado, linhas] = await Promise.all([getSimulado(id), getDetalhes({ simuladoId: id })]);
  if (!simulado) notFound();

  if (linhas.length === 0) {
    return (
      <EmptyState
        titulo="Nenhuma prova corrigida"
        descricao="Os resultados aparecem aqui assim que a primeira correção deste simulado for concluída."
        acao={
          <Link href={`/simulados/${id}/correcao`} className="btn btn-primary btn-sm">
            Ir para a correção
          </Link>
        }
      />
    );
  }

  const total = resumo(linhas);
  const alunos = porAluno(linhas);
  const materias = porMateria(linhas);
  const areas = porArea(linhas).sort((a, b) => b.percentual - a.percentual);
  const turmas = porTurma(linhas);
  const questoes = dificuldadePorQuestao(linhas);
  const dificeis = [...questoes].sort((a, b) => a.percentual - b.percentual).slice(0, 5);

  return (
    <>
      <section className="card mb-4 p-5">
        <div className="section-title">Média do simulado</div>
        <div className="mt-1 text-5xl font-semibold tracking-tight">{fmtPct(total.percentual)}</div>
        <p className="mt-2 text-sm text-muted">
          {alunos.length} {alunos.length === 1 ? "aluno corrigido" : "alunos corrigidos"} ·{" "}
          {total.total.toLocaleString("pt-BR")} respostas objetivas
        </p>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Maior nota" valor={fmtPct(alunos[0]?.percentual ?? 0)} hint={alunos[0]?.rotulo} />
        <Stat
          label="Menor nota"
          valor={fmtPct(alunos[alunos.length - 1]?.percentual ?? 0)}
          hint={alunos[alunos.length - 1]?.rotulo}
        />
        <Stat label="Erros" valor={total.erros} />
        <Stat label="Em branco" valor={total.brancos} />
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 text-base font-semibold">Acerto por área</h2>
          <p className="mb-4 text-xs text-muted">Média de todos os alunos corrigidos.</p>
          <GraficoBarras
            dados={areas.map((a) => ({
              rotulo: a.rotulo,
              valor: Number(a.percentual.toFixed(1)),
              extra: `${a.acertos}/${a.total}`,
            }))}
            maxRotulo={140}
          />
        </section>

        <section className="card p-5">
          <h2 className="mb-1 text-base font-semibold">Acerto por matéria</h2>
          <p className="mb-4 text-xs text-muted">Da mais dominada à mais crítica.</p>
          <GraficoBarras
            dados={materias.map((m) => ({
              rotulo: m.rotulo,
              valor: Number(m.percentual.toFixed(1)),
              extra: `${m.acertos}/${m.total}`,
            }))}
          />
        </section>
      </div>

      <section className="card mb-6 p-5">
        <h2 className="mb-1 text-base font-semibold">Dificuldade por questão</h2>
        <p className="mb-4 text-xs text-muted">
          Percentual de acerto de cada questão. Em tinta cheia, as abaixo de 40% — as mais críticas.
        </p>
        <GraficoQuestoes dados={questoes.map((q) => ({ numero: q.numero, valor: Number(q.percentual.toFixed(1)) }))} />

        {dificeis.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {dificeis.map((q) => (
              <li key={q.chave} className="badge tabular">
                Q{q.numero} · {fmtPct(q.percentual)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {turmas.length > 1 && (
        <section className="card mb-6 p-5">
          <h2 className="mb-1 text-base font-semibold">Comparativo entre turmas</h2>
          <p className="mb-4 text-xs text-muted">Média de acerto neste simulado.</p>
          <GraficoBarras
            dados={turmas.map((t) => ({
              rotulo: t.rotulo,
              valor: Number(t.percentual.toFixed(1)),
              extra: `${t.acertos}/${t.total}`,
            }))}
          />
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">Classificação</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Aluno</th>
                <th className="text-right">Acertos</th>
                <th className="hidden text-right sm:table-cell">Erros</th>
                <th className="hidden text-right sm:table-cell">Branco</th>
                <th className="w-36">%</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map((a, i) => (
                <tr key={a.chave}>
                  <td className="tabular text-sub">{i + 1}</td>
                  <td className="font-medium">{a.rotulo}</td>
                  <td className="tabular text-right">
                    {a.acertos}
                    <span className="text-sub">/{a.total}</span>
                  </td>
                  <td className="tabular hidden text-right sm:table-cell">{a.erros}</td>
                  <td className="tabular hidden text-right sm:table-cell">{a.brancos}</td>
                  <td>
                    <Meter valor={a.percentual} label={fmtPct(a.percentual)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
