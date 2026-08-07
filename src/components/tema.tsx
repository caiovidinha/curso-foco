"use client";

import { useSyncExternalStore } from "react";
import { IconMonitor, IconMoon, IconSun } from "./icons";

export const CHAVE_TEMA = "curso-foco:tema";

export const COR_CLARA = "#ffffff";
export const COR_ESCURA = "#0b0b0b";

/**
 * Roda antes da primeira pintura, no `<head>`: aplica o tema salvo direto no
 * elemento raiz. Sem isso a página nasce clara e pisca para escura na hidratação.
 *
 * Também cria a meta `theme-color` (a cor da barra do navegador no celular).
 * Ela é criada aqui, e não via `export const viewport`, porque precisa refletir
 * a escolha manual — uma meta com `media` só saberia responder ao sistema.
 */
export const SCRIPT_TEMA = `(function(){try{
var t=localStorage.getItem('${CHAVE_TEMA}');
if(t==='claro'){document.documentElement.dataset.theme='light'}
else if(t==='escuro'){document.documentElement.dataset.theme='dark'}
var escuro=t==='escuro'||(t!=='claro'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var m=document.createElement('meta');m.name='theme-color';m.content=escuro?'${COR_ESCURA}':'${COR_CLARA}';
document.head.appendChild(m);
}catch(e){}})();`;

type Tema = "sistema" | "claro" | "escuro";

const OPCOES: { valor: Tema; rotulo: string; Icon: typeof IconSun }[] = [
  { valor: "sistema", rotulo: "Seguir o sistema", Icon: IconMonitor },
  { valor: "claro", rotulo: "Claro", Icon: IconSun },
  { valor: "escuro", rotulo: "Escuro", Icon: IconMoon },
];

// --- o tema mora no DOM, não no React ---------------------------------------
// A fonte da verdade é o atributo `data-theme` do <html>, que o script do <head>
// já escreveu antes da hidratação. Este store só avisa o React quando ele muda.

const ouvintes = new Set<() => void>();

function assinar(callback: () => void) {
  ouvintes.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    ouvintes.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/** Devolve string primitiva: o snapshot é estável entre renderizações. */
function lerNoCliente(): Tema {
  const atributo = document.documentElement.dataset.theme;
  if (atributo === "light") return "claro";
  if (atributo === "dark") return "escuro";
  return "sistema";
}

const lerNoServidor = (): Tema => "sistema";

function aplicar(tema: Tema) {
  const raiz = document.documentElement;

  try {
    if (tema === "sistema") {
      delete raiz.dataset.theme;
      localStorage.removeItem(CHAVE_TEMA);
    } else {
      raiz.dataset.theme = tema === "claro" ? "light" : "dark";
      localStorage.setItem(CHAVE_TEMA, tema);
    }
  } catch {
    // localStorage indisponível (janela privada): o tema vale só nesta aba
  }

  const escuro =
    tema === "escuro" ||
    (tema === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", escuro ? COR_ESCURA : COR_CLARA);

  for (const avisar of ouvintes) avisar();
}

export function SeletorTema() {
  const tema = useSyncExternalStore(assinar, lerNoCliente, lerNoServidor);

  return (
    <div
      className="flex items-center gap-0.5 rounded-xl border border-line p-0.5"
      role="group"
      aria-label="Tema da interface"
    >
      {OPCOES.map(({ valor, rotulo, Icon }) => {
        const ativo = tema === valor;
        return (
          <button
            key={valor}
            type="button"
            title={rotulo}
            aria-label={rotulo}
            aria-pressed={ativo}
            onClick={() => aplicar(valor)}
            className={`rounded-lg p-1.5 transition-colors ${
              ativo ? "bg-ink text-on-ink" : "text-sub hover:text-ink"
            }`}
          >
            <Icon width={15} height={15} />
          </button>
        );
      })}
    </div>
  );
}
