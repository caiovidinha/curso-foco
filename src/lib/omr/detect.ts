/**
 * Leitura óptica do cartão-resposta (OMR).
 *
 * Pipeline:
 *   1. normaliza a foto (auto-rotação por EXIF, escala de cinza, redimensiona)
 *   2. binariza com limiar adaptativo (imagem integral) — tolera iluminação irregular
 *   3. acha os 4 marcadores de canto por componentes conexos
 *   4. resolve a homografia folha(mm) → foto(px), corrigindo perspectiva e rotação
 *   5. amostra cada bolha e decide a marcação com um score de confiança
 *   6. devolve um recorte retificado com as leituras desenhadas, para conferência
 */

import sharp from "sharp";
import { RASURA } from "@/lib/types";
import {
  MARKERS,
  PAGE_H,
  PAGE_W,
  type Bubble,
  type SheetLayout,
} from "./layout";

// --- parâmetros de decisão -------------------------------------------------

/** Fração mínima de pixels escuros para considerar a bolha preenchida. */
const FILL_MIN = 0.42;
/** Se a 2ª bolha mais escura passa desta fração da 1ª, a leitura é ambígua. */
const AMBIGUO = 0.72;
/** Abaixo desta confiança a prova é marcada para revisão manual. */
export const CONF_REVISAO = 0.6;
/** Raio de amostragem, como fração do raio impresso (evita o contorno da bolha). */
const SAMPLE_R = 0.66;

const MAX_DIM = 1600;
const PREVIEW_PX_PER_MM = 3.4;

// --- tipos -----------------------------------------------------------------

export type LeituraQuestao = {
  numero: number;
  marcada: string | null;
  confianca: number;
  fills: number[];
};

export type OmrResult = {
  ok: true;
  codigo: number | null;
  codigoConfianca: number;
  pagina: number | null;
  respostas: LeituraQuestao[];
  avisos: string[];
  precisaRevisao: boolean;
  preview: string;
};

export type OmrFalha = { ok: false; erro: string; avisos: string[] };

type Gray = { data: Uint8Array; w: number; h: number };

type Componente = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  cx: number;
  cy: number;
};

// --- 1. normalização -------------------------------------------------------

async function carregar(buffer: Buffer): Promise<Gray> {
  const { data, info } = await sharp(buffer)
    .rotate()
    .grayscale()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data: new Uint8Array(data.buffer, data.byteOffset, info.width * info.height), w: info.width, h: info.height };
}

// --- 2. limiar adaptativo --------------------------------------------------

/**
 * Binariza comparando cada pixel à média de uma janela grande ao seu redor.
 * A janela precisa ser bem maior que um marcador, senão o interior de uma área
 * sólida vira branco (a média local se iguala ao próprio pixel).
 */
function binarizar(g: Gray): Uint8Array {
  const { data, w, h } = g;
  const integral = new Float64Array((w + 1) * (h + 1));

  for (let y = 0; y < h; y++) {
    let linha = 0;
    for (let x = 0; x < w; x++) {
      linha += data[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + linha;
    }
  }

  const raio = Math.max(8, Math.round(Math.min(w, h) / 12));
  const bin = new Uint8Array(w * h);
  const C = 10;

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - raio);
    const y1 = Math.min(h - 1, y + raio);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - raio);
      const x1 = Math.min(w - 1, x + raio);
      const soma =
        integral[(y1 + 1) * (w + 1) + (x1 + 1)] -
        integral[y0 * (w + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0];
      const media = soma / ((x1 - x0 + 1) * (y1 - y0 + 1));
      bin[y * w + x] = data[y * w + x] < media - C ? 1 : 0;
    }
  }

  return bin;
}

// --- 3. componentes conexos e marcadores -----------------------------------

function componentes(bin: Uint8Array, w: number, h: number, minArea: number, maxArea: number): Componente[] {
  const visto = new Uint8Array(w * h);
  const fila = new Int32Array(w * h);
  const out: Componente[] = [];

  for (let i = 0; i < w * h; i++) {
    if (bin[i] === 0 || visto[i]) continue;

    let cabeca = 0;
    let cauda = 0;
    fila[cauda++] = i;
    visto[i] = 1;

    let minX = w, minY = h, maxX = 0, maxY = 0, area = 0, somaX = 0, somaY = 0;

    while (cabeca < cauda) {
      const p = fila[cabeca++];
      const px = p % w;
      const py = (p - px) / w;

      area++;
      somaX += px;
      somaY += py;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      if (px > 0 && bin[p - 1] && !visto[p - 1]) { visto[p - 1] = 1; fila[cauda++] = p - 1; }
      if (px < w - 1 && bin[p + 1] && !visto[p + 1]) { visto[p + 1] = 1; fila[cauda++] = p + 1; }
      if (py > 0 && bin[p - w] && !visto[p - w]) { visto[p - w] = 1; fila[cauda++] = p - w; }
      if (py < h - 1 && bin[p + w] && !visto[p + w]) { visto[p + w] = 1; fila[cauda++] = p + w; }
    }

    if (area < minArea || area > maxArea) continue;
    out.push({ minX, minY, maxX, maxY, area, cx: somaX / area, cy: somaY / area });
  }

  return out;
}

function acharMarcadores(bin: Uint8Array, w: number, h: number): Componente[] | null {
  const maxDim = Math.max(w, h);
  const ladoMin = maxDim * 0.008;
  const ladoMax = maxDim * 0.08;

  const candidatos = componentes(bin, w, h, ladoMin * ladoMin * 0.4, ladoMax * ladoMax).filter((c) => {
    const cw = c.maxX - c.minX + 1;
    const ch = c.maxY - c.minY + 1;
    if (cw < ladoMin || ch < ladoMin || cw > ladoMax || ch > ladoMax) return false;
    const proporcao = cw / ch;
    if (proporcao < 0.6 || proporcao > 1.65) return false;
    // marcador é um quadrado sólido: quase todo o bbox é escuro
    return c.area / (cw * ch) >= 0.62;
  });

  if (candidatos.length < 4) return null;

  // cantos extremos: TL minimiza x+y, BR maximiza x+y, TR maximiza x-y, BL minimiza x-y
  const porSoma = [...candidatos].sort((a, b) => a.cx + a.cy - (b.cx + b.cy));
  const porDif = [...candidatos].sort((a, b) => a.cx - a.cy - (b.cx - b.cy));

  const quinas = [porSoma[0], porDif[porDif.length - 1], porSoma[porSoma.length - 1], porDif[0]];
  if (new Set(quinas).size !== 4) return null;

  // distância mínima plausível entre marcadores adjacentes
  const minDist = maxDim * 0.2;
  for (let i = 0; i < 4; i++) {
    const a = quinas[i];
    const b = quinas[(i + 1) % 4];
    if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < minDist) return null;
  }

  // o marcador maior é o superior-esquerdo: rotaciona a lista até alinhar
  let maior = 0;
  for (let i = 1; i < 4; i++) if (quinas[i].area > quinas[maior].area) maior = i;

  return [0, 1, 2, 3].map((i) => quinas[(maior + i) % 4]);
}

// --- 4. homografia ---------------------------------------------------------

type Homografia = number[]; // [h0..h7], h8 = 1

function resolver(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((linha, i) => [...linha, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivo = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivo][col])) pivo = r;
    if (Math.abs(M[pivo][col]) < 1e-10) return null;
    [M[col], M[pivo]] = [M[pivo], M[col]];

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }

  return M.map((linha, i) => linha[n] / M[i][i]);
}

function homografia(de: { x: number; y: number }[], para: { x: number; y: number }[]): Homografia | null {
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x: X, y: Y } = de[i];
    const { x: u, y: v } = para[i];
    A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]);
    b.push(u);
    A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]);
    b.push(v);
  }

  return resolver(A, b);
}

function aplicar(H: Homografia, x: number, y: number): { x: number; y: number } {
  const d = H[6] * x + H[7] * y + 1;
  return { x: (H[0] * x + H[1] * y + H[2]) / d, y: (H[3] * x + H[4] * y + H[5]) / d };
}

// --- 5. amostragem das bolhas ---------------------------------------------

function amostrar(bin: Uint8Array, w: number, h: number, H: Homografia, b: Bubble): number {
  const centro = aplicar(H, b.x, b.y);
  const dx = aplicar(H, b.x + b.r, b.y);
  const dy = aplicar(H, b.x, b.y + b.r);
  const raio =
    (Math.hypot(dx.x - centro.x, dx.y - centro.y) + Math.hypot(dy.x - centro.x, dy.y - centro.y)) / 2;

  const rAmostra = Math.max(1.5, raio * SAMPLE_R);
  const x0 = Math.max(0, Math.floor(centro.x - rAmostra));
  const x1 = Math.min(w - 1, Math.ceil(centro.x + rAmostra));
  const y0 = Math.max(0, Math.floor(centro.y - rAmostra));
  const y1 = Math.min(h - 1, Math.ceil(centro.y + rAmostra));

  let escuros = 0;
  let total = 0;
  const r2 = rAmostra * rAmostra;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d2 = (x - centro.x) ** 2 + (y - centro.y) ** 2;
      if (d2 > r2) continue;
      total++;
      escuros += bin[y * w + x];
    }
  }

  return total === 0 ? 0 : escuros / total;
}

function decidir(fills: number[], letras: string[]): { marcada: string | null; confianca: number } {
  let i1 = 0;
  for (let i = 1; i < fills.length; i++) if (fills[i] > fills[i1]) i1 = i;
  const max1 = fills[i1];

  let max2 = 0;
  for (let i = 0; i < fills.length; i++) if (i !== i1 && fills[i] > max2) max2 = fills[i];

  if (max1 < FILL_MIN) {
    // em branco: confiança alta quando está bem longe do limiar
    const folga = (FILL_MIN - max1) / FILL_MIN;
    return { marcada: null, confianca: Math.min(1, 0.4 + folga) };
  }

  if (max2 > max1 * AMBIGUO) {
    return { marcada: RASURA, confianca: 0.15 };
  }

  const separacao = (max1 - max2) / Math.max(0.15, max1);
  const intensidade = Math.min(1, max1 / 0.65);
  return { marcada: letras[i1], confianca: Math.max(0, Math.min(1, separacao * intensidade)) };
}

// --- 6. preview retificado -------------------------------------------------

async function gerarPreview(
  g: Gray,
  H: Homografia,
  marcas: { x: number; y: number; r: number; tipo: "lida" | "vazia" }[],
): Promise<string> {
  const W = Math.round(PAGE_W * PREVIEW_PX_PER_MM);
  const Hgt = Math.round(PAGE_H * PREVIEW_PX_PER_MM);
  const out = new Uint8Array(W * Hgt).fill(255);

  for (let py = 0; py < Hgt; py++) {
    const mmY = py / PREVIEW_PX_PER_MM;
    for (let px = 0; px < W; px++) {
      const mmX = px / PREVIEW_PX_PER_MM;
      const s = aplicar(H, mmX, mmY);
      const sx = Math.round(s.x);
      const sy = Math.round(s.y);
      if (sx < 0 || sy < 0 || sx >= g.w || sy >= g.h) continue;
      out[py * W + px] = g.data[sy * g.w + sx];
    }
  }

  const base = await sharp(Buffer.from(out), { raw: { width: W, height: Hgt, channels: 1 } })
    .png()
    .toBuffer();

  const circulos = marcas
    .map((m) => {
      const cx = (m.x * PREVIEW_PX_PER_MM).toFixed(1);
      const cy = (m.y * PREVIEW_PX_PER_MM).toFixed(1);
      const r = (m.r * PREVIEW_PX_PER_MM * 1.35).toFixed(1);
      return m.tipo === "lida"
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-width="2.4"/>` +
            `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="1"/>`
        : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#888" stroke-width="0.6" stroke-dasharray="2 2"/>`;
    })
    .join("");

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hgt}">${circulos}</svg>`,
  );

  const composto = await sharp(base)
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 72 })
    .toBuffer();

  return `data:image/jpeg;base64,${composto.toString("base64")}`;
}

// --- API -------------------------------------------------------------------

export type LerCartaoParams = {
  buffer: Buffer;
  layout: SheetLayout;
  /** Página esperada; se omitida, usa a detectada nas bolhas de página. */
  pagina?: number;
  /** Número de alternativas por questão (padrão: `layout.numOpcoes`). */
  opcoesPorQuestao?: Record<number, number>;
};

export async function lerCartao(params: LerCartaoParams): Promise<OmrResult | OmrFalha> {
  const avisos: string[] = [];
  const g = await carregar(params.buffer);
  const bin = binarizar(g);

  const marcadores = acharMarcadores(bin, g.w, g.h);
  if (!marcadores) {
    return {
      ok: false,
      erro:
        "Não encontrei os 4 marcadores pretos dos cantos. Fotografe a folha inteira, bem iluminada e sem sombras sobre as quinas.",
      avisos,
    };
  }

  const H = homografia(
    MARKERS.map((m) => ({ x: m.x, y: m.y })),
    marcadores.map((c) => ({ x: c.cx, y: c.cy })),
  );

  if (!H) {
    return { ok: false, erro: "Não consegui alinhar a folha (marcadores em posição degenerada).", avisos };
  }

  // página: bolha pré-preenchida pelo gerador do cartão
  const pageBubbles = params.layout.pages[0]?.pageMarks ?? [];
  const pageFills = pageBubbles.map((b) => amostrar(bin, g.w, g.h, H, b));
  let paginaDetectada: number | null = null;
  if (pageFills.length > 0) {
    const idx = pageFills.indexOf(Math.max(...pageFills));
    if (pageFills[idx] >= FILL_MIN) paginaDetectada = pageBubbles[idx].pagina;
  }

  const pagina = params.pagina ?? paginaDetectada ?? 1;
  const page = params.layout.pages[pagina - 1];
  if (!page) {
    return { ok: false, erro: `A página ${pagina} não existe neste cartão.`, avisos };
  }
  if (params.pagina && paginaDetectada && params.pagina !== paginaDetectada) {
    avisos.push(`A folha parece ser a página ${paginaDetectada}, mas foi enviada como página ${params.pagina}.`);
  }

  // código do aluno
  const digitos: number[] = [];
  let codigoConfianca = 1;
  for (let d = 0; d < 4; d++) {
    const bolhas = page.code.filter((b) => b.digitIndex === d).sort((a, b) => a.value - b.value);
    const fills = bolhas.map((b) => amostrar(bin, g.w, g.h, H, b));
    const { marcada, confianca } = decidir(fills, bolhas.map((b) => String(b.value)));
    codigoConfianca = Math.min(codigoConfianca, confianca);
    if (marcada === null || marcada === RASURA) {
      digitos.length = 0;
      break;
    }
    digitos.push(Number(marcada));
  }

  const codigo = digitos.length === 4 ? Number(digitos.join("")) : null;
  if (codigo === null) {
    avisos.push("Não consegui ler o código do aluno — selecione o aluno manualmente.");
    codigoConfianca = 0;
  }

  // respostas
  const porNumero = new Map<number, typeof page.answers>();
  for (const b of page.answers) {
    const lista = porNumero.get(b.numero) ?? [];
    lista.push(b);
    porNumero.set(b.numero, lista);
  }

  const respostas: LeituraQuestao[] = [];
  const marcasPreview: { x: number; y: number; r: number; tipo: "lida" | "vazia" }[] = [];
  let baixaConfianca = 0;

  for (const [numero, bolhas] of [...porNumero.entries()].sort((a, b) => a[0] - b[0])) {
    const ordenadas = bolhas.sort((a, b) => a.opcaoIndex - b.opcaoIndex);
    const limite = params.opcoesPorQuestao?.[numero] ?? params.layout.numOpcoes;
    const usadas = ordenadas.slice(0, Math.max(2, Math.min(ordenadas.length, limite)));

    const fills = usadas.map((b) => amostrar(bin, g.w, g.h, H, b));
    const { marcada, confianca } = decidir(fills, usadas.map((b) => b.opcao));

    respostas.push({ numero, marcada, confianca, fills: fills.map((f) => Number(f.toFixed(3))) });
    if (confianca < CONF_REVISAO) baixaConfianca++;

    usadas.forEach((b, i) => {
      const lida = marcada !== null && marcada !== RASURA && b.opcao === marcada;
      const rasurada = marcada === RASURA && fills[i] >= FILL_MIN;
      if (lida || rasurada) marcasPreview.push({ x: b.x, y: b.y, r: b.r, tipo: "lida" });
    });
  }

  if (baixaConfianca > 0) {
    avisos.push(`${baixaConfianca} questão(ões) com leitura duvidosa — confira antes de salvar.`);
  }

  const preview = await gerarPreview(g, H, marcasPreview);

  return {
    ok: true,
    codigo,
    codigoConfianca,
    pagina,
    respostas,
    avisos,
    precisaRevisao: baixaConfianca > 0 || codigo === null,
    preview,
  };
}
