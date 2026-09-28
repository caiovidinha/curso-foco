import { analisarNumerosQuestoes, formatarNumerosQuestoes } from "@/lib/numeracao";

const validos = [
  { entrada: "49, 61, 62, 63, 69", esperado: [49, 61, 62, 63, 69] },
  { entrada: "46-48, 51; 53\n55 56", esperado: [46, 47, 48, 51, 53, 55, 56] },
  { entrada: "61 – 63, 49", esperado: [49, 61, 62, 63] },
];

const invalidos = ["", "0, 1", "3, 3", "10-8", "1, abc", "1-301"];
let falhou = false;

for (const caso of validos) {
  const resultado = analisarNumerosQuestoes(caso.entrada);
  const ok = resultado.ok && JSON.stringify(resultado.numeros) === JSON.stringify(caso.esperado);
  if (!ok) falhou = true;
  console.log(`${ok ? "✓" : "✗"} ${JSON.stringify(caso.entrada)}`);
}

for (const entrada of invalidos) {
  const resultado = analisarNumerosQuestoes(entrada);
  const ok = !resultado.ok;
  if (!ok) falhou = true;
  console.log(`${ok ? "✓" : "✗"} rejeita ${JSON.stringify(entrada)}`);
}

const formatado = formatarNumerosQuestoes([49, 61, 62, 63, 69, 71, 80, 82, 85, 86, 87, 88, 89, 90]);
const formatoOk = formatado === "49, 61–63, 69, 71, 80, 82, 85–90";
if (!formatoOk) falhou = true;
console.log(`${formatoOk ? "✓" : "✗"} formata ${formatado}`);

console.log(falhou ? "\nAlgum caso falhou." : "\nTodos os casos passaram.");
process.exit(falhou ? 1 : 0);
