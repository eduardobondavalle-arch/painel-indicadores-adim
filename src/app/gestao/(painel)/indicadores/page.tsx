import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, Database, Eye, Minus, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { BLOCKS, INDICATOR_BY_KEY, indicatorsForBlock, type IndicatorDefinition } from "@/lib/indicators";
import { resolveIndicatorPeriod, type IndicatorPeriod } from "@/lib/indicator-period";
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
type ResponseRow = { id: string; manager_id: string | null; submitted_manager_name: string; protocol: string; submitted_at: string };
type ValueRow = { response_id: string; indicator_key: string; value_numeric: number | string | null; value_text: string | null; original_numeric: number | string | null; original_text: string | null };
type IndicatorRow = { response: ResponseRow; value: ValueRow };

export default async function IndicatorsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedIndicator = params.indicador ? INDICATOR_BY_KEY[params.indicador] : undefined;
  const requestedBlock = Number(params.categoria);
  const block = Number.isInteger(requestedBlock) && requestedBlock >= 1 && requestedBlock <= 6
    ? requestedBlock
    : requestedIndicator?.block ?? 1;
  const indicators = indicatorsForBlock(block);
  const managerId = params.gestora ?? "";
  const { supabase } = await requireStaff();

  const [managersResult, periodsResult] = await Promise.all([
    supabase.from("managers").select("id,name").eq("active", true).order("name"),
    supabase.from("submission_periods").select("reference_month,reference_year,status"),
  ]);
  const periods = (periodsResult.data ?? []) as IndicatorPeriod[];
  const { month, year } = resolveIndicatorPeriod(params, periods);
  const managers = (managersResult.data ?? []) as ManagerRow[];

  let responsesQuery = supabase.from("responses")
    .select("id,manager_id,submitted_manager_name,protocol,submitted_at")
    .eq("reference_month", month)
    .eq("reference_year", year)
    .in("status", ["submitted", "reopened"])
    .order("submitted_manager_name");
  if (managerId) responsesQuery = responsesQuery.eq("manager_id", managerId);
  const responsesResult = await responsesQuery;
  const responses = (responsesResult.data ?? []) as ResponseRow[];
  const values: ValueRow[] = [];
  let valuesError: string | undefined;
  if (responses.length) {
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const result = await supabase.from("response_values")
        .select("response_id,indicator_key,value_numeric,value_text,original_numeric,original_text")
        .in("response_id", responses.map((response) => response.id))
        .in("indicator_key", indicators.map((indicator) => indicator.key))
        .order("response_id")
        .order("indicator_key")
        .range(offset, offset + pageSize - 1);
      if (result.error) {
        valuesError = result.error.message;
        break;
      }
      const batch = (result.data ?? []) as ValueRow[];
      values.push(...batch);
      if (batch.length < pageSize) break;
    }
  }
  const valuesByKey = new Map<string, Map<string, ValueRow>>();
  for (const value of values) {
    const byResponse = valuesByKey.get(value.indicator_key) ?? new Map<string, ValueRow>();
    byResponse.set(value.response_id, value);
    valuesByKey.set(value.indicator_key, byResponse);
  }

  const category = BLOCKS.find((item) => item.number === block)!;
  const loadError = managersResult.error?.message ?? periodsResult.error?.message ?? responsesResult.error?.message ?? valuesError;
  const periodLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));

  return (
    <>
      <PageHeader eyebrow="Análise detalhada" title="Indicadores por bloco" description="Selecione um bloco para visualizar todos os seus indicadores, com recorte por gestora e período." />
      <IndicatorFilters
        block={block}
        managerId={managerId}
        month={month}
        year={year}
        managers={managers}
        availableYears={periods.map((period) => period.reference_year)}
      />
      <Card className="mb-5 mt-5 overflow-hidden border-[#ccd8e5]">
        <div className="h-1.5 bg-[#f28b30]" />
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2"><Badge>Bloco {block}</Badge><Badge variant="success">{periodLabel}</Badge></div>
              <h2 className="mt-4 text-2xl font-black leading-tight text-[#102b4e]">{category.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{category.description} {indicators.length} indicadores neste bloco.</p>
            </div>
            <Button asChild variant="outline"><Link href={`/gestao/comparativo?mes=${month}&ano=${year}${managerId ? `&gestora=${managerId}` : ""}`}>Abrir comparativo completo<ArrowRight className="size-4" /></Link></Button>
          </div>
        </CardContent>
      </Card>

      {loadError && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar os indicadores: {loadError}</div>}
      {!responses.length && !loadError && <EmptyState icon={Database} title="Nenhuma resposta encontrada" description="Não existe resposta ativa para os filtros selecionados. Altere a gestora ou o período." />}
      <div className="mt-5 space-y-8">
        {indicators.map((indicator) => {
          const byResponse = valuesByKey.get(indicator.key);
          const rows = responses.flatMap((response) => {
            const value = byResponse?.get(response.id);
            return value ? [{ response, value }] : [];
          });
          return <IndicatorDetail key={indicator.key} indicator={indicator} rows={rows} />;
        })}
      </div>
    </>
  );
}

function IndicatorDetail({ indicator, rows }: { indicator: IndicatorDefinition; rows: IndicatorRow[] }) {
  const isText = indicator.type === "text";
  const numericRows = isText ? [] : rows
    .filter(({ value }) => value.value_numeric !== null)
    .map(({ response, value }) => ({
      response,
      current: Number(value.value_numeric),
      original: Number(value.original_numeric ?? 0),
    }));
  const numericValues = numericRows.map((row) => row.current);
  const total = numericValues.reduce((sum, value) => sum + value, 0);
  const average = numericValues.length ? total / numericValues.length : 0;
  const maximum = numericValues.length ? Math.max(...numericValues) : 0;
  const minimum = numericValues.length ? Math.min(...numericValues) : 0;
  const changedCount = rows.filter(({ value }) => wasChanged(indicator.type, value)).length;

  return (
    <section aria-labelledby={`indicator-${indicator.number}`}>
      <Card className="overflow-hidden border-[#ccd8e5]">
        <div className="h-1 bg-[#f28b30]" />
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2"><Badge>Indicador {indicator.number}</Badge>{indicator.restricted && <Badge variant="restricted">Gerencial restrito</Badge>}</div>
          <h3 id={`indicator-${indicator.number}`} className="mt-3 text-xl font-black leading-tight text-[#102b4e]">{indicator.label}</h3>
          <p className="mt-1 text-sm text-slate-500">Tipo: {typeLabel(indicator.type)} · {rows.length} {rows.length === 1 ? "registro" : "registros"}</p>
        </CardContent>
      </Card>

      {!rows.length ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border bg-[var(--glass)] px-5 py-4 text-sm text-slate-500">Nenhum valor registrado para este indicador no período e gestora selecionados.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isText ? (
              <>
                <StatCard label="Respostas com conteúdo" value={rows.filter(({ value }) => Boolean(value.value_text?.trim())).length} icon={Database} />
                <StatCard label="Gestoras no recorte" value={rows.length} icon={Users} />
                <StatCard label="Valores alterados" value={changedCount} icon={ArrowUp} tone={changedCount ? "orange" : "green"} />
                <StatCard label="Sem preenchimento" value={rows.filter(({ value }) => !value.value_text?.trim()).length} icon={Minus} />
              </>
            ) : (
              <>
                <StatCard label="Média da equipe" value={numericValues.length ? formatMetric(indicator.type, average) : "—"} icon={BarChart3} />
                <StatCard label="Maior valor" value={numericValues.length ? formatMetric(indicator.type, maximum) : "—"} icon={ArrowUp} tone="green" />
                <StatCard label="Menor valor" value={numericValues.length ? formatMetric(indicator.type, minimum) : "—"} icon={ArrowDown} tone="orange" />
                <StatCard label="Total consolidado" value={numericValues.length ? formatMetric(indicator.type, total) : "—"} icon={Database} tone="purple" />
              </>
            )}
          </div>

          {!isText && numericRows.length > 0 && (
            <Card className="mt-4">
              <CardHeader><CardTitle>Valores por gestora</CardTitle><p className="mt-1 text-sm text-slate-500">A série azul preserva o valor originalmente informado; a laranja mostra o valor administrativo atual.</p></CardHeader>
              <CardContent><IndividualIndicatorChart type={indicator.type} data={numericRows.map((row) => ({ name: shortName(row.response.submitted_manager_name), atual: row.current, original: row.original }))} /></CardContent>
            </Card>
          )}

          <Card className="mt-4 overflow-hidden">
            <CardHeader className="border-b"><CardTitle>Detalhamento</CardTitle><p className="mt-1 text-sm text-slate-500">Valor original, valor atual e protocolo de cada gestora.</p></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Gestora</th><th className="px-4 py-3">Valor informado</th><th className="px-4 py-3">Valor atual</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Protocolo</th><th className="px-5 py-3 text-right">Resposta</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ response, value }) => (
                    <tr key={response.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4"><p className="font-bold text-[#102b4e]">{response.submitted_manager_name}</p><p className="mt-1 text-xs text-slate-400">Enviado em {new Date(response.submitted_at).toLocaleString("pt-BR")}</p></td>
                      <td className="max-w-sm whitespace-pre-wrap px-4 py-4 text-slate-600">{displayStored(indicator.type, isText ? value.original_text : value.original_numeric)}</td>
                      <td className="max-w-sm whitespace-pre-wrap px-4 py-4 font-bold text-[#102b4e]">{displayStored(indicator.type, isText ? value.value_text : value.value_numeric)}</td>
                      <td className="px-4 py-4">{wasChanged(indicator.type, value) ? <Badge variant="warning">Alterado pela gestão</Badge> : <Badge variant="success">Original preservado</Badge>}</td>
                      <td className="px-4 py-4 font-mono text-xs">{response.protocol}</td>
                      <td className="px-5 py-4 text-right"><Button asChild variant="ghost" size="sm"><Link href={`/gestao/envios/${response.id}`}><Eye className="size-4" />Visualizar</Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}

function wasChanged(type: string, value: ValueRow) {
  if (type === "text") return value.value_text !== value.original_text;
  if (value.value_numeric == null || value.original_numeric == null) return value.value_numeric != null || value.original_numeric != null;
  return Number(value.value_numeric) !== Number(value.original_numeric);
}
function shortName(name: string) { const parts = name.trim().split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.charAt(0)}.` : parts[0]; }
function typeLabel(type: string) { return ({ integer: "Número inteiro", decimal: "Número decimal", percent: "Percentual", currency: "Moeda brasileira", nps: "NPS de 0 a 100", text: "Texto" } as Record<string, string>)[type] ?? type; }
function formatMetric(type: string, value: number) { if (type === "currency") return formatCurrency(value); if (type === "percent") return formatPercent(value); return formatNumber(value); }
function displayStored(type: string, value: number | string | null) { if (value == null || value === "") return "—"; return type === "text" ? String(value) : formatMetric(type, Number(value)); }
