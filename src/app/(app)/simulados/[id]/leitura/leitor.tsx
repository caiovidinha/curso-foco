"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { aplicarLeitura, obterOuCriarProva } from "@/app/actions/correcao";
import { IconAlert, IconCamera, IconCheck } from "@/components/icons";
import { LETRAS, RASURA } from "@/lib/types";

/** Abaixo disto a questão entra destacada na revisão. */
const CONF_MINIMA = 0.6;

type RespostaApi = {
  numero: number;
  questaoId: string | null;
  numOpcoes: number;
  gabarito: string | null;
  marcada: string | null;
  confianca: number;
};

type Leitura = {
  ok: true;
  codigo: number | null;
  pagina: number | null;
  aluno: { id: string; nome: string; codigo: number } | null;
  provaId: string | null;
  imagemPath: string | null;
  avisos: string[];
  precisaRevisao: boolean;
  preview: string;
  respostas: RespostaApi[];
};

type Item = {
  chave: string;
  arquivo: string;
  estado: "lendo" | "pronto" | "erro" | "salvo";
  erro?: string;
  leitura?: Leitura;
  alunoId?: string;
  respostas: Record<number, string | null>;
  aberto: boolean;
};

type AlunoOpcao = { id: string; nome: string; codigo: number; turma: string | null };

/** Reduz a foto no navegador antes de enviar: menos tráfego, mesma precisão. */
async function reduzir(file: File, max = 1600): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.92),
  );
}

export function Leitor({
  simuladoId,
  alunos,
}: {
  simuladoId: string;
  alunos: AlunoOpcao[];
}) {
  const [itens, setItens] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function atualizar(chave: string, patch: Partial<Item>) {
    setItens((lista) => lista.map((i) => (i.chave === chave ? { ...i, ...patch } : i)));
  }

  async function processar(files: FileList) {
    const novos: Item[] = Array.from(files).map((f, i) => ({
      chave: `${Date.now()}-${i}-${f.name}`,
      arquivo: f.name,
      estado: "lendo" as const,
      respostas: {},
      aberto: false,
    }));

    setItens((lista) => [...novos, ...lista]);

    for (const [i, file] of Array.from(files).entries()) {
      const chave = novos[i].chave;
      try {
        const blob = await reduzir(file);
        const fd = new FormData();
        fd.append("imagem", blob, "cartao.jpg");
        fd.append("simulado_id", simuladoId);
        fd.append("guardar", "1");

        const res = await fetch("/api/omr", { method: "POST", body: fd });
        const json = await res.json();

        if (!json.ok) {
          atualizar(chave, { estado: "erro", erro: json.erro ?? "Falha na leitura." });
          continue;
        }

        const leitura = json as Leitura;
        atualizar(chave, {
          estado: "pronto",
          leitura,
          alunoId: leitura.aluno?.id,
          respostas: Object.fromEntries(leitura.respostas.map((r) => [r.numero, r.marcada])),
          aberto: leitura.precisaRevisao,
        });
      } catch {
        atualizar(chave, { estado: "erro", erro: "Não consegui processar esta imagem." });
      }
    }
  }

  async function salvar(item: Item) {
    if (!item.leitura || !item.alunoId) return;

    const { ok, provaId, erro } = await obterOuCriarProva(simuladoId, item.alunoId);
    if (!ok || !provaId) {
      atualizar(item.chave, { erro: erro ?? "Não consegui abrir a prova deste aluno." });
      return;
    }

    const entradas = item.leitura.respostas
      .filter((r) => r.questaoId)
      .map((r) => ({
        questaoId: r.questaoId!,
        marcada: item.respostas[r.numero] ?? null,
        confianca: r.confianca,
        revisada: true,
      }));

    const fd = new FormData();
    fd.append("prova_id", provaId);
    fd.append("respostas", JSON.stringify(entradas));
    if (item.leitura.imagemPath) fd.append("imagem_path", item.leitura.imagemPath);

    const r = await aplicarLeitura(fd);
    if (r.ok) atualizar(item.chave, { estado: "salvo", erro: undefined });
    else atualizar(item.chave, { erro: r.erro });
  }

  async function salvarTodas() {
    for (const item of itens) {
      if (item.estado === "pronto" && item.alunoId) await salvar(item);
    }
  }

  const prontas = itens.filter((i) => i.estado === "pronto" && i.alunoId).length;

  return (
    <>
      <div className="card mb-6 p-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) processar(e.target.files);
            e.target.value = "";
          }}
        />

        <button type="button" className="btn btn-primary w-full" onClick={() => inputRef.current?.click()}>
          <IconCamera width={18} height={18} />
          Fotografar ou escolher cartões
        </button>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Dá para enviar várias folhas de uma vez. O sistema identifica o aluno pelo código impresso
          no cartão, corrige a perspectiva da foto e marca para revisão qualquer questão com leitura
          duvidosa.
        </p>

        {prontas > 0 && (
          <button type="button" className="btn btn-outline mt-4 w-full" onClick={salvarTodas}>
            Salvar as {prontas} leituras conferidas
          </button>
        )}
      </div>

      {itens.length === 0 ? (
        <p className="text-center text-sm text-sub">Nenhuma folha enviada ainda.</p>
      ) : (
        <ul className="space-y-3">
          {itens.map((item) => (
            <li key={item.chave} className="card overflow-hidden">
              <CabecalhoItem
                item={item}
                alunos={alunos}
                onAluno={(alunoId) => atualizar(item.chave, { alunoId })}
                onToggle={() => atualizar(item.chave, { aberto: !item.aberto })}
                onSalvar={() => salvar(item)}
              />

              {item.aberto && item.leitura && (
                <Revisao
                  leitura={item.leitura}
                  respostas={item.respostas}
                  onMarcar={(numero, letra) =>
                    atualizar(item.chave, {
                      respostas: {
                        ...item.respostas,
                        [numero]: item.respostas[numero] === letra ? null : letra,
                      },
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CabecalhoItem({
  item,
  alunos,
  onAluno,
  onToggle,
  onSalvar,
}: {
  item: Item;
  alunos: AlunoOpcao[];
  onAluno: (id: string) => void;
  onToggle: () => void;
  onSalvar: () => void;
}) {
  const duvidosas =
    item.leitura?.respostas.filter((r) => r.confianca < CONF_MINIMA).length ?? 0;

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.arquivo}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {item.estado === "lendo" && <span>Lendo…</span>}
            {item.estado === "erro" && (
              <span className="inline-flex items-center gap-1">
                <IconAlert width={13} height={13} />
                {item.erro}
              </span>
            )}
            {item.leitura && (
              <>
                <span className="badge tabular">
                  Página {item.leitura.pagina ?? "?"}
                </span>
                {item.leitura.codigo !== null ? (
                  <span className="badge tabular">
                    Código {String(item.leitura.codigo).padStart(4, "0")}
                  </span>
                ) : (
                  <span className="badge">Código ilegível</span>
                )}
                {duvidosas > 0 ? (
                  <span className="badge badge-solid tabular">{duvidosas} para conferir</span>
                ) : (
                  <span className="badge">Leitura limpa</span>
                )}
              </>
            )}
            {item.estado === "salvo" && (
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <IconCheck width={13} height={13} />
                Salvo
              </span>
            )}
          </div>
        </div>

        {item.leitura && item.estado !== "salvo" && (
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={onToggle}>
              {item.aberto ? "Fechar" : "Revisar"}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSalvar}
              disabled={!item.alunoId}
            >
              Salvar
            </button>
          </div>
        )}
      </div>

      {item.leitura && item.estado !== "salvo" && (
        <label className="mt-3 block">
          <span className="label">Aluno</span>
          <select
            className="select"
            value={item.alunoId ?? ""}
            onChange={(e) => onAluno(e.target.value)}
          >
            <option value="" disabled>
              Selecione o aluno…
            </option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>
                {String(a.codigo).padStart(4, "0")} — {a.nome}
                {a.turma ? ` (${a.turma})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {item.leitura?.avisos.map((aviso) => (
        <p key={aviso} className="mt-2 rounded-lg bg-soft px-3 py-2 text-xs text-muted">
          {aviso}
        </p>
      ))}

      {item.estado === "salvo" && item.alunoId && (
        <Link
          href={`/alunos/${item.alunoId}`}
          className="mt-2 inline-block text-xs font-medium text-muted underline hover:text-ink"
        >
          Ver desempenho do aluno
        </Link>
      )}
    </div>
  );
}

function Revisao({
  leitura,
  respostas,
  onMarcar,
}: {
  leitura: Leitura;
  respostas: Record<number, string | null>;
  onMarcar: (numero: number, letra: string) => void;
}) {
  return (
    <div className="grid gap-4 border-t border-line bg-soft p-4 lg:grid-cols-[minmax(0,320px)_1fr]">
      <div>
        <div className="section-title mb-2">Folha alinhada</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={leitura.preview}
          alt="Cartão-resposta alinhado com as marcações detectadas"
          className="w-full rounded-xl border border-line bg-paper"
        />
        <p className="mt-2 text-xs text-sub">
          Os círculos indicam o que foi lido. Compare com a folha antes de salvar.
        </p>
      </div>

      <div>
        <div className="section-title mb-2">Respostas lidas</div>
        <ul className="space-y-1">
          {leitura.respostas.map((r) => {
            const duvidosa = r.confianca < CONF_MINIMA;
            const atual = respostas[r.numero] ?? null;
            const opcoes = LETRAS.slice(0, r.numOpcoes) as unknown as string[];

            return (
              <li
                key={r.numero}
                className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                  duvidosa ? "bg-paper ring-1 ring-line-strong" : ""
                }`}
              >
                <span className="tabular w-8 shrink-0 text-xs font-medium text-muted">
                  {r.numero}
                </span>

                <div className="flex flex-wrap gap-1">
                  {opcoes.map((letra) => (
                    <button
                      key={letra}
                      type="button"
                      className={`bubble !h-7 !w-7 !text-[0.65rem] ${atual === letra ? "bubble-on" : ""}`}
                      onClick={() => onMarcar(r.numero, letra)}
                      aria-label={`Questão ${r.numero}, alternativa ${letra}`}
                      aria-pressed={atual === letra}
                    >
                      {letra}
                    </button>
                  ))}
                </div>

                {atual === RASURA && <span className="text-xs text-muted">rasura</span>}
                {atual === null && <span className="text-xs text-sub">branco</span>}
                {duvidosa && (
                  <IconAlert width={13} height={13} className="ml-auto shrink-0 text-muted" />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
