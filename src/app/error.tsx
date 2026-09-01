"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d96c12]">Algo não saiu como esperado</p>
        <h1 className="mt-3 text-3xl font-bold text-[#102b4e]">Não foi possível carregar esta página.</h1>
        <p className="mt-3 text-slate-600">Tente novamente. Se o problema persistir, verifique a configuração do Supabase.</p>
        <Button className="mt-6" onClick={reset}>Tentar novamente</Button>
      </div>
    </main>
  );
}
