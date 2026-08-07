"use client";

import { useMemo, useRef, useState } from "react";
import { salvarCorrecao } from "@/app/actions/correcao";
import { BotaoSubmit } from "@/components/forms";
import { IconCamera, IconCheck } from "@/components/icons";
import { PreenchimentoRapido, type Token } from "@/components/sequencia";
import { LETRAS, RASURA, type BlocoSimulado, type StatusProva } from "@/lib/types";

type Inicial = Record<string, { marcada: string | null; nota: number | null }>;

type Props = {
  provaId: string;
  simuladoId: string;
  blocos: BlocoSimulado[];
  iniciais: Inicial;
  status: StatusProva;
};

async function reduzir(file: File, max = 1600): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((r) => canvas.toBlob((b) => r(b ?? file), "image/jpeg", 0.92));
}

export function GradeCorrecao({ provaId, simuladoId, blocos, iniciais, status }: Props) {
  const questoes = useMemo(
    () => blocos.flatMap((b) => b.questoes).sort((a, b) => a.numero - b.numero),
    [blocos],
  );

  const [marcadas, setMarcadas] = useState<Record<string, string>>(() =>
    Object.fromEntries(questoes.map((q) => [q.id, iniciais[q.id]?.marcada ?? ""])),
  );
  const [notas, setNotas] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      questoes.map((q) => [q.id, iniciais[q.id]?.nota != null ? String(iniciais[q.id].nota) : ""]),
    ),
  );

  const [msg, setMsg] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const objetivas = questoes.filter((q) => q.tipo === "multipla");
  const respondidas = objetivas.filter((q) => marcadas[q.id]).length;
  const acertos = objetivas.filter((q) => q.gabarito && marcadas[q.id] === q.gabarito).length;
  const temGabarito = objetivas.some((q) => q.gabarito);

  const porNota = questoes.filter((q) => q.tipo !== "multipla");
  const notaMaxima = porNota.reduce((s, q) => s + Number(q.peso), 0);
  const notaObtida = porNota.reduce((s, q) => {
    const v = Number((notas[q.id] ?? "").replace(",", "."));
    return s + (Number.isFinite(v) ? Math.max(0, Math.min(Number(q.peso), v)) : 0);
  }, 0);

  /** Aplica a sequência digitada às objetivas, na ordem da numeração. */
  function aplicarSequencia(tokens: Token[]) {
    setMarcadas((atual) => {
      const novo = { ...atual };

      objetivas.forEach((q, i) => {
        if (i >= tokens.length) return;
        const token = tokens[i];

        if (token === null) {
          novo[q.id] = "";
          return;
        }

        const validas = LETRAS.slice(0, q.num_opcoes) as unknown as string[];
        if (token === RASURA || validas.includes(token)) novo[q.id] = token;
      });

      return novo;
    });

    setMsg(`Sequência aplicada a ${Math.min(tokens.length, objetivas.length)} questões.`);
  }

  async function lerFoto(file: File) {
    setLendo(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("imagem", await reduzir(file), "cartao.jpg");
      fd.append("simulado_id", simuladoId);

      const res = await fetch("/api/omr", { method: "POST", body: fd });
      const json = await res.json();

      if (!json.ok) {
        setMsg(json.erro ?? "Não consegui ler a folha.");
        return;
      }

      const porNumero = new Map(questoes.map((q) => [q.numero, q.id]));
      setMarcadas((atual) => {
        const novo = { ...atual };
        for (const r of json.respostas as { numero: number; marcada: string | null }[]) {
          const id = porNumero.get(r.numero);
          if (id) novo[id] = r.marcada ?? "";
        }
        return novo;
      });

      setPreview(json.preview);
      const avisos = (json.avisos as string[]) ?? [];
      setMsg(
        avisos.length > 0
          ? avisos.join(" ")
          : "Leitura concluída. Confira as marcações e salve.",
      );
    } catch {
      setMsg("Falha ao processar a imagem.");
    } finally {
      setLendo(false);
    }
  }

  return (
    <>
      <div className="card mb-4 p-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) lerFoto(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="btn btn-outline w-full"
          onClick={() => inputRef.current?.click()}
          disabled={lendo}
        >
          <IconCamera width={17} height={17} />
          {lendo ? "Lendo a folha…" : "Preencher por foto do cartão"}
        </button>
        {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
      </div>

      {objetivas.length > 0 && (
        <PreenchimentoRapido
          total={objetivas.length}
          permitirRasura
          onAplicar={aplicarSequencia}
        />
      )}

      {preview && (
        <div className="card mb-4 p-4">
          <div className="section-title mb-2">Folha alinhada</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Cartão-resposta alinhado com as marcações detectadas"
            className="mx-auto w-full max-w-sm rounded-xl border border-line"
          />
        </div>
      )}

      <form
        action={async (fd) => {
          const r = await salvarCorrecao(fd);
          setMsg(r.ok ? "Correção salva." : (r.erro ?? "Não foi possível salvar."));
        }}
      >
        <input type="hidden" name="prova_id" value={provaId} />
        <input type="hidden" name="status" value="corrigida" />
        {questoes.map((q) =>
          q.tipo === "multipla" ? (
            <input key={q.id} type="hidden" name={`q_${q.id}`} value={marcadas[q.id] ?? ""} />
          ) : (
            <input key={q.id} type="hidden" name={`nota_${q.id}`} value={notas[q.id] ?? ""} />
          ),
        )}

        <div className="space-y-4 pb-28">
          {blocos.map((bloco) => (
            <section key={bloco.id} className="card overflow-hidden">
              <header className="border-b border-line px-4 py-3">
                <div className="section-title">{bloco.area.nome}</div>
                <h3 className="font-semibold">{bloco.materia.nome}</h3>
              </header>

              <ul className="divide-y divide-line">
                {bloco.questoes.map((q) => {
                  if (q.tipo !== "multipla") {
                    const maximo = Number(q.peso);
                    const ehRedacao = q.tipo === "redacao";
                    const valor = notas[q.id] ?? "";
                    const acima = valor !== "" && Number(valor.replace(",", ".")) > maximo;

                    return (
                      <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                        <span className="tabular w-8 shrink-0 text-sm font-medium text-muted">
                          {q.numero}
                        </span>
                        <label className="flex items-center gap-2 text-xs text-muted">
                          {ehRedacao ? "Nota da redação" : "Nota"}
                          <input
                            className="input tabular !min-h-9 w-28 !py-1"
                            type="number"
                            step={ehRedacao ? 20 : 0.5}
                            min={0}
                            max={maximo}
                            value={valor}
                            onChange={(e) => setNotas((n) => ({ ...n, [q.id]: e.target.value }))}
                            aria-label={`Nota ${ehRedacao ? "da redação" : `da questão ${q.numero}`}`}
                          />
                          <span className="text-sub">de {maximo.toLocaleString("pt-BR")}</span>
                        </label>
                        {acima && (
                          <span className="text-xs text-ink">
                            acima do máximo ({maximo.toLocaleString("pt-BR")})
                          </span>
                        )}
                      </li>
                    );
                  }

                  const opcoes = LETRAS.slice(0, q.num_opcoes) as unknown as string[];
                  const atual = marcadas[q.id] ?? "";
                  const certo = q.gabarito && atual === q.gabarito;
                  const errado = q.gabarito && atual && atual !== q.gabarito;

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
                            className={atual === letra ? "bubble bubble-on" : "bubble"}
                            onClick={() =>
                              setMarcadas((m) => ({ ...m, [q.id]: m[q.id] === letra ? "" : letra }))
                            }
                            aria-pressed={atual === letra}
                            aria-label={`Questão ${q.numero}, alternativa ${letra}`}
                          >
                            {letra}
                          </button>
                        ))}
                      </div>

                      <div className="ml-auto flex shrink-0 items-center gap-2 text-xs">
                        {certo && <IconCheck width={16} height={16} />}
                        {errado && (
                          <span className="badge tabular">gab. {q.gabarito}</span>
                        )}
                        {!atual && <span className="text-sub">branco</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+4.25rem)] backdrop-blur-md md:left-60 md:pb-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 md:px-4">
            <div className="text-sm">
              <span className="tabular font-semibold">
                {respondidas}/{objetivas.length}
              </span>{" "}
              <span className="text-muted">respondidas</span>
              {temGabarito && objetivas.length > 0 && (
                <div className="tabular text-xs text-muted">
                  {acertos} acertos · {((acertos / objetivas.length) * 100).toFixed(0)}%
                </div>
              )}
              {porNota.length > 0 && (
                <div className="tabular text-xs text-muted">
                  Notas: {notaObtida.toLocaleString("pt-BR")} de{" "}
                  {notaMaxima.toLocaleString("pt-BR")}
                </div>
              )}
            </div>
            <BotaoSubmit className="btn btn-primary">
              {status === "corrigida" ? "Atualizar correção" : "Concluir correção"}
            </BotaoSubmit>
          </div>
        </div>
      </form>
    </>
  );
}
