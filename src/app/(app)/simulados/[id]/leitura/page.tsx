import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { getAlunos, getSimulado } from "@/lib/queries";
import { Leitor } from "./leitor";

export const dynamic = "force-dynamic";

export default async function LeituraPage({ params }: PageProps<"/simulados/[id]/leitura">) {
  const { id } = await params;
  const [simulado, alunos] = await Promise.all([getSimulado(id), getAlunos()]);
  if (!simulado) notFound();

  const objetivas = simulado.questoes.filter((q) => q.tipo === "multipla");
  const semGabarito = objetivas.filter((q) => !q.gabarito).length;

  if (objetivas.length === 0) {
    return (
      <EmptyState
        titulo="Sem questões objetivas"
        descricao="A leitura por foto só funciona com questões de múltipla escolha."
      />
    );
  }

  return (
    <>
      {semGabarito > 0 && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            <strong className="tabular">{semGabarito}</strong> questões ainda sem gabarito. A
            leitura funciona, mas o acerto só é calculado depois.
          </p>
          <Link href={`/simulados/${id}/gabarito`} className="btn btn-outline btn-sm">
            Definir gabarito
          </Link>
        </div>
      )}

      <Leitor
        simuladoId={id}
        alunos={alunos.map((a) => ({
          id: a.id,
          nome: a.nome,
          codigo: a.codigo,
          turma: a.turmas?.nome ?? null,
        }))}
      />
    </>
  );
}
