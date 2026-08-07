import Link from "next/link";
import { notFound } from "next/navigation";
import { CartaoAluno } from "@/components/cartao";
import { BotaoImprimir } from "./controles";
import { getAlunos, getSimulado, getTurmas } from "@/lib/queries";
import { fmtData } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function ImprimirCartoesPage({
  params,
  searchParams,
}: PageProps<"/imprimir/cartoes/[simuladoId]">) {
  const { simuladoId } = await params;
  const sp = await searchParams;

  const modo = sp.modo === "branco" ? "branco" : "personalizado";
  const turmaFiltro = typeof sp.turma === "string" ? sp.turma : "";
  const copias = Math.max(1, Math.min(50, Number(sp.copias ?? 1) || 1));

  const [simulado, turmas] = await Promise.all([getSimulado(simuladoId), getTurmas()]);
  if (!simulado) notFound();

  const numeros = simulado.questoes
    .filter((q) => q.tipo === "multipla")
    .map((q) => q.numero)
    .sort((a, b) => a - b);

  const numOpcoes = Math.max(
    2,
    ...simulado.questoes.filter((q) => q.tipo === "multipla").map((q) => q.num_opcoes),
  );

  const turmasDoSimulado = turmaFiltro ? [turmaFiltro] : simulado.turmaIds;
  const alunos =
    modo === "personalizado" && turmasDoSimulado.length > 0
      ? (await Promise.all(turmasDoSimulado.map((t) => getAlunos({ turmaId: t }))))
          .flat()
          .filter((a) => a.ativo)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      : [];

  const base = {
    tituloSimulado: simulado.titulo,
    dataSimulado: fmtData(simulado.data),
  };

  return (
    <>
      <div className="no-print mx-auto max-w-3xl px-4 py-6">
        <Link
          href={`/simulados/${simuladoId}`}
          className="mb-4 inline-block text-xs font-medium text-muted hover:text-ink"
        >
          ← Voltar ao simulado
        </Link>

        <div className="card p-5">
          <h1 className="text-xl font-semibold tracking-tight">Cartões-resposta</h1>
          <p className="mt-1 text-sm text-muted">
            {numeros.length} questões objetivas · {numOpcoes} alternativas.
          </p>

          {numeros.length === 0 ? (
            <p className="mt-4 text-sm">
              Este simulado ainda não tem questões de múltipla escolha.
            </p>
          ) : (
            <>
              <form method="get" className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="label">Modo</span>
                  <select className="select" name="modo" defaultValue={modo}>
                    <option value="personalizado">Personalizado (código já preenchido)</option>
                    <option value="branco">Em branco (aluno preenche o código)</option>
                  </select>
                </label>

                <label className="block">
                  <span className="label">Turma</span>
                  <select className="select" name="turma" defaultValue={turmaFiltro}>
                    <option value="">Turmas do simulado</option>
                    {turmas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="label">Cópias (modo em branco)</span>
                  <input
                    className="input tabular"
                    name="copias"
                    type="number"
                    min={1}
                    max={50}
                    defaultValue={copias}
                  />
                </label>

                <div className="sm:col-span-3 flex flex-wrap gap-2">
                  <button type="submit" className="btn btn-outline">
                    Atualizar
                  </button>
                  <BotaoImprimir />
                </div>
              </form>

              <div className="mt-4 rounded-xl bg-soft p-3 text-xs leading-relaxed text-muted">
                <strong className="text-ink">Como fotografar para a leitura automática:</strong>{" "}
                enquadre a folha inteira, com os quatro quadrados pretos dos cantos visíveis, em luz
                uniforme e sem sombra. A câmera pode estar inclinada — a correção de perspectiva é
                automática.
              </div>

              {modo === "personalizado" && alunos.length === 0 && (
                <p className="mt-4 text-sm">
                  Nenhum aluno encontrado. Vincule turmas ao simulado na aba Estrutura, ou escolha
                  uma turma acima.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {numeros.length > 0 && (
        <div className="pb-10 print:pb-0">
          {modo === "personalizado"
            ? alunos.map((a) => (
                <CartaoAluno
                  key={a.id}
                  numeros={numeros}
                  numOpcoes={numOpcoes}
                  dados={{
                    ...base,
                    alunoNome: a.nome.toUpperCase(),
                    alunoTurma: a.turmas?.nome ?? null,
                    codigo: a.codigo,
                  }}
                />
              ))
            : Array.from({ length: copias }, (_, i) => (
                <CartaoAluno
                  key={i}
                  numeros={numeros}
                  numOpcoes={numOpcoes}
                  dados={{ ...base, alunoNome: null, alunoTurma: null, codigo: null }}
                />
              ))}
        </div>
      )}
    </>
  );
}
