"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoForm } from "@/app/actions/auth";
import { Field } from "@/components/ui";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormLogin({ destino }: { destino: string }) {
  const [estado, action] = useActionState<EstadoForm, FormData>(entrar, null);

  return (
    <form action={action} className="card space-y-4 p-5">
      <input type="hidden" name="next" value={destino} />

      <Field label="E-mail">
        <input
          className="input"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="professor@cursofoco.com"
          required
        />
      </Field>

      <Field label="Senha">
        <input
          className="input"
          name="senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </Field>

      {estado?.erro && (
        <p className="rounded-xl border border-line bg-soft px-3 py-2 text-xs text-ink">
          {estado.erro}
        </p>
      )}

      <Botao />
    </form>
  );
}
