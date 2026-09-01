import { AlertTriangle, Building2, CalendarCheck2, CheckCircle2, Clock3, HandCoins, Home, RefreshCw, Send, Users, Wrench } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReferenceFilter } from "@/components/dashboard/reference-filter";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SearchParams = Promise<{ mes?: string; ano?: string }>;
type ValueRow = { indicator_key: string; value_numeric: number | string | null };
type ResponseRow = { manager_id: string; submitted_at: string; consistency_alert_count: number; response_values: ValueRow[] };
type ManagerRow = { id: string; name: string; email: string };

export default async function OverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const now = new Date();
  const month = Math.min(12, Math.max(1, Number(params.mes) || now.getMonth() + 1));
  const year = Number(params.ano) || now.getFullYear();
  const { supabase } = await requireStaff();

  const [managersResult, responsesResult] = await Promise.all([
    supabase.from("managers").select("id,name,email").eq("active", true).order("name"),
    supabase.from("responses").select("manager_id,submitted_at,consistency_alert_count,response_values(indicator_key,value_numeric)").eq("reference_month", month).eq("reference_year", year).in("status", ["submitted", "reopened"]),
  ]);
  const managers = (managersResult.data ?? []) as ManagerRow[];
  const responses = (responsesResult.data ?? []) as ResponseRow[];
  const respondedIds = new Set(responses.map((response) => response.manager_id));
  const responded = managers.filter((manager) => respondedIds.has(manager.id));
  const pending = managers.filter((manager) => !respondedIds.has(manager.id));
  const lastSubmission = responses.map((response) => response.submitted_at).sort().at(-1);
  const alerts = responses.reduce((sum, response) => sum + response.consistency_alert_count, 0);
  const sum = (key: string) => responses.reduce((total, response) => total + Number(response.response_values.find((value) => value.indicator_key === key)?.value_numeric ?? 0), 0);
  const periodLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  const loadError = managersResult.error?.message || responsesResult.error?.message;

  return (
    <>
      <PageHeader eyebrow="Visão geral do mês" title={periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)} description="Acompanhe o recebimento e os principais volumes declarados pela equipe." actions={<ReferenceFilter month={month} year={year} />} />
      {loadError && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar todos os dados: {loadError}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gestoras esperadas" value={managers.length} icon={Users} />
        <StatCard label="Formulários recebidos" value={responses.length} icon={Send} tone="green" detail={`${pending.length} pendente(s)`} />
        <StatCard label="Respostas com alertas" value={responses.filter((response) => response.consistency_alert_count > 0).length} icon={AlertTriangle} tone="orange" detail={`${alerts} alerta(s) no total`} />
        <StatCard label="Último envio" value={lastSubmission ? new Date(lastSubmission).toLocaleDateString("pt-BR") : "—"} icon={Clock3} detail={lastSubmission ? new Date(lastSubmission).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Nenhum envio"} />
      </div>
      <h2 className="mb-4 mt-8 text-lg font-black text-[#102b4e]">Consolidação declarada</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contratos administrados" value={sum("contratos_ativos_fim_mes")} icon={Building2} />
        <StatCard label="Renovações" value={sum("contratos_renovados")} icon={RefreshCw} tone="green" />
        <StatCard label="Rescisões" value={sum("total_rescisoes")} icon={CalendarCheck2} tone="orange" />
        <StatCard label="Chamados" value={sum("chamados_abertos")} icon={Wrench} tone="purple" />
        <StatCard label="Migrações para garantida" value={sum("contratos_migrados_garantida")} icon={CheckCircle2} tone="green" />
        <StatCard label="Adesões ao Cash Go" value={sum("cash_go_adesoes")} icon={HandCoins} tone="orange" />
        <StatCard label="Imóveis locados incorporados" value={sum("imoveis_locados_incorporados")} icon={Home} />
        <StatCard label="Imóveis vagos trazidos" value={sum("imoveis_vagos_trazidos")} icon={Home} tone="purple" />
      </div>
      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Gestoras que responderam</CardTitle></CardHeader><CardContent>{responded.length ? <div className="flex flex-wrap gap-2">{responded.map((manager) => <Badge key={manager.id} variant="success">{manager.name}</Badge>)}</div> : <p className="text-sm text-slate-500">Nenhuma resposta recebida neste período.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Gestoras pendentes</CardTitle></CardHeader><CardContent>{pending.length ? <div className="space-y-2">{pending.map((manager) => <div key={manager.id} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2"><span className="text-sm font-semibold text-amber-900">{manager.name}</span><span className="text-xs text-amber-700">{manager.email}</span></div>)}</div> : <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="size-4" />Todas as gestoras ativas responderam.</p>}</CardContent></Card>
      </div>
    </>
  );
}
