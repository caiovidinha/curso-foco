"use client";

import { useMemo, useState } from "react";
import { analisarSequencia, type Token } from "@/lib/sequencia";

export type { Token };

export function PreenchimentoRapido({
  total,
  permitirRasura = false,
  onAplicar,
}: {
  total: number;
  /** Aceita `X` (dupla marcação) e o traço para questão em branco. */
  permitirRasura?: boolean;
  onAplicar: (tokens: Token[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const tokens = useMemo(() => analisarSequencia(texto, permitirRasura), [texto, permitirRasura]);

  const sobrando = Math.max(0, tokens.length - total);

  function aplicar() {
    if (tokens.length === 0) return;
    onAplicar(tokens);
    setTexto("");
  }

  return (
    <div className="card mb-4 p-4">
      <div className="section-title mb-2">Preenchimento rápido</div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input font-mono tracking-[0.2em] uppercase"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              aplicar();
            }
          }}
          placeholder={permitirRasura ? "ABCDE-BCA…" : "ABCDEEDCBA…"}
          aria-label="Sequência de alternativas"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="btn btn-outline shrink-0"
          onClick={aplicar}
          disabled={tokens.length === 0}
        >
          Aplicar sequência
        </button>
      </div>

      <p className="mt-2 text-xs text-sub">
        {tokens.length === 0 ? (
          <>
            Cole a sequência na ordem das questões — espaços e pontuação são ignorados. Use{" "}
            <strong className="text-muted">-</strong> para deixar em branco
            {permitirRasura && (
              <>
                {" "}
                e <strong className="text-muted">X</strong> para rasura
              </>
            )}
            .
          </>
        ) : (
          <span className="tabular">
            {tokens.length} de {total} questões
            {sobrando > 0 && ` · ${sobrando} a mais do que a prova tem (serão ignoradas)`}
          </span>
        )}
      </p>
    </div>
  );
}
