"use client";

import { IconPrint } from "@/components/icons";

export function BotaoImprimir() {
  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      <IconPrint width={16} height={16} />
      Imprimir
    </button>
  );
}
