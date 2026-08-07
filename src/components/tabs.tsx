"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ itens }: { itens: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <nav className="inline-flex min-w-full gap-1 border-b border-line">
        {itens.map((i) => {
          const on = pathname === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={on ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
