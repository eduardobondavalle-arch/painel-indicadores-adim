"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownWideNarrow, BarChart3, Users } from "lucide-react";
import { BLOCKS, INDICATORS, indicatorsForBlock } from "@/lib/indicators";
import type { PerformanceResult } from "@/lib/scoring";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";

type ManagerData = { id: string; managerId: string | null; name: string; email: string; values: Record<string, string | number>; performance: PerformanceResult };

export function ComparisonView({ data, highlightedManager }: { data: ManagerData[]; highlightedManager?: string }) {
  const numericIndicators = INDICATORS.filter((indicator) => indicator.type !== "text");
  const [sortKey, setSortKey] = useState("contratos_ativos_fim_mes");
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const [chartKey, setChartKey] = useState("contratos_ativos_fim_mes");
  const sorted = useMemo(() => [...data].sort((a, b) => {
    if (highlightedManager) {
      if (a.managerId === highlightedManager) return -1;
      if (b.managerId === highlightedManager) return 1;
    }
    const diff = Number(a.values[sortKey] ?? 0) - Number(b.values[sortKey] ?? 0);
    return direction === "desc" ? -diff : diff;
  }), [data, direction, highlightedManager, sortKey]);
  if (!data.length) return <EmptyState icon={Users} title="Sem dados para comparar" description="Nenhuma gestora possui resposta ativa no período escolhido." />;
  const chartIndicator = INDICATORS.find((indicator) => indicator.key === chartKey)!;
  const chartData = sorted.map((manager) => ({ name: manager.name.split(" ")[0], value: Number(manager.values[chartKey] ?? 0) }));
  return <div className="space-y-5"><Card><CardHeader><CardTitle>Comparação da bonificação oficial</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Gestora</th><th className="p-2">Score geral</th>{Array.from({ length: 5 }, (_, i) => <th className="p-2" key={i}>Pilar {i + 1}</th>)}<th className="p-2">Performance</th><th className="p-2">Cash Go</th><th className="p-2">Total</th></tr></thead><tbody>{sorted.map(manager => <tr key={manager.id} className="border-b"><td className="p-2 font-bold">{manager.name}</td><td className="p-2">{manager.performance.score === null ? "Pendente" : `${formatNumber(manager.performance.score)}%`}</td>{manager.performance.pillarScores.map(p => <td key={p.number} className="p-2">{p.score === null ? "Pendente" : `${formatNumber(p.score)}%`}</td>)}<td className="p-2">{manager.performance.bonus === null ? "Pendente" : formatCurrency(manager.performance.bonus)}</td><td className="p-2">{manager.performance.cashGo === null ? "Pendente" : formatCurrency(manager.performance.cashGo)}</td><td className="p-2">{manager.performance.total === null ? "Pendente" : formatCurrency(manager.performance.total)}</td></tr>)}</tbody></table></div></CardContent></Card><Card><CardContent className="grid gap-4 p-4 md:grid-cols-3"><label className="text-xs font-bold uppercase tracking-wide text-slate-500"><span className="flex items-center gap-1"><ArrowDownWideNarrow className="size-3.5" />Ordenar gestoras por</span><Select className="mt-1" value={sortKey} onChange={(event) => setSortKey(event.target.value)}>{numericIndicators.map((indicator) => <option key={indicator.key} value={indicator.key}>{indicator.number}. {indicator.label}</option>)}</Select></label><label className="text-xs font-bold uppercase tracking-wide text-slate-500">Ordem<Select className="mt-1" value={direction} onChange={(event) => setDirection(event.target.value as "asc" | "desc")}><option value="desc">Maior para menor</option><option value="asc">Menor para maior</option></Select></label><label className="text-xs font-bold uppercase tracking-wide text-slate-500">Gráfico isolado<Select className="mt-1" value={chartKey} onChange={(event) => setChartKey(event.target.value)}>{numericIndicators.map((indicator) => <option key={indicator.key} value={indicator.key}>{indicator.number}. {indicator.label}</option>)}</Select></label></CardContent></Card>
    <Card><CardHeader><div className="flex items-center gap-2"><BarChart3 className="size-5 text-[#d96c12]" /><CardTitle>{chartIndicator.label}</CardTitle></div><p className="mt-1 text-xs text-slate-500">Uma escala por gráfico para evitar comparações enganosas.</p></CardHeader><CardContent><div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ left: 5, right: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(value) => formatValue(chartIndicator.type, Number(value))} /><Bar dataKey="value" fill="var(--chart-1)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
    {BLOCKS.map((block) => <Card key={block.number}><CardHeader className="border-b"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d96c12]">Bloco {block.number}</p><CardTitle className="mt-1">{block.title}</CardTitle></CardHeader><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b bg-slate-50"><tr><th className="sticky left-0 z-10 min-w-72 bg-slate-50 px-5 py-3 text-left text-xs uppercase text-slate-500">Indicador</th>{sorted.map((manager) => <th key={manager.id} className={`min-w-36 px-3 py-3 text-right text-xs text-[#102b4e] ${manager.managerId === highlightedManager ? "bg-orange-50" : ""}`}>{manager.name}</th>)}<th className="min-w-28 px-3 py-3 text-right text-xs text-slate-500">Média</th><th className="min-w-28 px-3 py-3 text-right text-xs text-emerald-700">Maior</th><th className="min-w-28 px-3 py-3 text-right text-xs text-red-600">Menor</th></tr></thead><tbody className="divide-y">{indicatorsForBlock(block.number).map((indicator) => { const numeric = indicator.type !== "text"; const numbers = numeric ? sorted.map((manager) => Number(manager.values[indicator.key] ?? 0)) : []; const average = numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0; return <tr key={indicator.key}><td className="sticky left-0 z-10 bg-white px-5 py-3 text-slate-600"><span className="mr-1 font-bold text-[#d96c12]">{indicator.number}.</span>{indicator.label}{indicator.restricted && <Badge variant="restricted" className="ml-2">Restrito</Badge>}</td>{sorted.map((manager) => <td key={manager.id} className={`px-3 py-3 text-right font-semibold text-[#102b4e] ${manager.managerId === highlightedManager ? "bg-orange-50" : ""}`}>{numeric ? formatValue(indicator.type, Number(manager.values[indicator.key] ?? 0)) : <span className="block max-w-52 truncate" title={String(manager.values[indicator.key] ?? "")}>{String(manager.values[indicator.key] || "—")}</span>}</td>)}<td className="bg-slate-50/60 px-3 py-3 text-right font-bold">{numeric ? formatValue(indicator.type, average) : "—"}</td><td className="bg-emerald-50/50 px-3 py-3 text-right font-bold text-emerald-700">{numeric ? formatValue(indicator.type, Math.max(...numbers)) : "—"}</td><td className="bg-red-50/40 px-3 py-3 text-right font-bold text-red-700">{numeric ? formatValue(indicator.type, Math.min(...numbers)) : "—"}</td></tr>; })}</tbody></table></div></Card>)}
  </div>;
}

function formatValue(type: string, value: number) {
  if (type === "currency") return formatCurrency(value);
  if (type === "percent") return formatPercent(value);
  return formatNumber(value);
}
