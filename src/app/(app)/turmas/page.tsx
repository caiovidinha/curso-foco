import Link from "next/link";
import { salvarTurma } from "@/app/actions/pessoas";
import { BotaoSubmit, FormAcao } from "@/components/forms";
import { IconChevron, IconPlus } from "@/components/icons";
import { EmptyState, Field, PageHeader } from "@/components/ui";
import { getTurmas } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TurmasPage() {
  const turmas = await getTurmas();
  const anoAtual = new Date().getFullYear();

  return (
    <>
      <PageHeader titulo="Turmas" subtitulo="Agrupam os alunos e definem quem recebe cada simulado." />

      <FormAcao action={salvarTurma} limpar className="card mb-6 p-4">
        <div className="section-title mb-3">Nova turma</div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <Field label="Nome">
            <input className="input" name="nome" placeholder="Ex.: 3º ano A" required maxLength={60} />
          </Field>
          <Field label="Ano">
            <input
              className="input tabular"
              name="ano"
              type="number"
              inputMode="numeric"
              defaultValue={anoAtual}
              min={2000}
              max={2100}
            />
          </Field>
          <Field label="Turno">
            <select className="select" name="turno" defaultValue="">
              <option value="">—</option>
              <option value="Manhã">Manhã</option>
              <option value="Tarde">Tarde</option>
              <option value="Noite">Noite</option>
              <option value="Integral">Integral</option>
            </select>
          </Field>
          <BotaoSubmit className="btn btn-primary">
            <IconPlus width={16} height={16} />
            Criar
          </BotaoSubmit>
        </div>
      </FormAcao>

      {turmas.length === 0 ? (
        <EmptyState
          titulo="Nenhuma turma cadastrada"
          descricao="Crie a primeira turma acima para começar a cadastrar alunos."
        />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {turmas.map((t) => (
            <li key={t.id}>
              <Link
                href={`/turmas/${t.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-soft"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.nome}</div>
                  <div className="tabular mt-0.5 text-xs text-muted">
                    {[t.ano, t.turno].filter(Boolean).join(" · ") || "sem período definido"}
                  </div>
                </div>
                <span className="badge tabular">
                  {t.qtdAlunos} {t.qtdAlunos === 1 ? "aluno" : "alunos"}
                </span>
                <IconChevron width={16} height={16} className="shrink-0 text-sub" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
