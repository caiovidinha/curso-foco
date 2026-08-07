import type { RespostaDetalhe } from "./types";

export type Agregado = {
  chave: string;
  rotulo: string;
  total: number;
  acertos: number;
  erros: number;
  brancos: number;
  percentual: number;
};

/** Só questões objetivas entram no cálculo de percentual de acerto. */
export function objetivas(linhas: RespostaDetalhe[]) {
  return linhas.filter((l) => l.tipo === "multipla");
}

export function agregar(
  linhas: RespostaDetalhe[],
  chave: (l: RespostaDetalhe) => string,
  rotulo: (l: RespostaDetalhe) => string,
): Agregado[] {
  const mapa = new Map<string, Agregado>();

  for (const l of objetivas(linhas)) {
    const k = chave(l);
    let a = mapa.get(k);
    if (!a) {
      a = { chave: k, rotulo: rotulo(l), total: 0, acertos: 0, erros: 0, brancos: 0, percentual: 0 };
      mapa.set(k, a);
    }
    a.total++;
    if (l.acertou) a.acertos++;
    else if (l.marcada === null) a.brancos++;
    else a.erros++;
  }

  for (const a of mapa.values()) {
    a.percentual = a.total === 0 ? 0 : (a.acertos / a.total) * 100;
  }

  return [...mapa.values()];
}

export function porMateria(linhas: RespostaDetalhe[]) {
  return agregar(linhas, (l) => l.materia_id, (l) => l.materia_nome).sort(
    (a, b) => b.percentual - a.percentual,
  );
}

export function porArea(linhas: RespostaDetalhe[]) {
  return agregar(linhas, (l) => l.area_id, (l) => l.area_nome).sort((a, b) =>
    a.rotulo.localeCompare(b.rotulo, "pt-BR"),
  );
}

export function porAluno(linhas: RespostaDetalhe[]) {
  return agregar(linhas, (l) => l.aluno_id, (l) => l.aluno_nome).sort(
    (a, b) => b.percentual - a.percentual,
  );
}

export function porTurma(linhas: RespostaDetalhe[]) {
  return agregar(
    linhas.filter((l) => l.turma_id),
    (l) => l.turma_id!,
    (l) => l.turma_nome ?? "Sem turma",
  ).sort((a, b) => b.percentual - a.percentual);
}

export function porSimulado(linhas: RespostaDetalhe[]) {
  return agregar(linhas, (l) => l.simulado_id, (l) => l.simulado_titulo).sort((a, b) => {
    const da = linhas.find((l) => l.simulado_id === a.chave)?.simulado_data ?? "";
    const db = linhas.find((l) => l.simulado_id === b.chave)?.simulado_data ?? "";
    return da.localeCompare(db);
  });
}

export function resumo(linhas: RespostaDetalhe[]) {
  const obj = objetivas(linhas);
  const acertos = obj.filter((l) => l.acertou).length;
  const brancos = obj.filter((l) => l.marcada === null).length;
  return {
    total: obj.length,
    acertos,
    erros: obj.length - acertos - brancos,
    brancos,
    percentual: obj.length === 0 ? 0 : (acertos / obj.length) * 100,
  };
}

/** Índice de dificuldade por questão: % de acerto entre todos que responderam. */
export function dificuldadePorQuestao(linhas: RespostaDetalhe[]) {
  return agregar(linhas, (l) => l.questao_id, (l) => String(l.numero))
    .map((a) => ({ ...a, numero: Number(a.rotulo) }))
    .sort((a, b) => a.numero - b.numero);
}

export const fmtPct = (n: number) => `${n.toFixed(n >= 99.95 || n === 0 ? 0 : 1)}%`;

export const fmtData = (iso: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "—";
