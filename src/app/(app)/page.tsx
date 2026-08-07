import Link from "next/link";
import { GraficoBarras, GraficoEvolucao } from "@/components/charts";
import { IconChevron, IconPlus } from "@/components/icons";
import { EmptyState, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { getDetalhes, getResumoGeral, getSimulados } from "@/lib/queries";
import { fmtData, fmtPct, porArea, porSimulado, resumo } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [geral, simulados] = await Promise.all([getResumoGeral(), getSimulados()]);

  // o painel olha só para as aplicações recentes — o histórico completo vive nas
  // páginas de aluno, turma e simulado
  const recentes = simulados.slice(0, 8);
  const linhas = await getDetalhes({ simuladoIds: recentes.map((s) => s.id) });

  const total = resumo(linhas);
  const areas = porArea(linhas).sort((a, b) => b.percentual - a.percentual);
  const evolucao = porSimulado(linhas).map((s) => ({
    rotulo: s.rotulo.length > 18 ? s.rotulo.slice(0, 17) + "…" : s.rotulo,
    media: Number(s.percentual.toFixed(1)),
  }));

  return (
    <>
      <PageHeader
        titulo="Painel"
        subtitulo="Visão geral do desempenho e das correções pendentes."
        acoes={
          <Link href="/simulados/novo" className="btn btn-primary btn-sm">
            <IconPlus width={15} height={15} />
            Novo simulado
          </Link>
        }
      />

      {total.total > 0 && (
        <section className="card mb-4 p-5">
          <div className="section-title">Média geral de acerto</div>
          <div className="mt-1 text-5xl font-semibold tracking-tight">{fmtPct(total.percentual)}</div>
          <p className="mt-2 text-sm text-muted">
            {total.acertos.toLocaleString("pt-BR")} acertos em{" "}
            {total.total.toLocaleString("pt-BR")} questões objetivas corrigidas ·{" "}
            {total.brancos.toLocaleString("pt-BR")} em branco
          </p>
        </section>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alunos ativos" valor={geral.alunos} />
        <Stat label="Turmas" valor={geral.turmas} />
        <Stat label="Simulados" valor={geral.simulados} />
        <Stat
          label="A corrigir"
          valor={geral.pendentes}
          hint={geral.pendentes > 0 ? "provas pendentes ou em revisão" : "tudo em dia"}
        />
      </section>

      {linhas.length === 0 ? (
        <EmptyState
          titulo="Nenhuma correção ainda"
          descricao="Crie um simulado, monte o gabarito e corrija a primeira prova para os gráficos aparecerem aqui."
          acao={
            <Link href="/simulados/novo" className="btn btn-primary btn-sm">
              Criar simulado
            </Link>
          }
        />
      ) : (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-1 text-base font-semibold">Acerto por área</h2>
            <p className="mb-4 text-xs text-muted">
              Percentual médio nos {recentes.length} simulados mais recentes.
            </p>
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
            <h2 className="mb-1 text-base font-semibold">Média por simulado</h2>
            <p className="mb-4 text-xs text-muted">Evolução do percentual de acerto da escola.</p>
            <GraficoEvolucao dados={evolucao} series={[{ nome: "Média geral", chave: "media" }]} />
          </section>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Simulados recentes</h2>
          <Link href="/simulados" className="text-xs font-medium text-muted hover:text-ink">
            Ver todos
          </Link>
        </div>

        {simulados.length === 0 ? (
          <EmptyState titulo="Nenhum simulado cadastrado" />
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {simulados.slice(0, 5).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/simulados/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-soft"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.titulo}</div>
                    <div className="tabular mt-0.5 text-xs text-muted">
                      {fmtData(s.data)} · {s.qtdQuestoes} questões · {s.qtdProvas} provas
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                  <IconChevron width={16} height={16} className="shrink-0 text-sub" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
