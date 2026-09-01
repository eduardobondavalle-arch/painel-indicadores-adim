"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function GestaoLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("E-mail ou senha inválidos.");
      const returnPath = new URLSearchParams(window.location.search).get("retorno");
      router.replace(returnPath?.startsWith("/gestao/") ? returnPath : "/gestao/visao-geral");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b border-border/60">
        <div className="mx-auto flex min-h-16 max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="hidden h-8 w-px bg-border sm:block" />
            <p className="label-caps hidden sm:block">Gestão de indicadores</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="page-transition mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1800px] items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,520px)] lg:gap-20 lg:py-16">
        <section className="max-w-2xl">
          <p className="label-caps text-primary">Painel de gestão</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Indicadores para decisões mais claras.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            Acompanhe resultados, compare carteiras e consulte a evolução de cada indicador em um único ambiente.
          </p>
          <div className="mt-8 hidden items-center gap-3 text-sm text-muted-foreground lg:flex">
            <span className="grid size-9 place-items-center rounded-full border border-border bg-secondary/65 text-primary">
              <ShieldCheck className="size-[18px]" />
            </span>
            Acesso exclusivo e monitorado para a equipe Adim Aluguéis.
          </div>
        </section>

        <section className="panel rise-in w-full p-6 sm:p-8" aria-labelledby="login-title">
          <div className="mb-7">
            <p className="label-caps text-primary">Área restrita</p>
            <h2 id="login-title" className="mt-2 text-2xl font-semibold text-foreground">Acesse sua conta</h2>
            <p className="mt-2 text-sm text-muted-foreground">Use suas credenciais corporativas para continuar.</p>
          </div>

          <form className="space-y-5" onSubmit={login}>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="seu-email@adimimoveis.com.br"
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-11"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar conteúdo digitado" : "Exibir conteúdo digitado"}
                  className="focus-ring absolute right-1 top-0.5 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : <><LogIn className="size-4" />Entrar</>}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-muted-foreground lg:hidden">Acesso monitorado e registrado para auditoria.</p>
        </section>
      </main>
    </div>
  );
}
