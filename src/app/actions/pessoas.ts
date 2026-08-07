"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Resultado } from "./catalogo";

// --- turmas ----------------------------------------------------------------

export async function salvarTurma(formData: FormData): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const anoRaw = String(formData.get("ano") ?? "").trim();
  const turno = String(formData.get("turno") ?? "").trim() || null;

  if (!nome) return { ok: false, erro: "Informe o nome da turma." };

  const dados = { nome, ano: anoRaw ? Number(anoRaw) : null, turno };
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("turmas").update(dados).eq("id", id)
    : await supabase.from("turmas").insert(dados);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/turmas");
  revalidatePath("/alunos");
  return { ok: true };
}

export async function excluirTurma(formData: FormData): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("turmas").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/turmas");
  revalidatePath("/alunos");
  redirect("/turmas");
}

// --- alunos ----------------------------------------------------------------

export async function salvarAluno(formData: FormData): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const matricula = String(formData.get("matricula") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const turmaId = String(formData.get("turma_id") ?? "") || null;
  const ativo = formData.get("ativo") !== null;

  if (!nome) return { ok: false, erro: "Informe o nome do aluno." };

  const dados = { nome, matricula, email, turma_id: turmaId, ativo };
  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("alunos").update(dados).eq("id", id)
    : await supabase.from("alunos").insert(dados);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/alunos");
  revalidatePath("/turmas");
  return { ok: true };
}

/** Importação rápida: um aluno por linha, opcionalmente "Nome; matrícula". */
export async function importarAlunos(formData: FormData): Promise<Resultado> {
  const turmaId = String(formData.get("turma_id") ?? "") || null;
  const texto = String(formData.get("lista") ?? "");

  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [nome, matricula] = l.split(/[;\t]/).map((p) => p?.trim());
      return { nome, matricula: matricula || null, turma_id: turmaId, ativo: true };
    })
    .filter((a) => a.nome);

  if (linhas.length === 0) return { ok: false, erro: "Nenhum nome encontrado na lista." };

  const supabase = await createClient();
  const { error } = await supabase.from("alunos").insert(linhas);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/alunos");
  revalidatePath("/turmas");
  return { ok: true };
}

export async function excluirAluno(formData: FormData): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("alunos").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/alunos");
  redirect("/alunos");
}
