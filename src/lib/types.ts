export const LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;
export type Letra = (typeof LETRAS)[number];

/** Valor especial gravado quando a leitura encontra mais de uma bolha marcada. */
export const RASURA = "X";

export type Area = {
  id: string;
  nome: string;
  ordem: number;
};

export type Materia = {
  id: string;
  area_id: string;
  nome: string;
  ordem: number;
};

export type MateriaComArea = Materia & { areas: Pick<Area, "id" | "nome" | "ordem"> | null };

export type Turma = {
  id: string;
  nome: string;
  ano: number | null;
  turno: string | null;
  created_at: string;
};

export type Aluno = {
  id: string;
  nome: string;
  codigo: number;
  matricula: string | null;
  email: string | null;
  turma_id: string | null;
  ativo: boolean;
  created_at: string;
};

export type StatusSimulado = "rascunho" | "aplicado" | "encerrado";

export type Simulado = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string | null;
  status: StatusSimulado;
  opcoes_padrao: number;
  created_at: string;
};

export type SimuladoMateria = {
  id: string;
  simulado_id: string;
  materia_id: string;
  ordem: number;
};

/**
 * `multipla`   — objetiva, entra no cartão-resposta e no % de acerto
 * `discursiva` — corrigida por nota, fora do cartão e do % de acerto
 * `redacao`    — item único com nota máxima própria (ENEM: 1000)
 */
export type TipoQuestao = "multipla" | "discursiva" | "redacao";

/** Tipos que não têm alternativas e são lançados por nota. */
export const TIPOS_POR_NOTA: TipoQuestao[] = ["discursiva", "redacao"];

export const ROTULO_TIPO: Record<TipoQuestao, string> = {
  multipla: "Múltipla escolha",
  discursiva: "Discursiva",
  redacao: "Redação",
};

export type Questao = {
  id: string;
  simulado_id: string;
  simulado_materia_id: string;
  numero: number;
  tipo: TipoQuestao;
  num_opcoes: number;
  gabarito: string | null;
  peso: number;
  enunciado_ref: string | null;
};

export type StatusProva = "pendente" | "revisar" | "corrigida" | "ausente";

export type Prova = {
  id: string;
  simulado_id: string;
  aluno_id: string;
  status: StatusProva;
  origem: "manual" | "imagem";
  imagem_path: string | null;
  observacoes: string | null;
  corrigida_em: string | null;
  created_at: string;
};

export type Resposta = {
  id: string;
  prova_id: string;
  questao_id: string;
  marcada: string | null;
  nota: number | null;
  confianca: number | null;
  revisada: boolean;
};

/** Linha da view `vw_respostas_detalhe`. */
export type RespostaDetalhe = {
  resposta_id: string;
  prova_id: string;
  marcada: string | null;
  nota: number | null;
  confianca: number | null;
  revisada: boolean;
  simulado_id: string;
  aluno_id: string;
  prova_status: StatusProva;
  aluno_nome: string;
  aluno_codigo: number;
  turma_id: string | null;
  turma_nome: string | null;
  simulado_titulo: string;
  simulado_data: string | null;
  questao_id: string;
  numero: number;
  tipo: TipoQuestao;
  gabarito: string | null;
  peso: number;
  materia_id: string;
  materia_nome: string;
  area_id: string;
  area_nome: string;
  acertou: boolean | null;
};

/** Estrutura montada para as telas de simulado: bloco de matéria + suas questões. */
export type BlocoSimulado = {
  id: string;
  ordem: number;
  materia: { id: string; nome: string };
  area: { id: string; nome: string };
  questoes: Questao[];
};
