"use client";

import { useState } from "react";
import { Field } from "@/components/ui";
import type { TipoQuestao } from "@/lib/types";

/**
 * Campos de configuração de um bloco. O conjunto muda conforme o tipo:
 *
 *   múltipla escolha → quantidade + nº de alternativas
 *   discursiva       → quantidade + nota máxima por questão (sem alternativas)
 *   redação          → item único, só nota máxima (sem quantidade nem alternativas)
 */
export function CamposBloco({
  opcoesPadrao,
  inicial,
}: {
  opcoesPadrao: number;
  inicial?: { quantidade: number; tipo: TipoQuestao; numOpcoes: number; peso: number };
}) {
  const [tipo, setTipo] = useState<TipoQuestao>(inicial?.tipo ?? "multipla");

  const ehMultipla = tipo === "multipla";
  const ehRedacao = tipo === "redacao";

  const pesoPadrao = inicial && inicial.tipo === tipo ? inicial.peso : ehRedacao ? 1000 : 10;

  return (
    <>
      <div className="w-full min-w-28 flex-1 sm:w-auto">
        <Field label="Tipo">
          <select
            className="select"
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoQuestao)}
          >
            <option value="multipla">Múltipla escolha</option>
            <option value="discursiva">Discursiva</option>
            <option value="redacao">Redação</option>
          </select>
        </Field>
      </div>

      {ehRedacao ? (
        // a redação é sempre um item só — a quantidade não é escolha do usuário
        <input type="hidden" name="quantidade" value="1" />
      ) : (
        <div className="w-full min-w-24 flex-1 sm:w-auto">
          <Field label="Questões">
            <input
              className="input tabular"
              name="quantidade"
              type="number"
              min={1}
              max={300}
              defaultValue={inicial?.quantidade || 10}
              required
            />
          </Field>
        </div>
      )}

      {ehMultipla ? (
        <div className="w-full min-w-32 flex-1 sm:w-auto">
          <Field label="Alternativas">
            <select
              className="select"
              name="num_opcoes"
              defaultValue={String(inicial?.numOpcoes || opcoesPadrao)}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} (A–{String.fromCharCode(64 + n)})
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : (
        <div className="w-full min-w-28 flex-1 sm:w-auto">
          <Field label={ehRedacao ? "Nota máxima" : "Nota por questão"}>
            <input
              className="input tabular"
              name="peso"
              type="number"
              min={0.5}
              max={9999}
              step={0.5}
              defaultValue={pesoPadrao}
              required
            />
          </Field>
        </div>
      )}
    </>
  );
}
