"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type AcaoServidor = (formData: FormData) => Promise<{ ok: boolean; erro?: string }>;

export function BotaoSubmit({
  children,
  className = "btn btn-primary",
  pendente,
  title,
}: {
  children: ReactNode;
  className?: string;
  pendente?: ReactNode;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} title={title}>
      {pending ? (pendente ?? "Salvando…") : children}
    </button>
  );
}

/**
 * Formulário ligado a uma server action que devolve `{ ok, erro }`.
 * Mostra o erro no lugar e limpa os campos quando `limpar` está ligado.
 */
export function FormAcao({
  action,
  children,
  className,
  limpar,
  onSucesso,
}: {
  action: AcaoServidor;
  children: ReactNode;
  className?: string;
  limpar?: boolean;
  onSucesso?: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      ref={ref}
      className={className}
      action={async (formData) => {
        const r = await action(formData);
        if (r?.ok === false) {
          setErro(r.erro ?? "Não foi possível salvar.");
          return;
        }
        setErro(null);
        if (limpar) ref.current?.reset();
        onSucesso?.();
      }}
    >
      {children}
      {erro && (
        <p className="mt-2 rounded-lg border border-line bg-soft px-3 py-2 text-xs text-ink">
          {erro}
        </p>
      )}
    </form>
  );
}

/**
 * Botão isolado que dispara uma server action, com confirmação opcional.
 *
 * Chama a action direto de dentro de uma transição, sem `<form>` próprio — é o
 * que permite usar este botão dentro de outro formulário (form aninhado é HTML
 * inválido e quebra a hidratação).
 */
export function BotaoAcao({
  action,
  campos,
  children,
  className = "btn btn-ghost btn-sm",
  confirmar,
  title,
}: {
  action: AcaoServidor | ((formData: FormData) => Promise<void>);
  campos: Record<string, string>;
  children: ReactNode;
  className?: string;
  confirmar?: string;
  title?: string;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function disparar() {
    if (confirmar && !window.confirm(confirmar)) return;

    const formData = new FormData();
    for (const [chave, valor] of Object.entries(campos)) formData.append(chave, valor);

    iniciar(async () => {
      const r = (await (action as AcaoServidor)(formData)) as
        | { ok: boolean; erro?: string }
        | void;
      setErro(r && r.ok === false ? (r.erro ?? "Não foi possível concluir.") : null);
    });
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={disparar}
        disabled={pendente}
        title={title}
      >
        {pendente ? "…" : children}
      </button>
      {erro && <span className="text-xs text-muted">{erro}</span>}
    </>
  );
}
