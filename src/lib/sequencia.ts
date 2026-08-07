import { RASURA } from "./types";

/** Letra da alternativa, `RASURA` ou `null` para questão em branco. */
export type Token = string | null;

/**
 * Marcas de questão em branco. Deliberadamente curto: `.` e `/` ficaram de fora
 * porque aparecem como pontuação em listas coladas, e aí deslocariam tudo o que
 * vem depois — um erro silencioso e caro numa correção.
 */
const BRANCOS = new Set(["-", "_"]);

/**
 * Lê uma sequência digitada e devolve um token por questão, na ordem.
 *
 * Tudo que não for reconhecido (espaço, vírgula, ponto, número, quebra de linha)
 * é ignorado, então funciona tanto com "ABCDE ABCDE" quanto com uma lista
 * numerada colada de outro lugar.
 *
 * @param permitirRasura aceita `X` como dupla marcação (correção de aluno);
 *                       no gabarito não faz sentido, e o `X` é descartado
 */
export function analisarSequencia(texto: string, permitirRasura: boolean): Token[] {
  const tokens: Token[] = [];

  for (const bruto of texto.toUpperCase()) {
    if (bruto >= "A" && bruto <= "J") tokens.push(bruto);
    else if (permitirRasura && bruto === RASURA) tokens.push(RASURA);
    else if (BRANCOS.has(bruto)) tokens.push(null);
  }

  return tokens;
}
