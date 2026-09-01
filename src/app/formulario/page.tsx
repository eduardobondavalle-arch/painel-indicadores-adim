import { Brand } from "@/components/brand";
import { PublicIndicatorForm } from "@/components/form/public-indicator-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function FormularioPage() {
  return (
    <main className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b border-border/60">
        <div className="mx-auto flex min-h-16 max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="hidden h-8 w-px bg-border sm:block" />
            <span className="label-caps hidden sm:inline">Indicadores de carteira</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <section className="page-transition mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-9">
        <div className="mb-8 max-w-3xl">
          <p className="label-caps text-primary">Fechamento mensal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Indicadores mensais da carteira</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">Informe os dados correspondentes ao mês selecionado. Seus valores são preservados como enviados e qualquer ajuste posterior fica registrado para auditoria.</p>
        </div>
        <PublicIndicatorForm />
      </section>
      <footer className="glass border-t border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
        Ambiente exclusivo para coleta de indicadores • Adim Aluguéis
      </footer>
    </main>
  );
}
