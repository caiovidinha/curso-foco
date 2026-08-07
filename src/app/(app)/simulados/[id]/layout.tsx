import { notFound } from "next/navigation";
import { Tabs } from "@/components/tabs";
import { PageHeader, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { fmtData } from "@/lib/scoring";
import type { Simulado } from "@/lib/types";

export default async function SimuladoLayout({ children, params }: LayoutProps<"/simulados/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("simulados").select("*").eq("id", id).maybeSingle();

  if (!data) notFound();
  const s = data as Simulado;

  return (
    <>
      <PageHeader
        titulo={s.titulo}
        voltar="/simulados"
        subtitulo={<span className="tabular">{fmtData(s.data)}</span>}
        acoes={<StatusBadge status={s.status} />}
      />

      <Tabs
        itens={[
          { href: `/simulados/${id}`, label: "Estrutura" },
          { href: `/simulados/${id}/gabarito`, label: "Gabarito" },
          { href: `/simulados/${id}/correcao`, label: "Correção" },
          { href: `/simulados/${id}/resultados`, label: "Resultados" },
        ]}
      />

      {children}
    </>
  );
}
