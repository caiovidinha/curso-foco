import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Sempre chame dentro de um escopo de request (nunca em módulo top-level).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado a partir de um Server Component: o proxy já cuida de
          // renovar a sessão, então ignorar aqui é seguro.
        }
      },
    },
  });
}

/** Retorna o usuário autenticado ou `null`. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
