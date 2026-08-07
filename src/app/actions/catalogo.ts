"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Resultado = { ok: boolean; erro?: string };

export async function criarArea(formData: FormData): Promise<Resultado> {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { ok: false, erro: "Informe o nome da área." };

  const supabase = await createClient();
  const { count } = await supabase.from("areas").select("*", { count: "exact", head: true });
  const { error } = await supabase.from("areas").insert({ nome, ordem: (count ?? 0) + 1 });

  if (error) {
    return { ok: false, erro: error.code === "23505" ? "Já existe uma área com esse nome." : error.message };
  }

  revalidatePath("/config");
  return { ok: true };
}

export async function renomearArea(formData: FormData): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return { ok: false, erro: "Dados incompletos." };

  const supabase = await createClient();
  const { error } = await supabase.from("areas").update({ nome }).eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/config");
  return { ok: true };
}

export async function excluirArea(formData: FormData): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("areas").delete().eq("id", id);

  if (error) {
    return {
      ok: false,
      erro:
        error.code === "23503"
          ? "Não dá para excluir: existem matérias desta área usadas em simulados."
          : error.message,
    };
  }

  revalidatePath("/config");
  return { ok: true };
}

export async function criarMateria(formData: FormData): Promise<Resultado> {
  const areaId = String(formData.get("area_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!areaId || !nome) return { ok: false, erro: "Informe a área e o nome da matéria." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("materias")
    .select("*", { count: "exact", head: true })
    .eq("area_id", areaId);

  const { error } = await supabase
    .from("materias")
    .insert({ area_id: areaId, nome, ordem: (count ?? 0) + 1 });

  if (error) {
    return {
      ok: false,
      erro: error.code === "23505" ? "Essa matéria já existe nesta área." : error.message,
    };
  }

  revalidatePath("/config");
  return { ok: true };
}

export async function renomearMateria(formData: FormData): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return { ok: false, erro: "Dados incompletos." };

  const supabase = await createClient();
  const { error } = await supabase.from("materias").update({ nome }).eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/config");
  return { ok: true };
}

export async function excluirMateria(formData: FormData): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("materias").delete().eq("id", id);

  if (error) {
    return {
      ok: false,
      erro:
        error.code === "23503"
          ? "Não dá para excluir: esta matéria está em uso em algum simulado."
          : error.message,
    };
  }

  revalidatePath("/config");
  return { ok: true };
}
