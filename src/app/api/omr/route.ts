import { NextResponse } from "next/server";
import { lerCartao } from "@/lib/omr/detect";
import { buildSheetLayout } from "@/lib/omr/layout";
import { createClient } from "@/lib/supabase/server";
import type { Questao } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const LIMITE_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, erro: "Não autenticado." }, { status: 401 });

  const form = await request.formData();
  const arquivo = form.get("imagem");
  const simuladoId = String(form.get("simulado_id") ?? "");
  const paginaBruta = form.get("pagina");
  const guardar = form.get("guardar") === "1";

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ ok: false, erro: "Envie uma imagem." }, { status: 400 });
  }
  if (arquivo.size > LIMITE_BYTES) {
    return NextResponse.json({ ok: false, erro: "Imagem muito grande (máx. 12 MB)." }, { status: 413 });
  }
  if (!simuladoId) {
    return NextResponse.json({ ok: false, erro: "Simulado não informado." }, { status: 400 });
  }

  const { data: questoesRaw, error } = await supabase
    .from("questoes")
    .select("*")
    .eq("simulado_id", simuladoId)
    .order("numero");

  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });

  const questoes = (questoesRaw ?? []) as Questao[];
  const objetivas = questoes.filter((q) => q.tipo === "multipla");

  if (objetivas.length === 0) {
    return NextResponse.json(
      { ok: false, erro: "Este simulado não tem questões de múltipla escolha." },
      { status: 400 },
    );
  }

  const numeros = objetivas.map((q) => q.numero);
  const numOpcoes = Math.max(2, ...objetivas.map((q) => q.num_opcoes));
  const layout = buildSheetLayout(numeros, numOpcoes, null);

  const opcoesPorQuestao: Record<number, number> = {};
  for (const q of objetivas) opcoesPorQuestao[q.numero] = q.num_opcoes;

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const leitura = await lerCartao({
    buffer,
    layout,
    pagina: paginaBruta ? Number(paginaBruta) : undefined,
    opcoesPorQuestao,
  });

  if (!leitura.ok) {
    return NextResponse.json({ ok: false, erro: leitura.erro }, { status: 422 });
  }

  // aluno pelo código lido nas bolhas
  type AlunoLido = { id: string; nome: string; codigo: number };
  let aluno: AlunoLido | null = null;
  let provaId: string | null = null;

  if (leitura.codigo !== null) {
    const { data } = await supabase
      .from("alunos")
      .select("id, nome, codigo")
      .eq("codigo", leitura.codigo)
      .maybeSingle<AlunoLido>();

    if (data) {
      aluno = data;

      const { data: prova } = await supabase
        .from("provas")
        .select("id")
        .eq("simulado_id", simuladoId)
        .eq("aluno_id", data.id)
        .maybeSingle();

      if (prova) {
        provaId = prova.id as string;
      } else {
        const { data: nova } = await supabase
          .from("provas")
          .insert({ simulado_id: simuladoId, aluno_id: data.id, origem: "imagem" })
          .select("id")
          .single();
        provaId = (nova?.id as string) ?? null;
      }
    }
  }

  // guarda a foto para conferência posterior
  let imagemPath: string | null = null;
  if (guardar) {
    const nome = `${simuladoId}/${crypto.randomUUID()}.jpg`;
    const { error: erroUpload } = await supabase.storage
      .from("cartoes")
      .upload(nome, buffer, { contentType: arquivo.type || "image/jpeg", upsert: false });
    if (!erroUpload) imagemPath = nome;
  }

  const porNumero = new Map(objetivas.map((q) => [q.numero, q]));

  return NextResponse.json({
    ok: true,
    codigo: leitura.codigo,
    codigoConfianca: leitura.codigoConfianca,
    pagina: leitura.pagina,
    aluno,
    provaId,
    imagemPath,
    avisos: leitura.avisos,
    precisaRevisao: leitura.precisaRevisao,
    preview: leitura.preview,
    respostas: leitura.respostas.map((r) => {
      const q = porNumero.get(r.numero);
      return {
        numero: r.numero,
        questaoId: q?.id ?? null,
        numOpcoes: q?.num_opcoes ?? numOpcoes,
        gabarito: q?.gabarito ?? null,
        marcada: r.marcada,
        confianca: r.confianca,
      };
    }),
  });
}
