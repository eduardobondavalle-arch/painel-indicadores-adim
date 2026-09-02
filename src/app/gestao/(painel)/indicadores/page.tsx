import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, Database, Eye, Minus, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { BLOCKS, INDICATOR_BY_KEY, indicatorsForBlock } from "@/lib/indicators";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { IndicatorFilters } from "@/components/dashboard/indicator-filters";
import { IndividualIndicatorChart } from "@/components/dashboard/individual-indicator-chart";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type SearchParams = Promise<{ categoria?: string; indicador?: string; gestora?: string; mes?: string; ano?: string }>;
type ManagerRow = { id: string; name: string };
type ResponseRow = { id: string; manager_id: string | null; submitted_manager_name: string; protocol: string; submitted_at: string; consistency_alert_count: number };
type ValueRow = { response_id: string; value_type: string; value_numeric: number | string | null; value_text: string | null; original_numeric: number | string | null; original_text: string | null };

export default async function IndicatorsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const now = new Date();
  const requestedIndicator = params.indicador ? INDICATOR_BY_KEY[params.indicador] : undefined;
  const requestedBlock = Number(params.categoria);
  const block = requestedBlock >= 1 && requestedBlock <= 6 ? requestedBlock : requestedIndicator?.block ?? 1;
  const indicator = requestedIndicator?.block === block ? requestedIndicator : indicatorsForBlock(block)[0];
  const month = Math.min(12, Math.max(1, Number(params.mes) || now.getMonth() + 1));
  const year = Number(params.ano) || now.getFullYear();
  const managerId = params.gestora ?? "";
  const { supabase } = await requireStaff();

  const managersResult = await supabase.from("managers").select("id,name").eq("active", true).order("name");
  let responsesQuery = supabase.from("responses").select("id,manager_id,submitted_manager_name,protocol,submitted_at,consistency_alert_count").eq("reference_month", month).eq("reference_year", year).in("status", ["submitted", "reopened"]).order("submitted_manager_name");
  if (managerId) responsesQuery = responsesQuery.eq("manager_id", managerId);
  const responsesResult = await responsesQuery;
  const responses = (responsesResult.data ?? []) as ResponseRow[];
  const valuesResult = responses.length
    ? await supabase.from("response_values").select("response_id,value_type,value_numeric,value_text,original_numeric,original_text").eq("indicator_key", indicator.key).in("response_id", responses.map((response) => response.id))
    : { data: [] as ValueRow[], error: null };
  const values = (valuesResult.data ?? []) as ValueRow[];
  const rows = responses.flatMap((response) => {
    const value = values.find((candidate) => candidate.response_id === response.id);
    return value ? [{ response, value }] : [];
  });
  const managers = (managersResult.data ?? []) as ManagerRow[];
  const isText = indicator.type === "text";
  const numericRows = isText ? [] : rows.map(({ response, value }) => ({
    response,
    current: Number(value.value_numeric ?? 0),
    original: Number(value.original_numeric ?? 0),
  }));
  const numericValues = numericRows.map((row) => row.current);
  const total = numericValues.reduce((sum, value) => sum + value, 0);
  const average = numericValues.length ? total / numericValues.length : 0;
  const maximum = numericValues.length ? Math.max(...numericValues) : 0;
  const minimum = numericValues.length ? Math.min(...numericValues) : 0;
  const changedCount = rows.filter(({ value }) => isText ? value.value_text !== value.original_text : Number(value.value_numeric) !== Number(value.original_numeric)).length;
  const category = BLOCKS.find((item) => item.number === block)!;
  const loadError = managersResult.error?.message ?? responsesResult.error?.message ?? valuesResult.error?.message;
  const periodLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));

  return (
    <>
      <PageHeader eyebrow="Análise detalhada" title="Indicadores individuais" description="Selecione uma categoria e abra cada indicador isoladamente, com recorte por gestora e período." />
      <IndicatorFilters block={block} indicatorKey={indicator.key} managerId={managerId} month={month} year={year} managers={managers} />
      <Card className="mb-5 mt-5 overflow-hidden border-[#ccd8e5]">
        <div className="h-1.5 bg-[#f28b30]" />
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2"><Badge>Bloco {block}</Badge>{indicator.restricted && <Badge variant="restricted">Gerencial restrito</Badge>}<Badge variant="success">{periodLabel}</Badge></div>
              <p className="mt-4 text-xs font-bold uppercase tracking-[.15em] text-[#d96c12]">Indicador {indicator.number}</p>
              <h2 className="mt-1 max-w-4xl text-2xl font-black leading-tight text-[#102b4e]">{indicator.label}</h2>
              <p className="mt-2 text-sm text-slate-500">Categoria: {category.title} • Tipo: {typeLabel(indicator.type)}</p>
            </div>
            <Button asChild variant="outline"><Link href={`/gestao/comparativo?mes=${month}&ano=${year}${managerId ? `&gestora=${managerId}` : ""}`}>Abrir comparativo completo<ArrowRight className="size-4" /></Link></Button>
          </div>
        </CardContent>
      </Card>

      {loadError && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar os indicadores: {loadError}</div>}
      {!rows.length ? <EmptyState icon={Database} title="Nenhum valor encontrado" description="Não existe resposta ativa para os filtros selecionados. Altere a gestora ou o período." /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isText ? (
              <><StatCard label="Respostas com conteúdo" value={rows.filter(({ value }) => Boolean(value.value_text?.trim())).length} icon={Database} /><StatCard label="Gestoras no recorte" value={rows.length} icon={Users} /><StatCard label="Valores alterados" value={changedCount} icon={ArrowUp} tone={changedCount ? "orange" : "green"} /><StatCard label="Sem preenchimento" value={rows.filter(({ value }) => !value.value_text?.trim()).length} icon={Minus} /></>
            ) : (
              <><StatCard label="Média da equipe" value={formatMetric(indicator.type, average)} icon={BarChart3} /><StatCard label="Maior valor" value={formatMetric(indicator.type, maximum)} icon={ArrowUp} tone="green" /><StatCard label="Menor valor" value={formatMetric(indicator.type, minimum)} icon={ArrowDown} tone="orange" /><StatCard label="Total consolidado" value={formatMetric(indicator.type, total)} icon={Database} tone="purple" /></>
            )}
          </div>

          {!isText && <Card className="mt-5"><CardHeader><CardTitle>Valores por gestora</CardTitle><p className="mt-1 text-sm text-slate-500">A série azul preserva o valor originalmente informado; a laranja mostra o valor administrativo atual.</p></CardHeader><CardContent><IndividualIndicatorChart type={indicator.type} data={numericRows.map((row) => ({ name: shortName(row.response.submitted_manager_name), atual: row.current, original: row.original }))} /></CardContent></Card>}

          <Card className="mt-5 overflow-hidden">
            <CardHeader className="border-b"><CardTitle>Detalhamento do indicador</CardTitle><p className="mt-1 text-sm text-slate-500">{rows.length} {rows.length === 1 ? "registro encontrado" : "registros encontrados"}.</p></CardHeader>
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Gestora</th><th className="px-4 py-3">Valor informado</th><th className="px-4 py-3">Valor atual</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Protocolo</th><th className="px-5 py-3 text-right">Resposta</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(({ response, value }) => { const changed = isText ? value.value_text !== value.original_text : Number(value.value_numeric) !== Number(value.original_numeric); return <tr key={response.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-bold text-[#102b4e]">{response.submitted_manager_name}</p><p className="mt-1 text-xs text-slate-400">Enviado em {new Date(response.submitted_at).toLocaleString("pt-BR")}</p></td><td className="max-w-sm whitespace-pre-wrap px-4 py-4 text-slate-600">{displayStored(indicator.type, isText ? value.original_text : value.original_numeric)}</td><td className="max-w-sm whitespace-pre-wrap px-4 py-4 font-bold text-[#102b4e]">{displayStored(indicator.type, isText ? value.value_text : value.value_numeric)}</td><td className="px-4 py-4">{changed ? <Badge variant="warning">Alterado pela gestão</Badge> : <Badge variant="success">Original preservado</Badge>}</td><td className="px-4 py-4 font-mono text-xs">{response.protocol}</td><td className="px-5 py-4 text-right"><Button asChild variant="ghost" size="sm"><Link href={`/gestao/envios/${response.id}`}><Eye className="size-4" />Visualizar</Link></Button></td></tr>; })}</tbody></table></div>
          </Card>
        </>
      )}
    </>
  );
}

function shortName(name: string) { const parts = name.trim().split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.charAt(0)}.` : parts[0]; }
function typeLabel(type: string) { return ({ integer: "Número inteiro", decimal: "Número decimal", percent: "Percentual", currency: "Moeda brasileira", nps: "NPS de 0 a 100", text: "Texto" } as Record<string, string>)[type] ?? type; }
function formatMetric(type: string, value: number) { if (type === "currency") return formatCurrency(value); if (type === "percent") return formatPercent(value); return formatNumber(value); }
function displayStored(type: string, value: number | string | null) { if (value == null || value === "") return "—"; return type === "text" ? String(value) : formatMetric(type, Number(value)); }
