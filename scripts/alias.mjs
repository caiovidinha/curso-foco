/**
 * Resolvedor mínimo para rodar os módulos TypeScript do projeto direto no Node
 * (que já remove os tipos sozinho): traduz o alias `@/` e completa a extensão
 * `.ts` dos imports relativos. Usado só pelos scripts de verificação.
 */

import { pathToFileURL } from "node:url";
import { register } from "node:module";

const RAIZ = pathToFileURL(process.cwd() + "/src/").href;

export async function resolve(especificador, contexto, proximo) {
  const alvo = especificador.startsWith("@/")
    ? RAIZ + especificador.slice(2)
    : especificador;

  try {
    return await proximo(alvo, contexto);
  } catch (erro) {
    if (/\.[cm]?[jt]sx?$/.test(alvo)) throw erro;
    try {
      return await proximo(alvo + ".ts", contexto);
    } catch {
      // o Node não remove tipos de .tsx (o JSX fica), então isto só resolve
      // arquivos de UI que porventura sejam importados só por tipo
      return await proximo(alvo + ".tsx", contexto);
    }
  }
}

// quando carregado via `--import`, registra a si mesmo como hook
if (!process.env.__ALIAS_REGISTRADO) {
  process.env.__ALIAS_REGISTRADO = "1";
  register("./alias.mjs", import.meta.url);
}
