/**
 * Credenciais públicas do Supabase.
 *
 * O Supabase substituiu as chaves JWT antigas (`anon` / `service_role`) pelo par
 * `publishable` / `secret`. A chave publicável (`sb_publishable_…`) é a que vai
 * no navegador: ela vale exatamente o mesmo que a antiga `anon` — quem manda no
 * acesso é o RLS, que este projeto exige em todas as tabelas.
 *
 * As duas formas são aceitas aqui para o projeto funcionar tanto em contas novas
 * quanto em projetos antigos que ainda usam a `anon`.
 *
 * As referências a `process.env.NEXT_PUBLIC_*` precisam ficar literais: é assim
 * que o Next substitui o valor na hora do build.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const supabaseConfigurado = SUPABASE_URL !== "" && SUPABASE_KEY !== "";
