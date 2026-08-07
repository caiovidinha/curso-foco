import { criarSimulado } from "@/app/actions/simulados";
import { BotaoSubmit } from "@/components/forms";
import { Field, PageHeader } from "@/components/ui";

export default function NovoSimuladoPage() {
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        titulo="Novo simulado"
        voltar="/simulados"
        subtitulo="Depois de criar, você monta os blocos de matérias e a quantidade de questões."
      />

      <form action={criarSimulado} className="card max-w-2xl space-y-4 p-5">
        <Field label="Título">
          <input
            className="input"
            name="titulo"
            required
            maxLength={120}
            placeholder="Ex.: Simulado ENEM · 1ª aplicação"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data de aplicação">
            <input className="input tabular" name="data" type="date" defaultValue={hoje} />
          </Field>

          <Field
            label="Alternativas por questão"
            hint="Padrão para os novos blocos — dá para mudar bloco a bloco."
          >
            <select className="select" name="opcoes_padrao" defaultValue="5">
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} alternativas (A–{String.fromCharCode(64 + n)})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Descrição">
          <textarea
            className="textarea"
            name="descricao"
            rows={3}
            maxLength={500}
            placeholder="Observações internas sobre a aplicação (opcional)"
          />
        </Field>

        <BotaoSubmit className="btn btn-primary w-full sm:w-auto" pendente="Criando…">
          Criar simulado
        </BotaoSubmit>
      </form>
    </>
  );
}
