import { AlertTriangle, Medal } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { INDICATORS } from "@/lib/indicators";
import { calculateScore, scoringConfigurationIssues, type BonusRange, type Pillar, type ScoringParameter } from "@/lib/scoring";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";

type SearchParams = Promise<{ mes?: string; ano?: string; indicador?: string; ordem?: "asc" | "desc" }>;
type ResponseRow = { id: string; submitted_manager_name: string };
type ValueRow = { response_id: string; indicator_key: string; value_type: string; value_numeric: number | string | null; value_text: string | null };

export default async function RankingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams; const now = new Date(); const month = Number(params.mes) || now.getMonth() + 1; const year = Number(params.ano) || now.getFullYear();
  const indicatorKey = params.indicador && INDICATORS.some((item) => item.key === params.indicador && item.type !== "text") ? params.indicador : "contratos_renovados"; const direction = params.ordem === "asc" ? "asc" : "desc";
  const indicator = INDICATORS.find((item) => item.key === indicatorKey)!;
  const { supabase } = await requireStaff();
  const [responsesResult, pillarsResult, parametersResult, bonusesResult] = await Promise.all([
    supabase.from("responses").select("id,submitted_manager_name").eq("reference_month", month).eq("reference_year", year).in("status", ["submitted", "reopened"]),
    supabase.from("scoring_pillars").select("id,pillar_number,name,weight,minimum_lock").order("pillar_number"),
    supabase.from("scoring_parameters").select("id,indicator_key,pillar_id,weight,minimum_goal,maximum_goal,direction,formal_complaint_veto"),
    supabase.from("bonus_ranges").select("id,label,minimum_score,amount").order("amount"),
  ]);
  const responses = (responsesResult.data ?? []) as ResponseRow[];
  const valuesResult = responses.length ? await supabase.from("response_values").select("response_id,indicator_key,value_type,value_numeric,value_text").in("response_id", responses.map((response) => response.id)) : { data: [], error: null };
  const values = (valuesResult.data ?? []) as ValueRow[];
  const entries = responses.map((response) => ({ name: response.submitted_manager_name, values: Object.fromEntries(values.filter((value) => value.response_id === response.id).map((value) => [value.indicator_key, value.value_type === "text" ? value.value_text ?? "" : Number(value.value_numeric ?? 0)])) })).sort((a, b) => direction === "desc" ? Number(b.values[indicatorKey] ?? 0) - Number(a.values[indicatorKey] ?? 0) : Number(a.values[indicatorKey] ?? 0) - Number(b.values[indicatorKey] ?? 0));
  const pillars = (pillarsResult.data ?? []) as Pillar[]; const parameters = (parametersResult.data ?? []) as ScoringParameter[]; const bonuses = (bonusesResult.data ?? []) as BonusRange[];
  const configIssues = scoringConfigurationIssues(pillars, parameters, bonuses);
  const general = !configIssues.length ? entries.map((entry) => { const result = calculateScore(entry.values, pillars, parameters); const bonus = result.veto ? null : [...bonuses].sort((a, b) => Number(b.minimum_score) - Number(a.minimum_score)).find((range) => result.score >= Number(range.minimum_score)); return { ...entry, ...result, bonus }; }).sort((a, b) => b.score - a.score) : [];
  return <><PageHeader eyebrow="Desempenho mensal" title="Ranking" description="O ranking por indicador permanece disponível sem depender de uma pontuação geral." /><Card className="mb-5"><CardContent className="p-4"><form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Filter name="mes" label="Mês" value={month}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, index, 1))}</option>)}</Filter><Filter name="ano" label="Ano" value={year}>{Array.from({ length: 7 }, (_, index) => <option key={now.getFullYear() + 1 - index}>{now.getFullYear() + 1 - index}</option>)}</Filter><Filter name="indicador" label="Indicador" value={indicatorKey}>{INDICATORS.filter((item) => item.type !== "text").map((item) => <option key={item.key} value={item.key}>{item.number}. {item.label}</option>)}</Filter><Filter name="ordem" label="Direção" value={direction}><option value="desc">Maior primeiro</option><option value="asc">Menor primeiro</option></Filter><div className="flex items-end"><Button className="w-full">Aplicar</Button></div></form></CardContent></Card>
    {configIssues.length > 0 && <Card className="mb-5 border-amber-300 bg-amber-50"><CardContent className="flex gap-3 p-5"><AlertTriangle className="size-6 shrink-0 text-amber-700" /><div><p className="font-bold text-amber-900">Score geral e bônus desativados</p><p className="mt-1 text-sm text-amber-800">Complete os parâmetros antes de calcular qualquer pontuação financeira.</p><ul className="mt-2 text-xs text-amber-800">{configIssues.map((issue) => <li key={issue}>• {issue}</li>)}</ul></div></CardContent></Card>}
    {!entries.length ? <EmptyState icon={Medal} title="Sem respostas no período" description="O ranking será formado conforme as gestoras enviarem seus dados." /> : <div className="grid gap-5 xl:grid-cols-2"><RankingCard title={indicator.label}>{entries.map((entry, index) => <RankRow key={entry.name} position={index + 1} name={entry.name} value={formatMetric(indicator.type, Number(entry.values[indicatorKey] ?? 0))} />)}</RankingCard>{!configIssues.length && <RankingCard title="Score geral configurado">{general.map((entry, index) => <RankRow key={entry.name} position={index + 1} name={entry.name} value={`${formatNumber(entry.score)} pontos${entry.veto ? " • veto/trava" : entry.bonus ? ` • bônus ${formatCurrency(entry.bonus.amount)}` : ""}`} />)}</RankingCard>}</div>}
  </>;
}

function Filter({ name, label, value, children }: { name: string; label: string; value: string | number; children: React.ReactNode }) { return <label className="text-xs font-bold uppercase text-slate-500">{label}<Select name={name} defaultValue={value} className="mt-1 capitalize">{children}</Select></label>; }
function RankingCard({ title, children }: { title: string; children: React.ReactNode }) { return <Card><div className="border-b px-5 py-4"><h2 className="font-black text-[#102b4e]">{title}</h2></div><div className="divide-y">{children}</div></Card>; }
function RankRow({ position, name, value }: { position: number; name: string; value: string }) { return <div className="flex items-center gap-4 px-5 py-4"><div className={`grid size-9 place-items-center rounded-full font-black ${position === 1 ? "bg-orange-100 text-[#d96c12]" : "bg-slate-100 text-slate-600"}`}>{position}</div><div className="min-w-0 flex-1"><p className="truncate font-bold text-[#102b4e]">{name}</p></div><Badge variant={position === 1 ? "warning" : "default"}>{value}</Badge></div>; }
function formatMetric(type: string, value: number) { if (type === "currency") return formatCurrency(value); if (type === "percent") return formatPercent(value); return formatNumber(value); }
