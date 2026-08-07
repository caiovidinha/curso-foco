import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui";
import { getSimulado } from "@/lib/queries";
import { GradeGabarito } from "./grade";

export const dynamic = "force-dynamic";

export default async function GabaritoPage({ params }: PageProps<"/simulados/[id]/gabarito">) {
  const { id } = await params;
  const simulado = await getSimulado(id);
  if (!simulado) notFound();

  const temObjetivas = simulado.questoes.some((q) => q.tipo === "multipla");

  if (!temObjetivas) {
    return (
      <EmptyState
        titulo="Nenhuma questão objetiva"
        descricao="Adicione um bloco de múltipla escolha na aba Estrutura para montar o gabarito."
      />
    );
  }

  return <GradeGabarito simuladoId={id} blocos={simulado.blocos} />;
}
