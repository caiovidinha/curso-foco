const MAIOR_NUMERO = 9999;
const MAXIMO_QUESTOES_POR_BLOCO = 300;

export type ResultadoNumeracao =
  | { ok: true; numeros: number[] }
  | { ok: false; erro: string };

/**
 * Lê números avulsos e intervalos, separados por vírgula, espaço ou quebra de
 * linha. Exemplos válidos: `49, 61-63, 69` e uma lista vertical copiada de um
 * documento.
 */
export function analisarNumerosQuestoes(texto: string): ResultadoNumeracao {
  const entrada = texto
    .trim()
    .replace(/[–—−]/g, "-")
    .replace(/(\d)\s*-\s*(\d)/g, "$1-$2");

  if (!entrada) {
    return { ok: false, erro: "Informe os números das questões." };
  }

  const tokens = entrada.split(/[\s,;]+/).filter(Boolean);
  const numeros: number[] = [];
  const vistos = new Set<number>();

  function adicionar(numero: number): ResultadoNumeracao | null {
    if (!Number.isSafeInteger(numero) || numero < 1 || numero > MAIOR_NUMERO) {
      return {
        ok: false,
        erro: `Use números de questão entre 1 e ${MAIOR_NUMERO}.`,
      };
    }
    if (vistos.has(numero)) {
      return { ok: false, erro: `A questão ${numero} foi informada mais de uma vez.` };
    }
    if (numeros.length >= MAXIMO_QUESTOES_POR_BLOCO) {
      return {
        ok: false,
        erro: `Um bloco pode ter no máximo ${MAXIMO_QUESTOES_POR_BLOCO} questões.`,
      };
    }

    vistos.add(numero);
    numeros.push(numero);
    return null;
  }

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      const erro = adicionar(Number(token));
      if (erro) return erro;
      continue;
    }

    const intervalo = /^(\d+)-(\d+)$/.exec(token);
    if (!intervalo) {
      return {
        ok: false,
        erro: `Não entendi “${token}”. Separe os números por vírgula ou use um intervalo como 61-63.`,
      };
    }

    const inicio = Number(intervalo[1]);
    const fim = Number(intervalo[2]);
    if (fim < inicio) {
      return {
        ok: false,
        erro: `O intervalo ${token} está invertido. Use ${fim}-${inicio}.`,
      };
    }

    for (let numero = inicio; numero <= fim; numero++) {
      const erro = adicionar(numero);
      if (erro) return erro;
    }
  }

  return { ok: true, numeros: numeros.sort((a, b) => a - b) };
}

/** Exibe listas longas de forma compacta: `[46, 47, 48, 51]` → `46–48, 51`. */
export function formatarNumerosQuestoes(numeros: number[]): string {
  const ordenados = [...new Set(numeros)].sort((a, b) => a - b);
  const partes: string[] = [];

  for (let i = 0; i < ordenados.length; i++) {
    const inicio = ordenados[i];
    let fim = inicio;

    while (i + 1 < ordenados.length && ordenados[i + 1] === fim + 1) {
      fim = ordenados[++i];
    }

    partes.push(inicio === fim ? String(inicio) : `${inicio}–${fim}`);
  }

  return partes.join(", ");
}
