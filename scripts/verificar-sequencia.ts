/**
 * Casos do interpretador de sequências ("ABCDE-BXA…"), usado no gabarito e na
 * correção manual.
 *
 * O risco que estes casos guardam é o de DESLOCAMENTO: se um caractere de
 * pontuação virar "questão em branco" por engano, todas as respostas seguintes
 * andam uma casa e a prova inteira sai errada, sem nenhum erro aparecer.
 *
 *   npm run verificar:sequencia
 */

import { analisarSequencia } from "@/lib/sequencia";

type Caso = { entrada: string; rasura: boolean; esperado: (string | null)[]; nota: string };

const casos: Caso[] = [
  { entrada: "ABCDE", rasura: false, esperado: ["A", "B", "C", "D", "E"], nota: "básico" },
  { entrada: "abcde", rasura: false, esperado: ["A", "B", "C", "D", "E"], nota: "minúsculas" },
  { entrada: "AB CDE", rasura: false, esperado: ["A", "B", "C", "D", "E"], nota: "espaço ignorado" },
  {
    entrada: "A,B;C\nD\tE",
    rasura: false,
    esperado: ["A", "B", "C", "D", "E"],
    nota: "pontuação e quebras ignoradas",
  },
  { entrada: "A.B.C", rasura: false, esperado: ["A", "B", "C"], nota: "ponto não desloca" },
  { entrada: "1. A 2. B 3. C", rasura: false, esperado: ["A", "B", "C"], nota: "lista numerada colada" },
  { entrada: "AB-DE", rasura: true, esperado: ["A", "B", null, "D", "E"], nota: "traço = em branco" },
  { entrada: "AB_DE", rasura: true, esperado: ["A", "B", null, "D", "E"], nota: "underline = em branco" },
  { entrada: "ABXDE", rasura: true, esperado: ["A", "B", "X", "D", "E"], nota: "X = rasura na correção" },
  { entrada: "ABXDE", rasura: false, esperado: ["A", "B", "D", "E"], nota: "X descartado no gabarito" },
  { entrada: "AJKZ", rasura: false, esperado: ["A", "J"], nota: "só A–J são alternativas" },
  { entrada: "", rasura: true, esperado: [], nota: "vazio" },
  { entrada: "   \n\t ", rasura: true, esperado: [], nota: "só espaços" },
];

let falhou = false;

for (const caso of casos) {
  const obtido = analisarSequencia(caso.entrada, caso.rasura);
  const ok = JSON.stringify(obtido) === JSON.stringify(caso.esperado);
  if (!ok) falhou = true;

  console.log(
    `${ok ? "✓" : "✗"} ${caso.nota}\n` +
      `    ${JSON.stringify(caso.entrada)} → ${JSON.stringify(obtido)}` +
      (ok ? "" : `  ESPERADO ${JSON.stringify(caso.esperado)}`),
  );
}

console.log(falhou ? "\nAlgum caso falhou." : "\nTodos os casos passaram.");
process.exit(falhou ? 1 : 0);
