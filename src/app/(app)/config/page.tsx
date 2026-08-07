import { criarArea, criarMateria, excluirArea, excluirMateria } from "@/app/actions/catalogo";
import { BotaoAcao, BotaoSubmit, FormAcao } from "@/components/forms";
import { IconPlus, IconTrash } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCatalogo } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const areas = await getCatalogo();

  return (
    <>
      <PageHeader
        titulo="Matérias"
        subtitulo="Áreas de conhecimento e suas matérias. É esta lista que alimenta os blocos de cada simulado."
      />

      <FormAcao action={criarArea} limpar className="card mb-6 p-4">
        <div className="section-title mb-3">Nova área</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input"
            name="nome"
            placeholder="Ex.: Ciências da Natureza"
            required
            maxLength={80}
          />
          <BotaoSubmit className="btn btn-primary shrink-0">
            <IconPlus width={16} height={16} />
            Adicionar área
          </BotaoSubmit>
        </div>
      </FormAcao>

      {areas.length === 0 ? (
        <EmptyState
          titulo="Nenhuma área cadastrada"
          descricao="Comece criando uma área (ex.: Ciências da Natureza) e depois adicione as matérias dela."
        />
      ) : (
        <div className="space-y-4">
          {areas.map((area) => (
            <section key={area.id} className="card overflow-hidden">
              <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{area.nome}</h2>
                  <p className="text-xs text-muted">
                    {area.materias.length} {area.materias.length === 1 ? "matéria" : "matérias"}
                  </p>
                </div>
                <BotaoAcao
                  action={excluirArea}
                  campos={{ id: area.id }}
                  confirmar={`Excluir a área "${area.nome}" e todas as suas matérias?`}
                  title="Excluir área"
                >
                  <IconTrash width={15} height={15} />
                </BotaoAcao>
              </header>

              {area.materias.length > 0 && (
                <ul className="divide-y divide-line">
                  {area.materias.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="truncate text-sm">{m.nome}</span>
                      <BotaoAcao
                        action={excluirMateria}
                        campos={{ id: m.id }}
                        confirmar={`Excluir a matéria "${m.nome}"?`}
                        title="Excluir matéria"
                      >
                        <IconTrash width={14} height={14} />
                      </BotaoAcao>
                    </li>
                  ))}
                </ul>
              )}

              <FormAcao action={criarMateria} limpar className="border-t border-line bg-soft px-4 py-3">
                <input type="hidden" name="area_id" value={area.id} />
                <div className="flex gap-2">
                  <input
                    className="input"
                    name="nome"
                    placeholder="Nova matéria (ex.: Química)"
                    required
                    maxLength={80}
                  />
                  <BotaoSubmit className="btn btn-outline shrink-0" pendente="…">
                    <IconPlus width={16} height={16} />
                    <span className="hidden sm:inline">Adicionar</span>
                  </BotaoSubmit>
                </div>
              </FormAcao>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
