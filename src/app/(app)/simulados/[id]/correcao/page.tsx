import Link from "next/link";
import { notFound } from "next/navigation";
import { criarProva } from "@/app/actions/correcao";
import { gerarProvas } from "@/app/actions/simulados";
import { BotaoAcao, BotaoSubmit } from "@/components/forms";
import { IconCamera, IconChevron, IconPrint } from "@/components/icons";
import { EmptyState, Field, Meter, Stat, StatusBadge } from "@/components/ui";
import { getAlunos, getDetalhes, getProvas, getSimulado } from "@/lib/queries";
import { fmtPct, porAluno } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function CorrecaoListaPage({ params }: PageProps<"/simulados/[id]/correcao">) {
  const { id } = await params;

  const [simulado, provas, linhas, alunos] = await Promise.all([
    getSimulado(id),
    getProvas(id),
    getDetalhes({ simuladoId: id }),
    getAlunos(),
  ]);

  if (!simulado) notFound();

  const desempenho = new Map(porAluno(linhas).map((a) => [a.chave, a]));
  const jaTem = new Set(provas.map((p) => p.aluno_id));
  const disponiveis = alunos.filter((a) => !jaTem.has(a.id));

  const contagem = {
    total: provas.length,
    corrigidas: provas.filter((p) => p.status === "corrigida").length,
    pendentes: provas.filter((p) => p.status === "pendente").length,
    revisar: provas.filter((p) => p.status === "revisar").length,
  };

  const semGabarito = simulado.questoes.filter((q) => q.tipo === "multipla" && !q.gabarito).length;

  return (
    <>
      {semGabarito > 0 && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            <strong className="tabular">{semGabarito}</strong> questões objetivas ainda estão sem
            gabarito — as correções não vão contar acerto.
          </p>
          <Link href={`/simulados/${id}/gabarito`} className="btn btn-outline btn-sm">
            Definir gabarito
          </Link>
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Provas" valor={contagem.total} />
        <Stat label="Corrigidas" valor={contagem.corrigidas} />
        <Stat label="Pendentes" valor={contagem.pendentes} />
        <Stat label="Em revisão" valor={contagem.revisar} />
      </section>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href={`/simulados/${id}/leitura`} className="btn btn-primary btn-sm">
          <IconCamera width={16} height={16} />
          Corrigir por foto
        </Link>
        <Link href={`/imprimir/cartoes/${id}`} target="_blank" className="btn btn-outline btn-sm">
          <IconPrint width={16} height={16} />
          Imprimir cartões
        </Link>
        <BotaoAcao action={gerarProvas} campos={{ simulado_id: id }} className="btn btn-outline btn-sm">
          Gerar provas das turmas
        </BotaoAcao>
      </div>

      {provas.length === 0 ? (
        <EmptyState
          titulo="Nenhuma prova nesta aplicação"
          descricao="Vincule turmas na aba Estrutura e clique em “Gerar provas das turmas”, ou adicione alunos avulsos abaixo."
        />
      ) : (
        <section className="card mb-6 overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th className="hidden sm:table-cell">Turma</th>
                  <th>Situação</th>
                  <th className="w-40">Acerto</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {provas.map((p) => {
                  const d = desempenho.get(p.aluno_id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="font-medium">{p.alunos.nome}</div>
                        <div className="tabular text-xs text-sub">
                          {String(p.alunos.codigo).padStart(4, "0")}
                        </div>
                      </td>
                      <td className="hidden text-muted sm:table-cell">
                        {p.alunos.turmas?.nome ?? "—"}
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td>
                        {d ? (
                          <Meter valor={d.percentual} label={fmtPct(d.percentual)} />
                        ) : (
                          <span className="text-xs text-sub">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/correcao/${p.id}`}
                          className="btn btn-outline btn-sm"
                          aria-label={`Corrigir prova de ${p.alunos.nome}`}
                        >
                          Corrigir
                          <IconChevron width={14} height={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {disponiveis.length > 0 && (
        <form action={criarProva} className="card p-4">
          <div className="section-title mb-3">Adicionar aluno avulso</div>
          <input type="hidden" name="simulado_id" value={id} />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Aluno">
              <select className="select" name="aluno_id" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {disponiveis.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                    {a.turmas?.nome ? ` — ${a.turmas.nome}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <BotaoSubmit className="btn btn-primary" pendente="Abrindo…">
              Criar prova
            </BotaoSubmit>
          </div>
        </form>
      )}
    </>
  );
}
