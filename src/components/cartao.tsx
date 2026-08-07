import { MARKERS, PAGE_H, PAGE_W, buildSheetLayout, type SheetLayout } from "@/lib/omr/layout";

const mm = (v: number) => `${v}mm`;

/** Garante que o preto sólido saia na impressão mesmo com "economia de tinta". */
const forcarCor = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as const;

function Bolha({ x, y, r, filled }: { x: number; y: number; r: number; filled?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: mm(x - r),
        top: mm(y - r),
        width: mm(r * 2),
        height: mm(r * 2),
        borderRadius: "50%",
        border: "0.28mm solid #000",
        background: filled ? "#000" : "transparent",
        boxSizing: "border-box",
        ...forcarCor,
      }}
    />
  );
}

function Texto({
  x,
  y,
  children,
  size = 2.6,
  bold,
  align = "left",
  width,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  width?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: mm(x),
        top: mm(y),
        width: width ? mm(width) : undefined,
        transform: "translateY(-50%)",
        fontSize: mm(size),
        lineHeight: 1,
        fontWeight: bold ? 700 : 400,
        textAlign: align,
        color: "#000",
        whiteSpace: "nowrap",
        ...forcarCor,
      }}
    >
      {children}
    </div>
  );
}

export type DadosCartao = {
  tituloSimulado: string;
  dataSimulado: string | null;
  alunoNome: string | null;
  alunoTurma: string | null;
  codigo: number | null;
};

/** Uma folha A4 do cartão-resposta, desenhada em milímetros reais. */
export function FolhaCartao({
  layout,
  paginaIndex,
  dados,
}: {
  layout: SheetLayout;
  paginaIndex: number;
  dados: DadosCartao;
}) {
  const page = layout.pages[paginaIndex];
  const totalPaginas = layout.pages.length;

  return (
    <div
      className="sheet"
      style={{
        position: "relative",
        width: mm(PAGE_W),
        height: mm(PAGE_H),
        background: "#fff",
        color: "#000",
        fontFamily: "Helvetica, Arial, sans-serif",
        overflow: "hidden",
        ...forcarCor,
      }}
    >
      {/* marcadores de canto — âncoras da leitura óptica */}
      {MARKERS.map((m) => (
        <div
          key={m.key}
          style={{
            position: "absolute",
            left: mm(m.x - m.size / 2),
            top: mm(m.y - m.size / 2),
            width: mm(m.size),
            height: mm(m.size),
            background: "#000",
            ...forcarCor,
          }}
        />
      ))}

      {/* cabeçalho */}
      <Texto x={26} y={12} size={3.6} bold>
        CURSO FOCO · CARTÃO-RESPOSTA
      </Texto>
      <Texto x={26} y={18} size={3}>
        {dados.tituloSimulado}
      </Texto>
      <Texto x={26} y={23} size={2.5}>
        {[dados.dataSimulado, dados.alunoTurma].filter(Boolean).join("   ·   ")}
      </Texto>

      <div
        style={{
          position: "absolute",
          left: mm(26),
          top: mm(28),
          width: mm(168),
          borderTop: "0.3mm solid #000",
          ...forcarCor,
        }}
      />

      {/* identificação do aluno */}
      <Texto x={26} y={33} size={2.8} bold>
        {dados.alunoNome ?? "NOME: ______________________________________________"}
      </Texto>

      {/* grade do código */}
      <Texto x={14} y={37} size={2.2} bold>
        CÓDIGO
      </Texto>
      {[0, 1, 2, 3].map((d) => (
        <Texto key={d} x={22} y={40 + d * 6} size={2.4} align="right" width={7}>
          {["M", "C", "D", "U"][d]}
        </Texto>
      ))}
      {page.code.map((b) => (
        <Bolha key={`c-${b.digitIndex}-${b.value}`} {...b} />
      ))}
      {Array.from({ length: 10 }, (_, v) => (
        <Texto key={`cl-${v}`} x={32 + v * 6.4 - 1.5} y={35.5} size={2} width={3} align="center">
          {v}
        </Texto>
      ))}

      {/* número da página (pré-preenchido) */}
      <Texto x={150} y={35} size={2.2} bold>
        PÁGINA
      </Texto>
      {page.pageMarks.map((b) => (
        <Bolha key={`p-${b.pagina}`} {...b} />
      ))}
      {page.pageMarks.map((b) => (
        <Texto key={`pl-${b.pagina}`} x={b.x - 1.5} y={b.y + 5} size={2} width={3} align="center">
          {b.pagina}
        </Texto>
      ))}

      {/* instruções */}
      <Texto x={100} y={53} size={2.3}>
        Preencha a bolha inteira com caneta preta ou azul escura.
      </Texto>
      <Texto x={100} y={57.5} size={2.3}>
        Não rasure: uma questão com duas marcas é anulada.
      </Texto>
      <Texto x={100} y={62} size={2.3}>
        Não dobre nem amasse a folha; mantenha os quadrados dos cantos limpos.
      </Texto>

      {/* respostas */}
      {page.colunas.map((col, ci) => (
        <div key={ci}>
          {layout.letras.map((letra, oi) => (
            <Texto
              key={letra}
              x={col.firstOptionX + oi * layout.optionPitch - 1.5}
              y={69}
              size={2.2}
              bold
              width={3}
              align="center"
            >
              {letra}
            </Texto>
          ))}
        </div>
      ))}

      {page.answers.map((b) => (
        <Bolha key={`a-${b.numero}-${b.opcao}`} {...b} />
      ))}

      {page.colunas.flatMap((col) =>
        col.numeros.map((numero, ri) => (
          <Texto
            key={`n-${numero}`}
            x={col.labelX}
            y={74 + ri * layout.rowPitch}
            size={2.4}
            align="right"
            width={layout.labelW - 2}
          >
            {numero}
          </Texto>
        )),
      )}

      <Texto x={16} y={292} size={2.1}>
        {dados.codigo !== null
          ? `Aluno ${String(dados.codigo).padStart(4, "0")} · página ${page.pagina} de ${totalPaginas}`
          : `Página ${page.pagina} de ${totalPaginas}`}
      </Texto>
    </div>
  );
}

/** Todas as folhas de um aluno (ou de um cartão em branco). */
export function CartaoAluno({
  numeros,
  numOpcoes,
  dados,
}: {
  numeros: number[];
  numOpcoes: number;
  dados: DadosCartao;
}) {
  const layout = buildSheetLayout(numeros, numOpcoes, dados.codigo);

  return (
    <>
      {layout.pages.map((_, i) => (
        <div key={i} className="mx-auto mb-6 w-fit shadow-lg print:m-0 print:shadow-none">
          <FolhaCartao layout={layout} paginaIndex={i} dados={dados} />
        </div>
      ))}
    </>
  );
}
