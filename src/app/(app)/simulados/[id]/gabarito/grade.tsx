"use client";

import { useMemo, useRef, useState } from "react";
import { salvarGabarito } from "@/app/actions/simulados";
import { BotaoSubmit } from "@/components/forms";
import { PreenchimentoRapido, type Token } from "@/components/sequencia";
import { LETRAS, type BlocoSimulado } from "@/lib/types";

type Props = { simuladoId: string; blocos: BlocoSimulado[] };

export function GradeGabarito({ simuladoId, blocos }: Props) {
  const objetivas = useMemo(
    () => blocos.flatMap((b) => b.questoes).filter((q) => q.tipo === "multipla").sort((a, b) => a.numero - b.numero),
    [blocos],
  );

  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(objetivas.map((q) => [q.id, q.gabarito ?? ""])),
  );
  const [erro, setErro] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const preenchidas = objetivas.filter((q) => valores[q.id]).length;

  function marcar(questaoId: string, letra: string) {
    setValores((v) => ({ ...v, [questaoId]: v[questaoId] === letra ? "" : letra }));
  }

  /** Sem rasura aqui: um gabarito nunca tem dupla marcação. */
  function aplicarSequencia(tokens: Token[]) {
    setValores((v) => {
      const novo = { ...v };

      objetivas.forEach((q, i) => {
        if (i >= tokens.length) return;
        const token = tokens[i];

        if (token === null) {
          novo[q.id] = "";
          return;
        }

        const validas = LETRAS.slice(0, q.num_opcoes) as unknown as string[];
        if (validas.includes(token)) novo[q.id] = token;
      });

      return novo;
    });
  }

  return (
    <>
      <PreenchimentoRapido total={objetivas.length} onAplicar={aplicarSequencia} />

      <form
        ref={formRef}
        action={async (fd) => {
          const r = await salvarGabarito(fd);
          setErro(r.ok ? null : (r.erro ?? "Não foi possível salvar."));
        }}
      >
        <input type="hidden" name="simulado_id" value={simuladoId} />
        {objetivas.map((q) => (
          <input key={q.id} type="hidden" name={`gab_${q.id}`} value={valores[q.id] ?? ""} />
        ))}

        <div className="space-y-4 pb-24">
          {blocos.map((bloco) => {
            const qs = bloco.questoes.filter((q) => q.tipo === "multipla");
            if (qs.length === 0) return null;

            return (
              <section key={bloco.id} className="card overflow-hidden">
                <header className="border-b border-line px-4 py-3">
                  <div className="section-title">{bloco.area.nome}</div>
                  <h3 className="font-semibold">{bloco.materia.nome}</h3>
                </header>

                <ul className="divide-y divide-line">
                  {qs.map((q) => {
                    const opcoes = LETRAS.slice(0, q.num_opcoes) as unknown as string[];
                    return (
                      <li key={q.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="tabular w-8 shrink-0 text-sm font-medium text-muted">
                          {q.numero}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {opcoes.map((letra) => (
                            <button
                              key={letra}
                              type="button"
                              className={valores[q.id] === letra ? "bubble bubble-on" : "bubble"}
                              onClick={() => marcar(q.id, letra)}
                              aria-pressed={valores[q.id] === letra}
                              aria-label={`Questão ${q.numero}, alternativa ${letra}`}
                            >
                              {letra}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {/* barra fixa de ação */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+4.25rem)] backdrop-blur-md md:left-60 md:pb-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 md:px-4">
            <div className="text-sm">
              <span className="tabular font-semibold">
                {preenchidas}/{objetivas.length}
              </span>{" "}
              <span className="text-muted">preenchidas</span>
              {erro && <div className="text-xs text-muted">{erro}</div>}
            </div>
            <BotaoSubmit className="btn btn-primary">Salvar gabarito</BotaoSubmit>
          </div>
        </div>
      </form>
    </>
  );
}
