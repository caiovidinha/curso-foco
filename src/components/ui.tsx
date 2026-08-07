import Link from "next/link";
import type { ReactNode } from "react";
import { IconBack } from "./icons";

export function PageHeader({
  titulo,
  subtitulo,
  voltar,
  acoes,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  voltar?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {voltar && (
          <Link
            href={voltar}
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          >
            <IconBack width={14} height={14} />
            Voltar
          </Link>
        )}
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
          {titulo}
        </h1>
        {subtitulo && <div className="mt-1.5 text-sm text-muted">{subtitulo}</div>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}

export function Stat({
  label,
  valor,
  sufixo,
  hint,
}: {
  label: string;
  valor: ReactNode;
  sufixo?: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="section-title">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="tabular text-3xl font-semibold tracking-tight">{valor}</span>
        {sufixo && <span className="text-sm text-muted">{sufixo}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-sub">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="card-flat flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="text-base font-medium">{titulo}</div>
      {descricao && <p className="max-w-sm text-sm text-balance text-muted">{descricao}</p>}
      {acao}
    </div>
  );
}

/** Barra horizontal de proporção — usada em listas de desempenho. */
export function Meter({ valor, label }: { valor: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-soft">
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular w-11 shrink-0 text-right text-xs text-muted">
        {label ?? `${pct.toFixed(0)}%`}
      </span>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const solido = status === "corrigida" || status === "aplicado";
  const rotulos: Record<string, string> = {
    rascunho: "Rascunho",
    aplicado: "Aplicado",
    encerrado: "Encerrado",
    pendente: "Pendente",
    revisar: "Revisar",
    corrigida: "Corrigida",
    ausente: "Ausente",
  };
  return <span className={solido ? "badge badge-solid" : "badge"}>{rotulos[status] ?? status}</span>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-sub">{hint}</span>}
    </label>
  );
}
