"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LETRAS, RASURA, type Questao, type StatusProva } from "@/lib/types";
import type { Resultado } from "./catalogo";

export type RespostaEntrada = {
  questaoId: string;
  marcada: string | null;
  nota?: number | null;
  confianca?: number | null;
  revisada?: boolean;
};

async function gravar(
  provaId: string,
  entradas: RespostaEntrada[],
  status: StatusProva,
): Promise<Resultado> {
  const supabase = await createClient();

  const { data: prova } = await supabase
    .from("provas")
    .select("id, simulado_id")
    .eq("id", provaId)
    .maybeSingle();

  if (!prova) return { ok: false, erro: "Prova não encontrada." };

  const { data: questoes } = await supabase
    .from("questoes")
    .select("id, tipo, num_opcoes, peso")
    .eq("simulado_id", prova.simulado_id);

  type QuestaoMin = Pick<Questao, "id" | "tipo" | "num_opcoes" | "peso">;
  const porId = new Map((questoes ?? []).map((q) => [q.id as string, q as QuestaoMin]));

  const linhas = entradas
    .filter((e) => porId.has(e.questaoId))
    .map((e) => {
      const q = porId.get(e.questaoId)!;
      const validas = [...LETRAS.slice(0, q.num_opcoes), RASURA] as string[];
      const marcada =
        q.tipo === "multipla" && e.marcada && validas.includes(e.marcada) ? e.marcada : null;

      // discursiva e redação são lançadas por nota, sempre dentro do peso do item
      let nota: number | null = null;
      if (q.tipo !== "multipla" && e.nota != null && Number.isFinite(e.nota)) {
        nota = Math.max(0, Math.min(Number(q.peso), e.nota));
      }

      return {
        prova_id: provaId,
        questao_id: e.questaoId,
        marcada,
        nota,
        confianca: e.confianca ?? null,
        revisada: e.revisada ?? true,
      };
    });

  if (linhas.length > 0) {
    const { error } = await supabase
      .from("respostas")
      .upsert(linhas, { onConflict: "prova_id,questao_id" });
    if (error) return { ok: false, erro: error.message };
  }

  const { error: erroProva } = await supabase
    .from("provas")
    .update({ status, corrigida_em: status === "corrigida" ? new Date().toISOString() : null })
    .eq("id", provaId);

  if (erroProva) return { ok: false, erro: erroProva.message };

  revalidatePath(`/correcao/${provaId}`);
  revalidatePath(`/simulados/${prova.simulado_id}`, "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Correção manual: campos `q_<questaoId>` (letra) e `nota_<questaoId>`. */
export async function salvarCorrecao(formData: FormData): Promise<Resultado> {
  const provaId = String(formData.get("prova_id") ?? "");
  const status = (String(formData.get("status") ?? "corrigida") as StatusProva) || "corrigida";

  const entradas: RespostaEntrada[] = [];
  for (const [chave, valor] of formData.entries()) {
    if (chave.startsWith("q_")) {
      const bruto = String(valor).trim().toUpperCase();
      entradas.push({ questaoId: chave.slice(2), marcada: bruto || null });
    } else if (chave.startsWith("nota_")) {
      const questaoId = chave.slice(5);
      const bruto = String(valor).trim();
      const existente = entradas.find((e) => e.questaoId === questaoId);
      const nota = bruto === "" ? null : Number(bruto.replace(",", "."));
      if (existente) existente.nota = nota;
      else entradas.push({ questaoId, marcada: null, nota });
    }
  }

  return gravar(provaId, entradas, status);
}

/** Aplica o resultado revisado da leitura óptica. */
export async function aplicarLeitura(formData: FormData): Promise<Resultado> {
  const provaId = String(formData.get("prova_id") ?? "");
  const payload = String(formData.get("respostas") ?? "[]");
  const imagemPath = String(formData.get("imagem_path") ?? "") || null;

  let entradas: RespostaEntrada[] = [];
  try {
    entradas = JSON.parse(payload) as RespostaEntrada[];
  } catch {
    return { ok: false, erro: "Não consegui ler os dados da correção." };
  }

  const supabase = await createClient();
  await supabase.from("provas").update({ origem: "imagem", imagem_path: imagemPath }).eq("id", provaId);

  return gravar(provaId, entradas, "corrigida");
}

export async function definirStatusProva(formData: FormData): Promise<Resultado> {
  const provaId = String(formData.get("prova_id") ?? "");
  const status = String(formData.get("status") ?? "pendente") as StatusProva;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provas")
    .update({ status })
    .eq("id", provaId)
    .select("simulado_id")
    .maybeSingle();

  if (error) return { ok: false, erro: error.message };

  if (data) revalidatePath(`/simulados/${data.simulado_id}`, "layout");
  revalidatePath(`/correcao/${provaId}`);
  return { ok: true };
}

/** Devolve a prova do aluno neste simulado, criando-a se ainda não existir. */
export async function obterOuCriarProva(
  simuladoId: string,
  alunoId: string,
): Promise<{ ok: boolean; provaId?: string; erro?: string }> {
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("provas")
    .select("id")
    .eq("simulado_id", simuladoId)
    .eq("aluno_id", alunoId)
    .maybeSingle();

  if (existente) return { ok: true, provaId: existente.id as string };

  const { data, error } = await supabase
    .from("provas")
    .insert({ simulado_id: simuladoId, aluno_id: alunoId, origem: "imagem" })
    .select("id")
    .single();

  if (error) return { ok: false, erro: error.message };
  return { ok: true, provaId: data.id as string };
}

export async function criarProva(formData: FormData) {
  const simuladoId = String(formData.get("simulado_id") ?? "");
  const alunoId = String(formData.get("aluno_id") ?? "");

  const supabase = await createClient();
  const { data: existente } = await supabase
    .from("provas")
    .select("id")
    .eq("simulado_id", simuladoId)
    .eq("aluno_id", alunoId)
    .maybeSingle();

  if (existente) redirect(`/correcao/${existente.id}`);

  const { data, error } = await supabase
    .from("provas")
    .insert({ simulado_id: simuladoId, aluno_id: alunoId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/simulados/${simuladoId}`, "layout");
  redirect(`/correcao/${data.id}`);
}

export async function excluirProva(formData: FormData) {
  const provaId = String(formData.get("prova_id") ?? "");
  const simuladoId = String(formData.get("simulado_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("provas").delete().eq("id", provaId);
  if (error) throw new Error(error.message);

  revalidatePath(`/simulados/${simuladoId}`, "layout");
  redirect(`/simulados/${simuladoId}/correcao`);
}
