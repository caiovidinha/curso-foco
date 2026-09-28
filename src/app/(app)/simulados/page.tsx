import Link from "next/link";
import { duplicarSimulado, excluirSimulado } from "@/app/actions/simulados";
import { BotaoAcao } from "@/components/forms";
import {
  IconChart,
  IconCheck,
  IconChevron,
  IconCopy,
  IconExam,
  IconPlus,
  IconPrint,
  IconTrash,
} from "@/components/icons";
import { CLASSE_ITEM_MENU, ItemMenuLink, MenuAcoes, SeparadorMenu } from "@/components/menu";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { getSimulados } from "@/lib/queries";
import { fmtData } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function SimuladosPage() {
  const simulados = await getSimulados();
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        titulo="Simulados"
        subtitulo="Estrutura, gabarito, cartões-resposta e correção."
        acoes={
          <Link href="/simulados/novo" className="btn btn-primary btn-sm">
            <IconPlus width={15} height={15} />
            Novo simulado
          </Link>
        }
      />

      {simulados.length === 0 ? (
        <EmptyState
          titulo="Nenhum simulado criado"
          descricao="Um simulado é formado por blocos de matérias, cada um com sua própria lista de questões."
          acao={
            <Link href="/simulados/novo" className="btn btn-primary btn-sm">
              Criar o primeiro
            </Link>
          }
        />
      ) : (
        // cada linha é um cartão próprio: o menu "⋯" precisa poder transbordar,
        // o que uma lista com `overflow-hidden` impediria
        <ul className="space-y-2.5">
          {simulados.map((s) => (
            <li key={s.id} className="card flex items-center gap-1 pr-2">
              <Link
                href={`/simulados/${s.id}`}
                className="min-w-0 flex-1 rounded-2xl px-4 py-4 transition-colors hover:bg-soft"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.titulo}</div>
                    <div className="tabular mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted">
                      <span>{fmtData(s.data)}</span>
                      <span aria-hidden>·</span>
                      <span>{s.qtdQuestoes} questões</span>
                      <span aria-hidden>·</span>
                      <span>{s.qtdProvas} provas</span>
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                  <IconChevron width={16} height={16} className="hidden shrink-0 text-sub sm:block" />
                </div>
              </Link>

              <MenuAcoes rotulo={`Opções de ${s.titulo}`}>
                <BotaoAcao
                  action={duplicarSimulado}
                  campos={{ id: s.id, data: hoje, copiar_gabarito: "1" }}
                  className={CLASSE_ITEM_MENU}
                >
                  <IconCopy width={16} height={16} />
                  Duplicar
                </BotaoAcao>

                <SeparadorMenu />

                <ItemMenuLink href={`/simulados/${s.id}`}>
                  <IconExam width={16} height={16} />
                  Estrutura
                </ItemMenuLink>
                <ItemMenuLink href={`/simulados/${s.id}/gabarito`}>
                  <IconCheck width={16} height={16} />
                  Gabarito
                </ItemMenuLink>
                <ItemMenuLink href={`/simulados/${s.id}/correcao`}>
                  <IconChevron width={16} height={16} />
                  Correção
                </ItemMenuLink>
                <ItemMenuLink href={`/simulados/${s.id}/resultados`}>
                  <IconChart width={16} height={16} />
                  Resultados
                </ItemMenuLink>
                <ItemMenuLink href={`/imprimir/cartoes/${s.id}`} novaAba>
                  <IconPrint width={16} height={16} />
                  Cartões-resposta
                </ItemMenuLink>

                <SeparadorMenu />

                <BotaoAcao
                  action={excluirSimulado}
                  campos={{ id: s.id }}
                  className={CLASSE_ITEM_MENU}
                  confirmar={`Excluir "${s.titulo}" com todas as questões e correções?`}
                >
                  <IconTrash width={16} height={16} />
                  Excluir
                </BotaoAcao>
              </MenuAcoes>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
