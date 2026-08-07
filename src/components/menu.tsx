"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconMais } from "./icons";

/**
 * Menu de ações "⋯". Fecha ao clicar fora, ao apertar Esc e ao escolher um item.
 *
 * O painel escapa do container, então quem usa este menu não pode estar dentro
 * de um elemento com `overflow-hidden`.
 */
export function MenuAcoes({ children, rotulo = "Mais opções" }: { children: ReactNode; rotulo?: string }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div className="relative shrink-0" ref={caixa}>
      <button
        type="button"
        className="btn btn-ghost btn-sm !px-2"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={rotulo}
        title={rotulo}
      >
        <IconMais width={18} height={18} />
      </button>

      {aberto && (
        <div
          id={id}
          role="menu"
          className="card absolute right-0 z-50 mt-1 flex w-56 flex-col gap-0.5 p-1.5"
          onClick={() => setAberto(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const ESTILO_ITEM =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-soft";

export function ItemMenuLink({
  href,
  children,
  novaAba,
}: {
  href: string;
  children: ReactNode;
  novaAba?: boolean;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={ESTILO_ITEM}
      {...(novaAba ? { target: "_blank", rel: "noopener" } : {})}
    >
      {children}
    </Link>
  );
}

/** Classe pronta para usar em `BotaoAcao` dentro do menu. */
export const CLASSE_ITEM_MENU = ESTILO_ITEM;

export function SeparadorMenu() {
  return <div className="my-1 border-t border-line" />;
}
