"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconClass, IconExam, IconHome, IconSettings, IconUsers } from "./icons";

type Item = {
  href: string;
  label: string;
  Icon: (p: { width?: number; height?: number; strokeWidth?: number }) => React.ReactElement;
  exato?: boolean;
};

const ITENS: Item[] = [
  { href: "/", label: "Início", Icon: IconHome, exato: true },
  { href: "/simulados", label: "Simulados", Icon: IconExam },
  { href: "/turmas", label: "Turmas", Icon: IconClass },
  { href: "/alunos", label: "Alunos", Icon: IconUsers },
  { href: "/config", label: "Matérias", Icon: IconSettings },
];

function ativo(pathname: string, href: string, exato?: boolean) {
  return exato ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

/** Barra inferior fixa — navegação primária no mobile. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <ul className="grid grid-cols-5">
        {ITENS.map(({ href, label, Icon, exato }) => {
          const on = ativo(pathname, href, exato);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[0.65rem] font-medium transition-colors ${
                  on ? "text-ink" : "text-sub"
                }`}
              >
                <Icon width={21} height={21} strokeWidth={on ? 2.1 : 1.6} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barra lateral — navegação no desktop. */
export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-60 shrink-0 md:block" aria-label="Navegação principal">
      <div className="sticky top-0 flex h-dvh flex-col border-r border-line px-4 py-6">
        <Link href="/" className="mb-8 block px-2">
          <div className="text-[0.65rem] font-semibold tracking-[0.22em] text-sub uppercase">
            Curso Foco
          </div>
          <div className="text-lg font-semibold tracking-tight">Simulados</div>
        </Link>

        <ul className="flex flex-col gap-1">
          {ITENS.map(({ href, label, Icon, exato }) => {
            const on = ativo(pathname, href, exato);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    on ? "bg-ink text-on-ink" : "text-muted hover:bg-soft hover:text-ink"
                  }`}
                >
                  <Icon width={19} height={19} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
