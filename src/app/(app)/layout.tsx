import Link from "next/link";
import { sair } from "@/app/actions/auth";
import { BottomNav, SideNav } from "@/components/nav";
import { IconLogout } from "@/components/icons";
import { SeletorTema } from "@/components/tema";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();

  return (
    <div className="flex min-h-dvh">
      <SideNav />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* topo — identidade no mobile, conta no desktop */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur-md md:justify-end md:px-8">
          <Link href="/" className="md:hidden">
            <div className="text-[0.6rem] font-semibold tracking-[0.2em] text-sub uppercase">
              Curso Foco
            </div>
            <div className="text-base leading-tight font-semibold tracking-tight">Simulados</div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-52 truncate text-xs text-muted lg:block">
              {user?.email}
            </span>
            <SeletorTema />
            <form action={sair}>
              <button type="submit" className="btn btn-ghost btn-sm" title="Sair">
                <IconLogout width={16} height={16} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-12">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
