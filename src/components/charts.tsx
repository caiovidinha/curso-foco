"use client";

/**
 * Gráficos do sistema — monocromáticos por decisão de marca.
 *
 * Sem matiz disponível, a identidade de série nunca pode depender de cor: cada
 * gráfico ou tem uma série só (a tinta carrega magnitude), ou distingue as séries
 * por traço (cheio × tracejado) somado a legenda e rótulo direto. Toda tabela
 * equivalente existe na própria página, então nenhum dado fica preso no desenho.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const INK = "var(--ink)";
const LINE = "var(--line)";
const MUTED = "var(--muted)";
const PAPER = "var(--paper)";

const eixo = {
  stroke: "transparent",
  tick: { fill: MUTED, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

type Ponto = { rotulo: string; valor: number; extra?: string };

function Caixa({
  titulo,
  itens,
}: {
  titulo: string;
  itens: { rotulo: string; valor: string }[];
}) {
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium">{titulo}</div>
      {itens.map((i) => (
        <div key={i.rotulo} className="tabular flex items-center justify-between gap-4 text-muted">
          <span>{i.rotulo}</span>
          <span className="font-medium text-ink">{i.valor}</span>
        </div>
      ))}
    </div>
  );
}

/** Barras horizontais de percentual — uma série, ordenada por magnitude. */
export function GraficoBarras({
  dados,
  altura,
  maxRotulo = 120,
}: {
  dados: Ponto[];
  altura?: number;
  maxRotulo?: number;
}) {
  if (dados.length === 0) return null;
  const h = altura ?? Math.max(120, dados.length * 38 + 16);

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={LINE} strokeDasharray="" />
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="rotulo"
          width={maxRotulo}
          {...eixo}
          tick={{ fill: MUTED, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "var(--soft)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <Caixa
                titulo={String(payload[0].payload.rotulo)}
                itens={[
                  { rotulo: "Acerto", valor: `${Number(payload[0].value).toFixed(1)}%` },
                  ...(payload[0].payload.extra
                    ? [{ rotulo: "Questões", valor: String(payload[0].payload.extra) }]
                    : []),
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="valor" fill={INK} barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="valor"
            position="right"
            offset={8}
            formatter={(v) => `${Number(v ?? 0).toFixed(0)}%`}
            style={{ fill: MUTED, fontSize: 11, fontVariantNumeric: "tabular-nums" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Colunas por questão — destaca as mais difíceis com tinta cheia. */
export function GraficoQuestoes({
  dados,
  limiteDificil = 40,
}: {
  dados: { numero: number; valor: number }[];
  limiteDificil?: number;
}) {
  if (dados.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} margin={{ top: 8, right: 4, bottom: 4, left: -22 }}>
        <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="" />
        <XAxis dataKey="numero" {...eixo} interval="preserveStartEnd" minTickGap={14} />
        <YAxis domain={[0, 100]} {...eixo} tickFormatter={(v) => `${v}`} width={44} />
        <Tooltip
          cursor={{ fill: "var(--soft)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <Caixa
                titulo={`Questão ${payload[0].payload.numero}`}
                itens={[{ rotulo: "Acerto", valor: `${Number(payload[0].value).toFixed(0)}%` }]}
              />
            ) : null
          }
        />
        <Bar dataKey="valor" barSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {dados.map((d) => (
            <Cell
              key={d.numero}
              fill={d.valor < limiteDificil ? INK : "var(--line-strong)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export type SerieEvolucao = {
  nome: string;
  chave: string;
  tracejado?: boolean;
};

/**
 * Evolução ao longo dos simulados. Duas séries no máximo, separadas por traço
 * (cheio = foco, tracejado = referência) e nomeadas na legenda.
 */
export function GraficoEvolucao({
  dados,
  series,
}: {
  dados: Record<string, string | number>[];
  series: SerieEvolucao[];
}) {
  if (dados.length === 0) return null;

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap items-center gap-4">
          {series.map((s) => (
            <li key={s.chave} className="flex items-center gap-2 text-xs text-muted">
              <svg width="18" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke={INK}
                  strokeWidth="2"
                  strokeDasharray={s.tracejado ? "4 3" : undefined}
                />
              </svg>
              {s.nome}
            </li>
          ))}
        </ul>
      )}

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={dados} margin={{ top: 12, right: 16, bottom: 4, left: -22 }}>
          <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="" />
          <XAxis dataKey="rotulo" {...eixo} minTickGap={20} />
          <YAxis domain={[0, 100]} {...eixo} width={44} />
          <Tooltip
            cursor={{ stroke: LINE, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Caixa
                  titulo={String(label)}
                  itens={payload.map((p) => ({
                    rotulo: series.find((s) => s.chave === p.dataKey)?.nome ?? String(p.dataKey),
                    valor: `${Number(p.value).toFixed(1)}%`,
                  }))}
                />
              ) : null
            }
          />
          {series.map((s) => (
            <Line
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              stroke={INK}
              strokeWidth={2}
              strokeDasharray={s.tracejado ? "4 3" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: INK, stroke: PAPER, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: INK, stroke: PAPER, strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
