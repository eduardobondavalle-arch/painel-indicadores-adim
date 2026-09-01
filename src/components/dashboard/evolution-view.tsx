"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { calculateMetrics } from "@/lib/calculations";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";

type Row = { id: string; manager_id: string; submitted_manager_name: string; reference_month: number; reference_year: number; values: Record<string, string | number> };
const metrics = [
  { key: "contratos_ativos_fim_mes", label: "Contratos ativos", format: "number" }, { key: "contratos_renovados", label: "Renovações", format: "number" }, { key: "total_rescisoes", label: "Rescisões", format: "number" },
  { key: "taxa_retencao_desocupados", label: "Retenção de imóveis", format: "percent" }, { key: "chamados_abertos", label: "Chamados", format: "number" }, { key: "taxa_chamados_sla", label: "SLA", format: "percent" },
  { key: "taxa_retrabalho_calculada", label: "Retrabalho", format: "percent" }, { key: "nps_proprietarios", label: "NPS proprietários", format: "number" }, { key: "nps_locatarios", label: "NPS locatários", format: "number" },
  { key: "contratos_migrados_garantida", label: "Migrações garantidas", format: "number" }, { key: "cash_go_adesoes", label: "Cash Go", format: "number" }, { key: "imoveis_locados_incorporados", label: "Imóveis incorporados", format: "number" },
];

export function EvolutionView({ responses, selectedManager }: { responses: Row[]; selectedManager?: string }) {
  const [metricKey, setMetricKey] = useState("contratos_ativos_fim_mes");
  const [granularity, setGranularity] = useState<"month" | "quarter">("month");
  const metric = metrics.find((item) => item.key === metricKey)!;
  const chartData = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const response of responses) {
      const label = granularity === "month" ? `${String(response.reference_month).padStart(2, "0")}/${response.reference_year}` : `T${Math.ceil(response.reference_month / 3)}/${response.reference_year}`;
      groups.set(label, [...(groups.get(label) ?? []), response]);
    }
    return [...groups.entries()].map(([period, rows]) => {
      const extract = (row: Row) => {
        const direct = row.values[metricKey];
        if (direct != null) return Number(direct);
        return calculateMetrics(row.values).find((item) => item.key === metricKey)?.value ?? 0;
      };
      const team = rows.reduce((sum, row) => sum + Number(extract(row) ?? 0), 0) / rows.length;
      const ownRows = selectedManager ? rows.filter((row) => row.manager_id === selectedManager) : [];
      const own = ownRows.length ? ownRows.reduce((sum, row) => sum + Number(extract(row) ?? 0), 0) / ownRows.length : null;
      return { period, equipe: Number(team.toFixed(2)), gestora: own == null ? null : Number(own.toFixed(2)) };
    });
  }, [granularity, metricKey, responses, selectedManager]);
  if (!responses.length) return <EmptyState icon={Activity} title="Sem histórico no período" description="Amplie o intervalo ou escolha outra gestora." />;
  return <div className="space-y-5"><Card><CardContent className="grid gap-4 p-4 sm:grid-cols-2"><label className="text-xs font-bold uppercase text-slate-500">Indicador<Select className="mt-1" value={metricKey} onChange={(event) => setMetricKey(event.target.value)}>{metrics.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</Select></label><label className="text-xs font-bold uppercase text-slate-500">Período<Select className="mt-1" value={granularity} onChange={(event) => setGranularity(event.target.value as "month" | "quarter")}><option value="month">Mês contra mês</option><option value="quarter">Trimestre</option></Select></label></CardContent></Card><Card><CardHeader><CardTitle>{metric.label}</CardTitle><p className="mt-1 text-sm text-slate-500">{selectedManager ? "Gestora selecionada comparada à média da equipe." : "Média mensal da equipe."}</p></CardHeader><CardContent><div className="h-[420px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(value) => metric.format === "percent" ? formatPercent(Number(value)) : formatNumber(Number(value))} /><Legend /><Line type="monotone" dataKey="equipe" name="Média da equipe" stroke="var(--chart-2)" strokeWidth={3} dot={{ r: 4 }} />{selectedManager && <Line type="monotone" dataKey="gestora" name="Gestora" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4 }} connectNulls />}</LineChart></ResponsiveContainer></div></CardContent></Card></div>;
}
