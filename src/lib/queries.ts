import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Aluno,
  Area,
  BlocoSimulado,
  Materia,
  Prova,
  Questao,
  Resposta,
  RespostaDetalhe,
  Simulado,
  Turma,
} from "./types";

/**
 * O PostgREST devolve no máximo 1000 linhas por requisição. Consultas que podem
 * passar disso (respostas, listas de alunos) precisam paginar, senão as
 * estatísticas saem truncadas sem nenhum erro visível.
 */
const PAGINA = 1000;

async function todas<T>(
  buscar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const acumulado: T[] = [];

  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await buscar(de, de + PAGINA - 1);
    if (error) throw error;

    const lote = data ?? [];
    acumulado.push(...lote);
    if (lote.length < PAGINA) return acumulado;
  }
}

export type AreaComMaterias = Area & { materias: Materia[] };

export async function getCatalogo(): Promise<AreaComMaterias[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("areas")
    .select("*, materias(*)")
    .order("ordem")
    .order("ordem", { referencedTable: "materias" });

  if (error) throw error;
  return (data ?? []) as AreaComMaterias[];
}

export type TurmaComContagem = Turma & { alunos: { count: number }[] };

export async function getTurmas(): Promise<(Turma & { qtdAlunos: number })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turmas")
    .select("*, alunos(count)")
    .order("ano", { ascending: false })
    .order("nome");

  if (error) throw error;
  return (data as TurmaComContagem[]).map(({ alunos, ...t }) => ({
    ...t,
    qtdAlunos: alunos?.[0]?.count ?? 0,
  }));
}

export type AlunoComTurma = Aluno & { turmas: Pick<Turma, "id" | "nome"> | null };

export async function getAlunos(opts?: { turmaId?: string; busca?: string }) {
  const supabase = await createClient();

  return todas<AlunoComTurma>((de, ate) => {
    let q = supabase.from("alunos").select("*, turmas(id, nome)").order("nome").range(de, ate);
    if (opts?.turmaId) q = q.eq("turma_id", opts.turmaId);
    if (opts?.busca) q = q.ilike("nome", `%${opts.busca}%`);
    return q as unknown as PromiseLike<{ data: AlunoComTurma[] | null; error: unknown }>;
  });
}

export async function getAluno(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alunos")
    .select("*, turmas(id, nome)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as AlunoComTurma | null;
}

export async function getSimulados() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulados")
    .select("*, questoes(count), provas(count)")
    .order("data", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  type Linha = Simulado & { questoes: { count: number }[]; provas: { count: number }[] };
  return (data as Linha[]).map(({ questoes, provas, ...s }) => ({
    ...s,
    qtdQuestoes: questoes?.[0]?.count ?? 0,
    qtdProvas: provas?.[0]?.count ?? 0,
  }));
}

export type SimuladoCompleto = Simulado & {
  blocos: BlocoSimulado[];
  questoes: Questao[];
  turmaIds: string[];
};

export async function getSimulado(id: string): Promise<SimuladoCompleto | null> {
  const supabase = await createClient();

  const [{ data: simulado, error: e1 }, { data: blocos, error: e2 }, { data: questoes, error: e3 }, { data: turmas, error: e4 }] =
    await Promise.all([
      supabase.from("simulados").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("simulado_materias")
        .select("id, ordem, materias(id, nome, areas(id, nome))")
        .eq("simulado_id", id)
        .order("ordem"),
      supabase.from("questoes").select("*").eq("simulado_id", id).order("numero"),
      supabase.from("simulado_turmas").select("turma_id").eq("simulado_id", id),
    ]);

  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;
  if (!simulado) return null;

  type BlocoRaw = {
    id: string;
    ordem: number;
    materias: { id: string; nome: string; areas: { id: string; nome: string } | null } | null;
  };

  const todasQuestoes = (questoes ?? []) as Questao[];

  return {
    ...(simulado as Simulado),
    questoes: todasQuestoes,
    turmaIds: (turmas ?? []).map((t) => t.turma_id as string),
    blocos: ((blocos ?? []) as unknown as BlocoRaw[]).map((b) => ({
      id: b.id,
      ordem: b.ordem,
      materia: { id: b.materias?.id ?? "", nome: b.materias?.nome ?? "—" },
      area: { id: b.materias?.areas?.id ?? "", nome: b.materias?.areas?.nome ?? "—" },
      questoes: todasQuestoes.filter((q) => q.simulado_materia_id === b.id),
    })),
  };
}

export type ProvaComAluno = Prova & {
  alunos: Pick<Aluno, "id" | "nome" | "codigo" | "turma_id"> & {
    turmas: Pick<Turma, "id" | "nome"> | null;
  };
};

export async function getProvas(simuladoId: string) {
  const supabase = await createClient();

  const provas = await todas<ProvaComAluno>((de, ate) =>
    supabase
      .from("provas")
      .select("*, alunos(id, nome, codigo, turma_id, turmas(id, nome))")
      .eq("simulado_id", simuladoId)
      .order("id")
      .range(de, ate) as unknown as PromiseLike<{ data: ProvaComAluno[] | null; error: unknown }>,
  );

  return provas.sort((a, b) => a.alunos.nome.localeCompare(b.alunos.nome, "pt-BR"));
}

export async function getProva(provaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provas")
    .select("*, alunos(id, nome, codigo, turma_id, turmas(id, nome))")
    .eq("id", provaId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as ProvaComAluno | null;
}

export async function getRespostas(provaId: string) {
  const supabase = await createClient();

  return todas<Resposta>((de, ate) =>
    supabase
      .from("respostas")
      .select("*")
      .eq("prova_id", provaId)
      .order("id")
      .range(de, ate) as unknown as PromiseLike<{ data: Resposta[] | null; error: unknown }>,
  );
}

/** Linhas da view de análise, com filtros opcionais. */
export async function getDetalhes(filtro: {
  simuladoId?: string;
  simuladoIds?: string[];
  alunoId?: string;
  turmaId?: string;
  somenteCorrigidas?: boolean;
}): Promise<RespostaDetalhe[]> {
  if (filtro.simuladoIds && filtro.simuladoIds.length === 0) return [];

  const supabase = await createClient();

  return todas<RespostaDetalhe>((de, ate) => {
    let q = supabase
      .from("vw_respostas_detalhe")
      .select("*")
      .order("resposta_id")
      .range(de, ate);

    if (filtro.simuladoId) q = q.eq("simulado_id", filtro.simuladoId);
    if (filtro.simuladoIds) q = q.in("simulado_id", filtro.simuladoIds);
    if (filtro.alunoId) q = q.eq("aluno_id", filtro.alunoId);
    if (filtro.turmaId) q = q.eq("turma_id", filtro.turmaId);
    if (filtro.somenteCorrigidas !== false) q = q.eq("prova_status", "corrigida");

    return q as unknown as PromiseLike<{ data: RespostaDetalhe[] | null; error: unknown }>;
  });
}

export async function getResumoGeral() {
  const supabase = await createClient();

  const [alunos, turmas, simulados, pendentes] = await Promise.all([
    supabase.from("alunos").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("turmas").select("*", { count: "exact", head: true }),
    supabase.from("simulados").select("*", { count: "exact", head: true }),
    supabase.from("provas").select("*", { count: "exact", head: true }).in("status", ["pendente", "revisar"]),
  ]);

  return {
    alunos: alunos.count ?? 0,
    turmas: turmas.count ?? 0,
    simulados: simulados.count ?? 0,
    pendentes: pendentes.count ?? 0,
  };
}
