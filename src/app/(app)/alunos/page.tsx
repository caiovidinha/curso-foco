import Link from "next/link";
import { salvarAluno } from "@/app/actions/pessoas";
import { BotaoSubmit, FormAcao } from "@/components/forms";
import { IconChevron, IconPlus } from "@/components/icons";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { getAlunos, getTurmas } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AlunosPage({ searchParams }: PageProps<"/alunos">) {
  const sp = await searchParams;
  const busca = typeof sp.q === "string" ? sp.q : "";
  const turmaId = typeof sp.turma === "string" ? sp.turma : "";

  const [alunos, turmas] = await Promise.all([
    getAlunos({ busca: busca || undefined, turmaId: turmaId || undefined }),
    getTurmas(),
  ]);

  return (
    <>
      <PageHeader
        titulo="Alunos"
        subtitulo={`${alunos.length} ${alunos.length === 1 ? "aluno encontrado" : "alunos encontrados"}`}
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" method="get">
        <input
          className="input"
          name="q"
          defaultValue={busca}
          placeholder="Buscar por nome…"
          type="search"
          aria-label="Buscar aluno"
        />
        <select className="select sm:w-56" name="turma" defaultValue={turmaId} aria-label="Filtrar por turma">
          <option value="">Todas as turmas</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-outline shrink-0">
          Filtrar
        </button>
      </form>

      <FormAcao action={salvarAluno} limpar className="card mb-6 p-4">
        <div className="section-title mb-3">Novo aluno</div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Field label="Nome completo">
            <input className="input" name="nome" required maxLength={120} placeholder="Ex.: Ana Beatriz Souza" />
          </Field>
          <Field label="Matrícula">
            <input className="input" name="matricula" maxLength={30} placeholder="opcional" />
          </Field>
          <Field label="Turma">
            <select className="select" name="turma_id" defaultValue={turmaId}>
              <option value="">Sem turma</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Field>
          <input type="hidden" name="ativo" value="1" />
          <BotaoSubmit className="btn btn-primary">
            <IconPlus width={16} height={16} />
            Cadastrar
          </BotaoSubmit>
        </div>
      </FormAcao>

      {alunos.length === 0 ? (
        <EmptyState
          titulo="Nenhum aluno encontrado"
          descricao={
            busca || turmaId
              ? "Ajuste os filtros ou cadastre um novo aluno."
              : "Cadastre o primeiro aluno acima, ou importe uma lista pela página da turma."
          }
        />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {alunos.map((a) => (
            <li key={a.id}>
              <Link
                href={`/alunos/${a.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-soft"
              >
                <span className="tabular w-12 shrink-0 text-xs text-sub">
                  {String(a.codigo).padStart(4, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {a.nome}
                    {!a.ativo && <span className="badge ml-2">inativo</span>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {a.turmas?.nome ?? "Sem turma"}
                    {a.matricula && ` · mat. ${a.matricula}`}
                  </div>
                </div>
                <IconChevron width={16} height={16} className="shrink-0 text-sub" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
