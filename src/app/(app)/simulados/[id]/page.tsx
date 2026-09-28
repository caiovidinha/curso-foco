import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adicionarBloco,
  atualizarBloco,
  atualizarSimulado,
  definirTurmas,
  duplicarSimulado,
  excluirSimulado,
  gerarProvas,
  moverBloco,
  removerBloco,
} from "@/app/actions/simulados";
import { BotaoAcao, BotaoSubmit, FormAcao } from "@/components/forms";
import { IconCopy, IconPlus, IconPrint, IconTrash } from "@/components/icons";
import { EmptyState, Field, Stat } from "@/components/ui";
import { formatarNumerosQuestoes } from "@/lib/numeracao";
import { getCatalogo, getSimulado, getTurmas } from "@/lib/queries";
import { ROTULO_TIPO } from "@/lib/types";
import { CamposBloco } from "./campos-bloco";

export const dynamic = "force-dynamic";

export default async function EstruturaPage({ params }: PageProps<"/simulados/[id]">) {
  const { id } = await params;

  const [simulado, catalogo, turmas] = await Promise.all([
    getSimulado(id),
    getCatalogo(),
    getTurmas(),
  ]);

  if (!simulado) notFound();

  const objetivas = simulado.questoes.filter((q) => q.tipo === "multipla");
  const porNota = simulado.questoes.filter((q) => q.tipo !== "multipla");
  const notaTotal = porNota.reduce((soma, q) => soma + Number(q.peso), 0);
  const semGabarito = objetivas.filter((q) => !q.gabarito).length;
  const usadas = new Set(simulado.blocos.map((b) => b.materia.id));

  return (
    <>
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Questões" valor={simulado.questoes.length} />
        <Stat
          label="Objetivas"
          valor={objetivas.length}
          hint={
            porNota.length > 0
              ? `${porNota.length} por nota · ${notaTotal.toLocaleString("pt-BR")} pts`
              : "todas no cartão-resposta"
          }
        />
        <Stat label="Blocos" valor={simulado.blocos.length} />
        <Stat
          label="Sem gabarito"
          valor={semGabarito}
          hint={semGabarito > 0 ? "defina antes de corrigir" : "gabarito completo"}
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Blocos de matérias</h2>
          {objetivas.length > 0 && (
            <Link href={`/imprimir/cartoes/${id}`} className="btn btn-outline btn-sm" target="_blank">
              <IconPrint width={15} height={15} />
              Cartões-resposta
            </Link>
          )}
        </div>

        {simulado.blocos.length === 0 ? (
          <EmptyState
            titulo="Nenhum bloco ainda"
            descricao="Adicione uma matéria e informe os números exatos das questões, mesmo que não sejam sequenciais."
          />
        ) : (
          <ul className="space-y-3">
            {simulado.blocos.map((b, i) => {
              const primeira = b.questoes[0]?.numero;
              const q0 = b.questoes[0];
              const numeros = b.questoes.map((q) => q.numero);
              const numeracao = formatarNumerosQuestoes(numeros);

              return (
                <li key={b.id} className="card p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="section-title">{b.area.nome}</div>
                      <h3 className="truncate text-base font-semibold">{b.materia.nome}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="badge">{ROTULO_TIPO[q0?.tipo ?? "multipla"]}</span>
                        <span className="tabular text-xs text-muted">
                          {b.questoes.length === 0
                            ? "sem questões"
                            : q0?.tipo === "redacao"
                              ? `Item ${primeira} · vale ${Number(q0.peso).toLocaleString("pt-BR")} pts`
                              : q0?.tipo === "discursiva"
                                ? `${b.questoes.length} questões: ${numeracao} · ${Number(q0.peso).toLocaleString("pt-BR")} pts cada`
                                : `${b.questoes.length} questões: ${numeracao} · ${q0?.num_opcoes} alternativas`}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <BotaoAcao
                        action={moverBloco}
                        campos={{ bloco_id: b.id, simulado_id: id, direcao: "cima" }}
                        className="btn btn-ghost btn-sm"
                        title="Mover para cima"
                      >
                        ↑
                      </BotaoAcao>
                      <BotaoAcao
                        action={moverBloco}
                        campos={{ bloco_id: b.id, simulado_id: id, direcao: "baixo" }}
                        className="btn btn-ghost btn-sm"
                        title="Mover para baixo"
                      >
                        ↓
                      </BotaoAcao>
                      <BotaoAcao
                        action={removerBloco}
                        campos={{ bloco_id: b.id, simulado_id: id }}
                        className="btn btn-ghost btn-sm"
                        confirmar={`Remover o bloco de ${b.materia.nome} e suas ${b.questoes.length} questões?`}
                        title="Remover bloco"
                      >
                        <IconTrash width={15} height={15} />
                      </BotaoAcao>
                    </div>
                  </div>

                  <FormAcao action={atualizarBloco}>
                    <input type="hidden" name="bloco_id" value={b.id} />
                    <input type="hidden" name="simulado_id" value={id} />
                    <div className="flex flex-wrap items-end gap-3">
                      <CamposBloco
                        opcoesPadrao={simulado.opcoes_padrao}
                        inicial={{
                          numeros,
                          tipo: q0?.tipo ?? "multipla",
                          numOpcoes: q0?.num_opcoes || simulado.opcoes_padrao,
                          peso: Number(q0?.peso ?? 10),
                        }}
                      />
                      <BotaoSubmit className="btn btn-outline shrink-0">Aplicar</BotaoSubmit>
                    </div>
                  </FormAcao>

                  {i === 0 && (
                    <p className="mt-3 text-xs text-sub">
                      Você pode colar uma lista vertical ou combinar números e intervalos. Um número
                      só pode pertencer a uma matéria. Questões removidas da lista são excluídas do
                      bloco.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      <FormAcao action={adicionarBloco} limpar className="card mb-6 p-4">
        <div className="section-title mb-3">Adicionar bloco</div>
        <input type="hidden" name="simulado_id" value={id} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full min-w-52 flex-[2] sm:w-auto">
            <Field label="Matéria">
              <select className="select" name="materia_id" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {catalogo.map((area) => (
                  <optgroup key={area.id} label={area.nome}>
                    {area.materias.map((m) => (
                      <option key={m.id} value={m.id} disabled={usadas.has(m.id)}>
                        {m.nome}
                        {usadas.has(m.id) ? " (já incluída)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>

          <CamposBloco opcoesPadrao={simulado.opcoes_padrao} />

          <BotaoSubmit className="btn btn-primary shrink-0">
            <IconPlus width={16} height={16} />
            Adicionar
          </BotaoSubmit>
        </div>
      </FormAcao>

      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FormAcao action={definirTurmas} className="card p-4">
          <div className="section-title mb-3">Turmas participantes</div>
          <input type="hidden" name="simulado_id" value={id} />

          {turmas.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhuma turma cadastrada.{" "}
              <Link href="/turmas" className="underline">
                Criar turma
              </Link>
            </p>
          ) : (
            <ul className="mb-4 space-y-1.5">
              {turmas.map((t) => (
                <li key={t.id}>
                  <label className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      name="turma_ids"
                      value={t.id}
                      defaultChecked={simulado.turmaIds.includes(t.id)}
                      className="size-4 accent-[var(--ink)]"
                    />
                    <span className="flex-1 truncate">{t.nome}</span>
                    <span className="tabular text-xs text-sub">{t.qtdAlunos} alunos</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <BotaoSubmit className="btn btn-outline">Salvar turmas</BotaoSubmit>
            <BotaoAcao
              action={gerarProvas}
              campos={{ simulado_id: id }}
              className="btn btn-primary"
              title="Cria uma prova pendente para cada aluno ativo das turmas marcadas"
            >
              Gerar provas
            </BotaoAcao>
          </div>
        </FormAcao>

        <FormAcao action={atualizarSimulado} className="card p-4">
          <div className="section-title mb-3">Dados do simulado</div>
          <input type="hidden" name="id" value={id} />
          <div className="space-y-3">
            <Field label="Título">
              <input className="input" name="titulo" defaultValue={simulado.titulo} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data">
                <input className="input tabular" name="data" type="date" defaultValue={simulado.data ?? ""} />
              </Field>
              <Field label="Situação">
                <select className="select" name="status" defaultValue={simulado.status}>
                  <option value="rascunho">Rascunho</option>
                  <option value="aplicado">Aplicado</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              </Field>
            </div>
            <Field label="Descrição">
              <textarea className="textarea" name="descricao" rows={2} defaultValue={simulado.descricao ?? ""} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <BotaoSubmit className="btn btn-primary">Salvar</BotaoSubmit>
            <BotaoAcao
              action={excluirSimulado}
              campos={{ id }}
              className="btn btn-outline"
              confirmar={`Excluir "${simulado.titulo}" com todas as questões e correções?`}
            >
              <IconTrash width={15} height={15} />
              Excluir simulado
            </BotaoAcao>
          </div>
        </FormAcao>
      </div>

      {/* ---------------------------------------------------------------- */}
      <form action={duplicarSimulado} className="card mt-4 p-4">
        <div className="section-title mb-1">Duplicar</div>
        <p className="mb-3 text-xs text-muted">
          Cria um novo simulado em rascunho com os mesmos blocos, questões e numeração. As provas e
          correções não são copiadas.
        </p>
        <input type="hidden" name="id" value={id} />

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <Field label="Título da cópia">
            <input className="input" name="titulo" defaultValue={`${simulado.titulo} (cópia)`} required />
          </Field>
          <Field label="Data">
            <input
              className="input tabular"
              name="data"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <BotaoSubmit className="btn btn-outline" pendente="Duplicando…">
            <IconCopy width={16} height={16} />
            Duplicar
          </BotaoSubmit>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="copiar_gabarito" defaultChecked className="size-4 accent-[var(--ink)]" />
            Copiar o gabarito
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="copiar_turmas" className="size-4 accent-[var(--ink)]" />
            Copiar as turmas vinculadas
          </label>
        </div>
      </form>
    </>
  );
}
