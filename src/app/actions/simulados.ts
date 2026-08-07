"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LETRAS, type Questao, type TipoQuestao } from "@/lib/types";
import type { Resultado } from "./catalogo";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Renumera todas as questões do simulado de 1..N seguindo a ordem dos blocos.
 * Chamado sempre que a estrutura muda; os `id` não mudam, então as respostas já
 * gravadas continuam apontando para a questão certa.
 */
async function renumerar(supabase: Supabase, simuladoId: string) {
  const [{ data: blocos }, { data: questoes }] = await Promise.all([
    supabase.from("simulado_materias").select("id, ordem").eq("simulado_id", simuladoId).order("ordem"),
    supabase.from("questoes").select("*").eq("simulado_id", simuladoId).order("numero"),
  ]);

  if (!blocos || !questoes) return;

  const ordemBloco = new Map(blocos.map((b, i) => [b.id as string, i]));
  const ordenadas = [...(questoes as Questao[])].sort((a, b) => {
    const d = (ordemBloco.get(a.simulado_materia_id) ?? 999) - (ordemBloco.get(b.simulado_materia_id) ?? 999);
    return d !== 0 ? d : a.numero - b.numero;
  });

  const mudou = ordenadas.filter((q, i) => q.numero !== i + 1);
  if (mudou.length === 0) return;

  await supabase
    .from("questoes")
    .upsert(ordenadas.map((q, i) => ({ ...q, numero: i + 1 })), { onConflict: "id" });
}

// --- CRUD do simulado ------------------------------------------------------

export async function criarSimulado(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const data = String(formData.get("data") ?? "") || null;
  const opcoes = Number(formData.get("opcoes_padrao") ?? 5);

  if (!titulo) throw new Error("Informe o título do simulado.");

  const supabase = await createClient();
  const { data: novo, error } = await supabase
    .from("simulados")
    .insert({ titulo, descricao, data, opcoes_padrao: opcoes })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/simulados");
  redirect(`/simulados/${novo.id}`);
}

export async function atualizarSimulado(formData: FormData): Promise<Resultado> {
  const id = String(formData.get("id") ?? "");
  const dados = {
    titulo: String(formData.get("titulo") ?? "").trim(),
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    data: String(formData.get("data") ?? "") || null,
    status: String(formData.get("status") ?? "rascunho"),
  };

  if (!dados.titulo) return { ok: false, erro: "Informe o título." };

  const supabase = await createClient();
  const { error } = await supabase.from("simulados").update(dados).eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/simulados/${id}`);
  revalidatePath("/simulados");
  return { ok: true };
}

/**
 * Cria um novo simulado com a mesma estrutura de blocos e questões.
 * As provas e respostas nunca são copiadas — a cópia nasce em rascunho, vazia.
 */
export async function duplicarSimulado(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const data = String(formData.get("data") ?? "") || null;
  const comGabarito = formData.get("copiar_gabarito") !== null;
  const comTurmas = formData.get("copiar_turmas") !== null;

  const supabase = await createClient();

  const [{ data: origem }, { data: blocos }, { data: questoes }, { data: turmas }] =
    await Promise.all([
      supabase.from("simulados").select("*").eq("id", id).maybeSingle(),
      supabase.from("simulado_materias").select("*").eq("simulado_id", id).order("ordem"),
      supabase.from("questoes").select("*").eq("simulado_id", id).order("numero"),
      supabase.from("simulado_turmas").select("turma_id").eq("simulado_id", id),
    ]);

  if (!origem) throw new Error("Simulado não encontrado.");

  const { data: novo, error: erroNovo } = await supabase
    .from("simulados")
    .insert({
      titulo: titulo || `${origem.titulo} (cópia)`,
      descricao: origem.descricao,
      data,
      status: "rascunho",
      opcoes_padrao: origem.opcoes_padrao,
    })
    .select("id")
    .single();

  if (erroNovo) throw new Error(erroNovo.message);

  type BlocoLinha = { id: string; materia_id: string; ordem: number };
  const originais = (blocos ?? []) as BlocoLinha[];

  if (originais.length > 0) {
    const { data: criados, error } = await supabase
      .from("simulado_materias")
      .insert(
        originais.map((b) => ({
          simulado_id: novo.id,
          materia_id: b.materia_id,
          ordem: b.ordem,
        })),
      )
      .select("id, materia_id");

    if (error) throw new Error(error.message);

    // a matéria é única dentro de um simulado, então serve de chave entre os dois
    const porMateria = new Map(
      (criados ?? []).map((b) => [b.materia_id as string, b.id as string]),
    );
    const materiaDoBloco = new Map(originais.map((b) => [b.id, b.materia_id]));

    const novasQuestoes = (questoes as Questao[]).flatMap((q) => {
      const blocoNovo = porMateria.get(materiaDoBloco.get(q.simulado_materia_id) ?? "");
      if (!blocoNovo) return [];
      return [
        {
          simulado_id: novo.id,
          simulado_materia_id: blocoNovo,
          numero: q.numero,
          tipo: q.tipo,
          num_opcoes: q.num_opcoes,
          gabarito: comGabarito ? q.gabarito : null,
          peso: q.peso,
          enunciado_ref: q.enunciado_ref,
        },
      ];
    });

    if (novasQuestoes.length > 0) {
      const { error: erroQ } = await supabase.from("questoes").insert(novasQuestoes);
      if (erroQ) throw new Error(erroQ.message);
    }
  }

  if (comTurmas && turmas && turmas.length > 0) {
    await supabase
      .from("simulado_turmas")
      .insert(turmas.map((t) => ({ simulado_id: novo.id, turma_id: t.turma_id as string })));
  }

  revalidatePath("/simulados");
  redirect(`/simulados/${novo.id}`);
}

export async function excluirSimulado(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("simulados").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/simulados");
  redirect("/simulados");
}

// --- blocos (matérias do simulado) ----------------------------------------

/**
 * Normaliza a configuração de um bloco. É aqui que combinações impossíveis são
 * descartadas: discursiva e redação não têm alternativas, e redação é sempre um
 * item único.
 */
function lerConfigBloco(formData: FormData) {
  const bruto = String(formData.get("tipo") ?? "multipla");
  const tipo: TipoQuestao =
    bruto === "discursiva" || bruto === "redacao" ? bruto : "multipla";

  const quantidade =
    tipo === "redacao"
      ? 1
      : Math.max(1, Math.min(300, Number(formData.get("quantidade") ?? 0)));

  const numOpcoes =
    tipo === "multipla" ? Math.max(2, Math.min(10, Number(formData.get("num_opcoes") ?? 5))) : 0;

  const pesoBruto = Number(String(formData.get("peso") ?? "").replace(",", "."));
  const peso =
    tipo === "multipla"
      ? 1
      : Number.isFinite(pesoBruto) && pesoBruto > 0
        ? Math.min(9999, pesoBruto)
        : tipo === "redacao"
          ? 1000
          : 10;

  return { tipo, quantidade, numOpcoes, peso };
}

export async function adicionarBloco(formData: FormData): Promise<Resultado> {
  const simuladoId = String(formData.get("simulado_id") ?? "");
  const materiaId = String(formData.get("materia_id") ?? "");
  const { tipo, quantidade, numOpcoes, peso } = lerConfigBloco(formData);

  if (!simuladoId || !materiaId) return { ok: false, erro: "Selecione a matéria." };
  if (!quantidade) return { ok: false, erro: "Informe a quantidade de questões." };

  const supabase = await createClient();

  const { data: existentes } = await supabase
    .from("simulado_materias")
    .select("ordem")
    .eq("simulado_id", simuladoId);

  const ordem = Math.max(0, ...(existentes ?? []).map((b) => b.ordem as number)) + 1;

  const { data: bloco, error: erroBloco } = await supabase
    .from("simulado_materias")
    .insert({ simulado_id: simuladoId, materia_id: materiaId, ordem })
    .select("id")
    .single();

  if (erroBloco) {
    return {
      ok: false,
      erro:
        erroBloco.code === "23505"
          ? "Essa matéria já faz parte do simulado. Edite o bloco existente."
          : erroBloco.message,
    };
  }

  const { data: ultimas } = await supabase
    .from("questoes")
    .select("numero")
    .eq("simulado_id", simuladoId)
    .order("numero", { ascending: false })
    .limit(1);

  const base = ultimas?.[0]?.numero ?? 0;

  const novas = Array.from({ length: quantidade }, (_, i) => ({
    simulado_id: simuladoId,
    simulado_materia_id: bloco.id,
    numero: base + i + 1,
    tipo,
    num_opcoes: numOpcoes,
    peso,
  }));

  const { error } = await supabase.from("questoes").insert(novas);
  if (error) return { ok: false, erro: error.message };

  await renumerar(supabase, simuladoId);
  revalidatePath(`/simulados/${simuladoId}`);
  return { ok: true };
}

export async function atualizarBloco(formData: FormData): Promise<Resultado> {
  const blocoId = String(formData.get("bloco_id") ?? "");
  const simuladoId = String(formData.get("simulado_id") ?? "");
  const { tipo, quantidade, numOpcoes, peso } = lerConfigBloco(formData);

  const supabase = await createClient();
  const { data: atuais, error: erroLer } = await supabase
    .from("questoes")
    .select("*")
    .eq("simulado_materia_id", blocoId)
    .order("numero");

  if (erroLer) return { ok: false, erro: erroLer.message };

  const questoes = (atuais ?? []) as Questao[];
  const validas = LETRAS.slice(0, numOpcoes) as unknown as string[];

  if (quantidade < questoes.length) {
    const remover = questoes.slice(quantidade).map((q) => q.id);
    const { error } = await supabase.from("questoes").delete().in("id", remover);
    if (error) return { ok: false, erro: error.message };
  }

  const manter = questoes.slice(0, quantidade);
  if (manter.length > 0) {
    const { error } = await supabase.from("questoes").upsert(
      manter.map((q) => ({
        ...q,
        tipo,
        num_opcoes: numOpcoes,
        peso,
        // gabarito fora do novo intervalo de alternativas deixa de valer
        gabarito: tipo === "multipla" && q.gabarito && validas.includes(q.gabarito) ? q.gabarito : null,
      })),
      { onConflict: "id" },
    );
    if (error) return { ok: false, erro: error.message };
  }

  if (quantidade > questoes.length) {
    const base = Math.max(0, ...questoes.map((q) => q.numero));
    const novas = Array.from({ length: quantidade - questoes.length }, (_, i) => ({
      simulado_id: simuladoId,
      simulado_materia_id: blocoId,
      numero: base + i + 1 + 10_000, // fora de faixa; `renumerar` corrige em seguida
      tipo,
      num_opcoes: numOpcoes,
      peso,
    }));
    const { error } = await supabase.from("questoes").insert(novas);
    if (error) return { ok: false, erro: error.message };
  }

  await renumerar(supabase, simuladoId);
  revalidatePath(`/simulados/${simuladoId}`);
  return { ok: true };
}

export async function removerBloco(formData: FormData): Promise<Resultado> {
  const blocoId = String(formData.get("bloco_id") ?? "");
  const simuladoId = String(formData.get("simulado_id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("simulado_materias").delete().eq("id", blocoId);
  if (error) return { ok: false, erro: error.message };

  await renumerar(supabase, simuladoId);
  revalidatePath(`/simulados/${simuladoId}`);
  return { ok: true };
}

export async function moverBloco(formData: FormData): Promise<Resultado> {
  const blocoId = String(formData.get("bloco_id") ?? "");
  const simuladoId = String(formData.get("simulado_id") ?? "");
  const direcao = String(formData.get("direcao") ?? "cima");

  const supabase = await createClient();
  const { data: blocos } = await supabase
    .from("simulado_materias")
    .select("id, ordem")
    .eq("simulado_id", simuladoId)
    .order("ordem");

  if (!blocos) return { ok: false, erro: "Simulado não encontrado." };

  const i = blocos.findIndex((b) => b.id === blocoId);
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= blocos.length) return { ok: true };

  const lista = [...blocos];
  [lista[i], lista[j]] = [lista[j], lista[i]];

  await Promise.all(
    lista.map((b, idx) => supabase.from("simulado_materias").update({ ordem: idx + 1 }).eq("id", b.id)),
  );

  await renumerar(supabase, simuladoId);
  revalidatePath(`/simulados/${simuladoId}`);
  return { ok: true };
}

// --- gabarito --------------------------------------------------------------

export async function salvarGabarito(formData: FormData): Promise<Resultado> {
  const simuladoId = String(formData.get("simulado_id") ?? "");
  const supabase = await createClient();

  const { data: questoes, error: erroLer } = await supabase
    .from("questoes")
    .select("*")
    .eq("simulado_id", simuladoId);

  if (erroLer) return { ok: false, erro: erroLer.message };

  const atualizadas = (questoes as Questao[]).map((q) => {
    if (q.tipo !== "multipla") return q;
    const valor = String(formData.get(`gab_${q.id}`) ?? "").trim().toUpperCase();
    const validas = LETRAS.slice(0, q.num_opcoes) as unknown as string[];
    return { ...q, gabarito: validas.includes(valor) ? valor : null };
  });

  const { error } = await supabase.from("questoes").upsert(atualizadas, { onConflict: "id" });
  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/simulados/${simuladoId}`, "layout");
  return { ok: true };
}

// --- turmas e geração de provas -------------------------------------------

export async function definirTurmas(formData: FormData): Promise<Resultado> {
  const simuladoId = String(formData.get("simulado_id") ?? "");
  const turmaIds = formData.getAll("turma_ids").map(String).filter(Boolean);

  const supabase = await createClient();
  const { error: erroDel } = await supabase
    .from("simulado_turmas")
    .delete()
    .eq("simulado_id", simuladoId);
  if (erroDel) return { ok: false, erro: erroDel.message };

  if (turmaIds.length > 0) {
    const { error } = await supabase
      .from("simulado_turmas")
      .insert(turmaIds.map((turma_id) => ({ simulado_id: simuladoId, turma_id })));
    if (error) return { ok: false, erro: error.message };
  }

  revalidatePath(`/simulados/${simuladoId}`, "layout");
  return { ok: true };
}

/** Cria uma prova pendente para cada aluno ativo das turmas vinculadas. */
export async function gerarProvas(formData: FormData): Promise<Resultado> {
  const simuladoId = String(formData.get("simulado_id") ?? "");
  const supabase = await createClient();

  const { data: vinculos } = await supabase
    .from("simulado_turmas")
    .select("turma_id")
    .eq("simulado_id", simuladoId);

  const turmaIds = (vinculos ?? []).map((v) => v.turma_id as string);
  if (turmaIds.length === 0) {
    return { ok: false, erro: "Vincule ao menos uma turma antes de gerar as provas." };
  }

  const { data: alunos } = await supabase
    .from("alunos")
    .select("id")
    .eq("ativo", true)
    .in("turma_id", turmaIds);

  if (!alunos || alunos.length === 0) {
    return { ok: false, erro: "Nenhum aluno ativo nas turmas selecionadas." };
  }

  const { error } = await supabase.from("provas").upsert(
    alunos.map((a) => ({ simulado_id: simuladoId, aluno_id: a.id as string, status: "pendente" })),
    { onConflict: "simulado_id,aluno_id", ignoreDuplicates: true },
  );

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/simulados/${simuladoId}`, "layout");
  return { ok: true };
}
