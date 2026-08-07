import Link from "next/link";
import { notFound } from "next/navigation";
import { definirStatusProva, excluirProva } from "@/app/actions/correcao";
import { BotaoAcao } from "@/components/forms";
import { IconTrash } from "@/components/icons";
import { PageHeader, StatusBadge } from "@/components/ui";
import { getProva, getRespostas, getSimulado } from "@/lib/queries";
import { GradeCorrecao } from "./grade";

export const dynamic = "force-dynamic";

export default async function CorrecaoProvaPage({ params }: PageProps<"/correcao/[provaId]">) {
  const { provaId } = await params;

  const prova = await getProva(provaId);
  if (!prova) notFound();

  const [simulado, respostas] = await Promise.all([
    getSimulado(prova.simulado_id),
    getRespostas(provaId),
  ]);
  if (!simulado) notFound();

  const iniciais = Object.fromEntries(
    respostas.map((r) => [r.questao_id as string, { marcada: r.marcada, nota: r.nota }]),
  );

  return (
    <>
      <PageHeader
        titulo={prova.alunos.nome}
        voltar={`/simulados/${prova.simulado_id}/correcao`}
        subtitulo={
          <span className="tabular">
            {simulado.titulo} · código {String(prova.alunos.codigo).padStart(4, "0")}
            {prova.alunos.turmas && ` · ${prova.alunos.turmas.nome}`}
          </span>
        }
        acoes={
          <>
            <StatusBadge status={prova.status} />
            {prova.status !== "ausente" ? (
              <BotaoAcao
                action={definirStatusProva}
                campos={{ prova_id: provaId, status: "ausente" }}
                className="btn btn-outline btn-sm"
                confirmar="Marcar este aluno como ausente?"
              >
                Ausente
              </BotaoAcao>
            ) : (
              <BotaoAcao
                action={definirStatusProva}
                campos={{ prova_id: provaId, status: "pendente" }}
                className="btn btn-outline btn-sm"
              >
                Reabrir
              </BotaoAcao>
            )}
            <BotaoAcao
              action={excluirProva}
              campos={{ prova_id: provaId, simulado_id: prova.simulado_id }}
              className="btn btn-outline btn-sm"
              confirmar="Excluir esta prova e todas as suas respostas?"
            >
              <IconTrash width={15} height={15} />
            </BotaoAcao>
          </>
        }
      />

      {simulado.questoes.length === 0 ? (
        <p className="card p-5 text-sm">
          Este simulado ainda não tem questões.{" "}
          <Link href={`/simulados/${prova.simulado_id}`} className="underline">
            Montar estrutura
          </Link>
        </p>
      ) : (
        <GradeCorrecao
          provaId={provaId}
          simuladoId={prova.simulado_id}
          blocos={simulado.blocos}
          iniciais={iniciais}
          status={prova.status}
        />
      )}
    </>
  );
}
