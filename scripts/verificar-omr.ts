/**
 * Verificação ponta a ponta do leitor de cartão-resposta.
 *
 * Desenha um cartão a partir da MESMA geometria usada na impressão, preenche um
 * gabarito conhecido, simula uma foto (perspectiva de câmera na mão, sombra,
 * ruído de sensor, compressão JPEG) e confere se `lerCartao` recupera exatamente
 * o que foi marcado.
 *
 *   npm run verificar:omr
 */

import sharp from "sharp";
import { lerCartao } from "@/lib/omr/detect";
import { MARKERS, PAGE_H, PAGE_W, buildSheetLayout } from "@/lib/omr/layout";

const DPI = 150;
const PPMM = DPI / 25.4;
const W = Math.round(PAGE_W * PPMM);
const H = Math.round(PAGE_H * PPMM);

const QUESTOES = 90;
const OPCOES = 5;
const LETRAS = ["A", "B", "C", "D", "E"];
const CODIGO = 4207;

// gerador determinístico, para o teste ser reproduzível
let semente = 20260807;
const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// --- 1. desenhar o cartão preenchido ---------------------------------------

type Traco = {
  /** 1 = caneta cheia; abaixo disso simula lápis fraco / preenchimento parcial. */
  forca: number;
  /** questões que receberam duas marcas (rasura). */
  duplas: Set<number>;
};

function desenhar(marcadas: Map<number, string | null>, traco: Traco) {
  const layout = buildSheetLayout(
    Array.from({ length: QUESTOES }, (_, i) => i + 1),
    OPCOES,
    CODIGO,
  );
  const page = layout.pages[0];
  const p = (v: number) => (v * PPMM).toFixed(2);

  const partes: string[] = [`<rect width="${W}" height="${H}" fill="#fff"/>`];

  for (const m of MARKERS) {
    partes.push(
      `<rect x="${p(m.x - m.size / 2)}" y="${p(m.y - m.size / 2)}" width="${p(m.size)}" height="${p(m.size)}" fill="#000"/>`,
    );
  }

  const bolha = (x: number, y: number, r: number, cheia: boolean, forca = 1) => {
    partes.push(
      `<circle cx="${p(x)}" cy="${p(y)}" r="${p(r)}" fill="none" stroke="#000" stroke-width="${p(0.28)}"/>`,
    );
    if (cheia) {
      // caneta de verdade não preenche perfeito: raio menor e centro deslocado
      const dx = (rnd() - 0.5) * r * 0.3;
      const dy = (rnd() - 0.5) * r * 0.3;
      const tom = Math.round(17 + (1 - forca) * 150);
      partes.push(
        `<circle cx="${p(x + dx)}" cy="${p(y + dy)}" r="${p(r * (0.5 + 0.36 * forca))}" ` +
          `fill="rgb(${tom},${tom},${tom})"/>`,
      );
    }
  };

  for (const b of page.code) bolha(b.x, b.y, b.r, !!b.filled);
  for (const b of page.pageMarks) bolha(b.x, b.y, b.r, !!b.filled);
  for (const b of page.answers) {
    const escolhida = marcadas.get(b.numero) === b.opcao;
    // na rasura, marca também a alternativa seguinte
    const vizinha =
      traco.duplas.has(b.numero) &&
      LETRAS[(LETRAS.indexOf(marcadas.get(b.numero) ?? "A") + 1) % OPCOES] === b.opcao;
    bolha(b.x, b.y, b.r, escolhida || vizinha, traco.forca);
  }

  // texto impresso: exercita o filtro de candidatos a marcador
  partes.push(
    `<text x="${p(26)}" y="${p(13)}" font-family="Helvetica" font-size="${p(3.6)}" font-weight="bold">CURSO FOCO · CARTÃO-RESPOSTA</text>`,
  );
  for (const col of page.colunas) {
    col.numeros.forEach((n, i) => {
      partes.push(
        `<text x="${p(col.labelX + layout.labelW - 2)}" y="${p(74 + i * layout.rowPitch + 0.9)}" font-family="Helvetica" font-size="${p(2.4)}" text-anchor="end">${n}</text>`,
      );
    });
    LETRAS.forEach((l, i) => {
      partes.push(
        `<text x="${p(col.firstOptionX + i * layout.optionPitch)}" y="${p(69.8)}" font-family="Helvetica" font-size="${p(2.2)}" font-weight="bold" text-anchor="middle">${l}</text>`,
      );
    });
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${partes.join("")}</svg>`;
  return sharp(Buffer.from(svg)).grayscale().raw().toBuffer({ resolveWithObject: true });
}

// --- 2. simular a foto ------------------------------------------------------

function resolver(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((l, i) => [...l, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((l, i) => l[n] / M[i][i]);
}

function homografia(de: number[][], para: number[][]) {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [X, Y] = de[i];
    const [u, v] = para[i];
    A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]);
    b.push(u);
    A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]);
    b.push(v);
  }
  return resolver(A, b);
}

type Foto = {
  perspectiva: number[][] | null;
  sombra: boolean;
  ruido: number;
  qualidade: number;
  girar: 0 | 90 | 180 | 270;
};

async function fotografar(origem: Uint8Array, cfg: Foto) {
  const destino = new Uint8Array(W * H).fill(196); // mesa cinza ao redor da folha

  const quina = cfg.perspectiva ?? [
    [0, 0],
    [W - 1, 0],
    [W - 1, H - 1],
    [0, H - 1],
  ];

  // mapeia pixel do destino de volta para a folha original
  const inv = homografia(quina, [
    [0, 0],
    [W - 1, 0],
    [W - 1, H - 1],
    [0, H - 1],
  ]);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = inv[6] * x + inv[7] * y + 1;
      const sx = (inv[0] * x + inv[1] * y + inv[2]) / d;
      const sy = (inv[3] * x + inv[4] * y + inv[5]) / d;
      if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) continue;

      // bilinear
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const i = y0 * W + x0;
      const v =
        origem[i] * (1 - fx) * (1 - fy) +
        origem[i + 1] * fx * (1 - fy) +
        origem[i + W] * (1 - fx) * fy +
        origem[i + W + 1] * fx * fy;

      destino[y * W + x] = v;
    }
  }

  if (cfg.sombra) {
    // gradiente de luz + uma sombra difusa no canto inferior direito
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const rampa = 1 - 0.3 * (x / W) - 0.2 * (y / H);
        const dx = x / W - 0.8;
        const dy = y / H - 0.85;
        const blob = 1 - 0.3 * Math.exp(-(dx * dx + dy * dy) / 0.02);
        destino[y * W + x] = Math.max(0, Math.min(255, destino[y * W + x] * rampa * blob));
      }
    }
  }

  if (cfg.ruido > 0) {
    for (let i = 0; i < destino.length; i++) {
      destino[i] = Math.max(0, Math.min(255, destino[i] + (rnd() - 0.5) * cfg.ruido));
    }
  }

  let img = sharp(Buffer.from(destino), { raw: { width: W, height: H, channels: 1 } });
  if (cfg.girar) img = img.rotate(cfg.girar);
  return img.jpeg({ quality: cfg.qualidade }).toBuffer();
}

// --- 3. rodar os cenários ---------------------------------------------------

const SEM_PERSPECTIVA: Foto = {
  perspectiva: null,
  sombra: false,
  ruido: 0,
  qualidade: 92,
  girar: 0,
};

const CAMERA_NA_MAO: Foto = {
  perspectiva: [
    [W * 0.03, H * 0.02],
    [W * 0.98, H * 0.05],
    [W * 0.96, H * 0.98],
    [W * 0.02, H * 0.95],
  ],
  sombra: true,
  ruido: 10,
  qualidade: 80,
  girar: 0,
};

type Cenario = {
  nome: string;
  foto: Foto;
  traco: Traco;
  /** rasuras esperadas: questões que devem sair como 'X'. */
  duplas?: Set<number>;
};

async function main() {
  const numeros = Array.from({ length: QUESTOES }, (_, i) => i + 1);
  const layout = buildSheetLayout(numeros, OPCOES, null);

  // gabarito de referência: em branco a cada 17 questões
  const esperado = new Map<number, string | null>();
  for (const n of numeros) {
    esperado.set(n, n % 17 === 0 ? null : LETRAS[(n * 7) % OPCOES]);
  }

  const rasuradas = new Set([5, 23, 44, 71]);
  const tracoNormal: Traco = { forca: 1, duplas: new Set() };

  const cenarios: Cenario[] = [
    { nome: "escaneada (sem distorção)", foto: SEM_PERSPECTIVA, traco: tracoNormal },
    { nome: "foto com perspectiva leve + sombra", foto: CAMERA_NA_MAO, traco: tracoNormal },
    {
      nome: "foto inclinada forte + ruído + JPEG ruim",
      foto: {
        perspectiva: [
          [W * 0.09, H * 0.04],
          [W * 0.97, H * 0.12],
          [W * 0.91, H * 0.97],
          [W * 0.02, H * 0.88],
        ],
        sombra: true,
        ruido: 22,
        qualidade: 60,
        girar: 0,
      },
      traco: tracoNormal,
    },
    { nome: "folha de cabeça para baixo (180°)", foto: { ...CAMERA_NA_MAO, girar: 180 }, traco: tracoNormal },
    { nome: "folha deitada (90°)", foto: { ...CAMERA_NA_MAO, girar: 90 }, traco: tracoNormal },
    { nome: "folha deitada (270°)", foto: { ...CAMERA_NA_MAO, girar: 270 }, traco: tracoNormal },
    {
      nome: "marcação fraca a lápis",
      foto: CAMERA_NA_MAO,
      traco: { forca: 0.55, duplas: new Set() },
    },
    {
      nome: "quatro questões rasuradas (dupla marcação)",
      foto: CAMERA_NA_MAO,
      traco: { forca: 1, duplas: rasuradas },
      duplas: rasuradas,
    },
  ];

  let falhou = false;

  for (const cenario of cenarios) {
    const { data: folha } = await desenhar(esperado, cenario.traco);
    const origem = new Uint8Array(folha.buffer, folha.byteOffset, W * H);

    const jpeg = await fotografar(origem, cenario.foto);
    const inicio = Date.now();
    const r = await lerCartao({ buffer: jpeg, layout });
    const ms = Date.now() - inicio;

    if (!r.ok) {
      console.log(`✗ ${cenario.nome}\n    ${r.erro}`);
      falhou = true;
      continue;
    }

    const alvo = (n: number) => (cenario.duplas?.has(n) ? "X" : esperado.get(n) ?? null);
    const divergentes = numeros.filter((n) => {
      const lida = r.respostas.find((x) => x.numero === n)?.marcada ?? null;
      return lida !== alvo(n);
    });

    const duvidosas = r.respostas.filter((x) => x.confianca < 0.6).length;
    const codigoOk = r.codigo === CODIGO;
    const ok = divergentes.length === 0 && codigoOk;
    if (!ok) falhou = true;

    console.log(
      `${ok ? "✓" : "✗"} ${cenario.nome}\n` +
        `    código ${r.codigo ?? "—"} ${codigoOk ? "ok" : `ESPERADO ${CODIGO}`} · ` +
        `página ${r.pagina} · ${QUESTOES - divergentes.length}/${QUESTOES} corretas · ` +
        `${duvidosas} p/ revisão · ${ms} ms`,
    );

    if (divergentes.length > 0) {
      console.log(
        `    divergências: ${divergentes
          .slice(0, 12)
          .map((n) => {
            const lida = r.respostas.find((x) => x.numero === n)?.marcada;
            return `Q${n}(esperado ${alvo(n) ?? "branco"}, lido ${lida ?? "branco"})`;
          })
          .join(", ")}`,
      );
    }
  }

  console.log(falhou ? "\nAlgum cenário falhou." : "\nTodos os cenários passaram.");
  process.exit(falhou ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
