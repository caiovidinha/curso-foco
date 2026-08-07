/**
 * Geometria do cartão-resposta, em milímetros sobre uma folha A4 retrato.
 *
 * Este módulo é a ÚNICA fonte de verdade da posição de cada bolha: a página de
 * impressão desenha a partir daqui e o leitor óptico amostra a partir daqui.
 * Alterar qualquer constante muda os dois lados em conjunto.
 */

import { LETRAS } from "@/lib/types";

export const PAGE_W = 210;
export const PAGE_H = 297;

/** Marcadores de canto. O superior-esquerdo é maior — é a âncora de orientação. */
export const MARKERS = [
  { key: "TL", x: 16, y: 16, size: 10 },
  { key: "TR", x: 194, y: 16, size: 7 },
  { key: "BR", x: 194, y: 287, size: 7 },
  { key: "BL", x: 16, y: 287, size: 7 },
] as const;

export type MarkerKey = (typeof MARKERS)[number]["key"];

export const BUBBLE_R = 2.2;

/** Grade do código do aluno: 4 linhas (dígitos) × 10 colunas (valores 0–9). */
const CODE = {
  left: 32,
  top: 40,
  rowPitch: 6,
  colPitch: 6.4,
  digits: 4,
};

/** Bolhas do número da página, impressas já preenchidas. */
const PAGEMARK = {
  left: 150,
  top: 40,
  colPitch: 6.4,
  max: 4,
};

/** Área das respostas. */
const GRID = {
  left: 14,
  right: 196,
  top: 74,
  bottom: 280,
  rowPitch: 5.4,
  optionPitch: 5.6,
  labelW: 9,
  blockGap: 2,
};

export type Bubble = { x: number; y: number; r: number; filled?: boolean };

export type AnswerBubble = Bubble & {
  numero: number;
  opcao: string;
  opcaoIndex: number;
};

export type CodeBubble = Bubble & { digitIndex: number; value: number };
export type PageBubble = Bubble & { pagina: number };

export type ColunaBloco = {
  /** x do rótulo do número da questão. */
  labelX: number;
  /** x do centro da primeira bolha. */
  firstOptionX: number;
  numeros: number[];
};

export type SheetPage = {
  pagina: number;
  code: CodeBubble[];
  pageMarks: PageBubble[];
  answers: AnswerBubble[];
  colunas: ColunaBloco[];
};

export type SheetLayout = {
  numOpcoes: number;
  letras: string[];
  numeros: number[];
  rowPitch: number;
  optionPitch: number;
  labelW: number;
  blockW: number;
  linhas: number;
  colunasPorPagina: number;
  porPagina: number;
  pages: SheetPage[];
};

function codeBubbles(codigo: number | null): CodeBubble[] {
  const digitos = codigo === null ? null : String(Math.max(0, Math.min(9999, codigo))).padStart(4, "0");
  const out: CodeBubble[] = [];
  for (let d = 0; d < CODE.digits; d++) {
    for (let v = 0; v <= 9; v++) {
      out.push({
        digitIndex: d,
        value: v,
        x: CODE.left + v * CODE.colPitch,
        y: CODE.top + d * CODE.rowPitch,
        r: BUBBLE_R,
        filled: digitos !== null && Number(digitos[d]) === v,
      });
    }
  }
  return out;
}

function pageBubbles(pagina: number, totalPaginas: number): PageBubble[] {
  const out: PageBubble[] = [];
  const total = Math.max(1, Math.min(PAGEMARK.max, totalPaginas));
  for (let p = 1; p <= total; p++) {
    out.push({
      pagina: p,
      x: PAGEMARK.left + (p - 1) * PAGEMARK.colPitch,
      y: PAGEMARK.top,
      r: BUBBLE_R,
      filled: p === pagina,
    });
  }
  return out;
}

/**
 * Monta a geometria completa do cartão.
 *
 * @param numeros  números das questões de múltipla escolha, em ordem crescente
 * @param numOpcoes  maior quantidade de alternativas do simulado (2–10)
 * @param codigo  código do aluno a pré-preencher, ou `null` para cartão em branco
 */
export function buildSheetLayout(
  numeros: number[],
  numOpcoes: number,
  codigo: number | null = null,
): SheetLayout {
  const opcoes = Math.max(2, Math.min(LETRAS.length, Math.round(numOpcoes)));
  const letras = LETRAS.slice(0, opcoes) as unknown as string[];

  const blockW = GRID.labelW + opcoes * GRID.optionPitch + GRID.blockGap;
  const largura = GRID.right - GRID.left;
  const colunasPorPagina = Math.max(1, Math.floor(largura / blockW));
  const linhas = Math.max(1, Math.floor((GRID.bottom - GRID.top) / GRID.rowPitch) + 1);
  const porPagina = colunasPorPagina * linhas;

  const totalPaginas = Math.max(1, Math.ceil(numeros.length / porPagina) || 1);
  const pages: SheetPage[] = [];

  for (let p = 1; p <= totalPaginas; p++) {
    const fatia = numeros.slice((p - 1) * porPagina, p * porPagina);
    const answers: AnswerBubble[] = [];
    const colunas: ColunaBloco[] = [];

    for (let c = 0; c < colunasPorPagina; c++) {
      const daColuna = fatia.slice(c * linhas, (c + 1) * linhas);
      if (daColuna.length === 0) break;

      const labelX = GRID.left + c * blockW;
      const firstOptionX = labelX + GRID.labelW + GRID.optionPitch / 2;
      colunas.push({ labelX, firstOptionX, numeros: daColuna });

      daColuna.forEach((numero, r) => {
        const y = GRID.top + r * GRID.rowPitch;
        for (let o = 0; o < opcoes; o++) {
          answers.push({
            numero,
            opcao: letras[o],
            opcaoIndex: o,
            x: firstOptionX + o * GRID.optionPitch,
            y,
            r: BUBBLE_R,
          });
        }
      });
    }

    pages.push({
      pagina: p,
      code: codeBubbles(codigo),
      pageMarks: pageBubbles(p, totalPaginas),
      answers,
      colunas,
    });
  }

  return {
    numOpcoes: opcoes,
    letras,
    numeros,
    rowPitch: GRID.rowPitch,
    optionPitch: GRID.optionPitch,
    labelW: GRID.labelW,
    blockW,
    linhas,
    colunasPorPagina,
    porPagina,
    pages,
  };
}

export const GRID_GEOMETRY = GRID;
export const CODE_GEOMETRY = CODE;
