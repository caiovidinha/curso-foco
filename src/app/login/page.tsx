import { SeletorTema } from "@/components/tema";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { FormLogin } from "./form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const destino = typeof next === "string" ? next : "/";

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="absolute top-4 right-4">
        <SeletorTema />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-9 text-center">
          <div className="text-[0.65rem] font-semibold tracking-[0.28em] text-sub uppercase">
            Curso Foco
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Simulados</h1>
          <p className="mt-3 text-sm text-muted">Acesso restrito à equipe pedagógica.</p>
        </div>

        {supabaseConfigurado ? (
          <FormLogin destino={destino} />
        ) : (
          <div className="card space-y-3 p-5 text-sm">
            <div className="font-medium">Configuração pendente</div>
            <p className="text-muted">
              Preencha o arquivo <code className="font-mono text-xs">.env.local</code> na raiz do
              projeto com os dados do Supabase (Project Settings → API Keys):
            </p>
            <pre className="overflow-x-auto rounded-xl bg-soft p-3 font-mono text-[0.7rem] leading-relaxed">
              {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
            </pre>
            <p className="text-muted">
              Depois rode <code className="font-mono text-xs">supabase/schema.sql</code> no SQL
              Editor e reinicie o servidor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
