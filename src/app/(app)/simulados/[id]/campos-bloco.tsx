"use client";

import { useState } from "react";
import { Field } from "@/components/ui";
import { formatarNumerosQuestoes } from "@/lib/numeracao";
import type { TipoQuestao } from "@/lib/types";

/**
 * Campos de configuração de um bloco. O conjunto muda conforme o tipo:
 *
 *   múltipla escolha → números das questões + nº de alternativas
 *   discursiva       → números das questões + nota máxima por questão
 *   redação          → número da questão + nota máxima
 */
export function CamposBloco({
  opcoesPadrao,
  inicial,
}: {
  opcoesPadrao: number;
  inicial?: { numeros: number[]; tipo: TipoQuestao; numOpcoes: number; peso: number };
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

      <div className="w-full min-w-64 flex-[2] sm:w-auto">
        <Field
          label={ehRedacao ? "Número da questão" : "Números das questões"}
          hint={ehRedacao ? undefined : "Separe por vírgulas ou use intervalos, como 49, 61–63, 69."}
        >
          <textarea
            className="textarea tabular min-h-11 resize-y"
            name="numeros_questoes"
            rows={2}
            defaultValue={inicial ? formatarNumerosQuestoes(inicial.numeros) : ""}
            placeholder={ehRedacao ? "Ex.: 91" : "Ex.: 49, 61–63, 69, 71"}
            required
          />
        </Field>
      </div>

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
