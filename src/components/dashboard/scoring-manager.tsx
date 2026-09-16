"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OFFICIAL_KPIS, scoringConfigurationIssues, type BonusRange, type Pillar, type ScoringParameter } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const number = (value: string) => value === "" ? null : Number(value);

export function ScoringManager({ initialPillars, initialParameters, initialBonuses, canEdit }: { initialPillars: Pillar[]; initialParameters: ScoringParameter[]; initialBonuses: BonusRange[]; canEdit: boolean }) {
  const router = useRouter();
  const [pillars, setPillars] = useState(initialPillars.map(item => ({ ...item, weight: number(String(item.weight ?? "")), minimum_lock: number(String(item.minimum_lock ?? "")), complaint_absence_weight: number(String(item.complaint_absence_weight ?? "")) })));
  const [parameters, setParameters] = useState(initialParameters.filter(item => OFFICIAL_KPIS.some(k => k.key === item.indicator_key)).map(item => ({ ...item, weight: number(String(item.weight ?? "")), minimum_goal: number(String(item.minimum_goal ?? "")), maximum_goal: number(String(item.maximum_goal ?? "")) })));
  const [bonuses, setBonuses] = useState(initialBonuses.map(item => ({ ...item, minimum_score: number(String(item.minimum_score ?? "")), amount: Number(item.amount) })));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const issues = useMemo(() => scoringConfigurationIssues(pillars, parameters, bonuses), [pillars, parameters, bonuses]);
  const parameterMap = new Map(parameters.map(item => [item.indicator_key, item]));
  function updatePillar(index: number, patch: Partial<Pillar>) { setPillars(items => items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function updateParameter(key: string, patch: Partial<ScoringParameter>) { setParameters(items => items.map(item => item.indicator_key === key ? { ...item, ...patch } : item)); }
  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/scoring", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pillars, parameters, bonuses, justification: reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      setMessage("Régua versionada e salva. Períodos já fechados preservam a versão anterior."); setReason(""); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  return <div className="space-y-5">
    <Card className={issues.length ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}><CardContent className="p-5 text-sm"><p className="font-bold">{issues.length ? "Régua incompleta: cálculos financeiros suspensos" : "Régua válida: 15 KPIs e cinco pilares"}</p>{issues.map(issue => <p key={issue} className="mt-1 text-amber-800">• {issue}</p>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Pesos gerais e trava dos cinco pilares</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{pillars.map((pillar, index) => <div key={pillar.id} className="rounded-xl border p-3"><p className="font-bold">{pillar.pillar_number}. {pillar.name}</p><Label>Peso geral (%)<Input disabled={!canEdit} type="number" value={pillar.weight ?? ""} onChange={event => updatePillar(index, { weight: number(event.target.value) })} /></Label><Label>Trava (%)<Input disabled={!canEdit} type="number" value={pillar.minimum_lock ?? ""} onChange={event => updatePillar(index, { minimum_lock: number(event.target.value) })} /></Label>{pillar.pillar_number === 5 && <Label className="block">Ausência de reclamação formal — peso interno (%)<Input disabled={!canEdit} type="number" min={0} max={100} value={pillar.complaint_absence_weight ?? ""} onChange={event => updatePillar(index, { complaint_absence_weight: number(event.target.value) })} /><span className="text-xs font-normal text-slate-500">Ajustável; compõe 100% do Pilar 5 com I13–I15. Reclamação atribuível zera todo o pilar.</span></Label>}</div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>15 KPIs oficiais</CardTitle><p className="text-sm text-slate-500">Metas mínima/máxima em ordem numérica; para tempos e retrabalho, a menor meta é a de 100%.</p></CardHeader><div className="overflow-x-auto"><table className="w-full min-w-[930px] text-sm"><thead className="bg-slate-50"><tr>{["KPI / pilar", "Peso (%)", "Meta menor", "Meta maior", "Direção"].map(label => <th key={label} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{OFFICIAL_KPIS.map(kpi => { const param = parameterMap.get(kpi.key); return <tr key={kpi.key} className="border-t"><td className="p-3"><strong>I{kpi.number}</strong> — {kpi.name}<span className="block text-xs text-slate-500">Pilar {kpi.pillar}</span></td><td className="p-3"><Input disabled={!canEdit || !param} type="number" min={0} max={100} value={param?.weight ?? ""} onChange={event => updateParameter(kpi.key, { weight: number(event.target.value) })} /></td><td className="p-3"><Input disabled={!canEdit || !param} type="number" step="any" value={param?.minimum_goal ?? ""} onChange={event => updateParameter(kpi.key, { minimum_goal: number(event.target.value) })} /></td><td className="p-3"><Input disabled={!canEdit || !param} type="number" step="any" value={param?.maximum_goal ?? ""} onChange={event => updateParameter(kpi.key, { maximum_goal: number(event.target.value) })} /></td><td className="p-3"><Select disabled={!canEdit || !param} value={param?.direction ?? kpi.direction} onChange={event => updateParameter(kpi.key, { direction: event.target.value as ScoringParameter["direction"] })}><option value="higher_is_better">Maior é melhor</option><option value="lower_is_better">Menor é melhor</option></Select></td></tr>; })}</tbody></table></div></Card>
    <Card><CardHeader><CardTitle>Faixas de bonificação</CardTitle><p className="text-sm text-slate-500">R$ 0 abaixo de 50; R$ 300 a partir de 50; R$ 500 a partir de 70; R$ 800 a partir de 90 somente com todos os pilares acima da trava.</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{bonuses.map(bonus => <div key={bonus.id} className="rounded-xl border p-3"><Label>{bonus.label} — R$ {bonus.amount}<Input disabled={!canEdit} type="number" min={0} max={100} value={bonus.minimum_score ?? ""} onChange={event => setBonuses(items => items.map(item => item.id === bonus.id ? { ...item, minimum_score: number(event.target.value) } : item))} /></Label></div>)}</CardContent></Card>
    {canEdit && <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end"><Label className="flex-1">Justificativa para nova versão da régua<Input value={reason} onChange={event => setReason(event.target.value)} placeholder="Motivo da alteração dos parâmetros" /></Label><Button variant="accent" disabled={saving || issues.length > 0 || reason.trim().length < 5} onClick={save}>{saving ? "Salvando..." : "Salvar nova versão"}</Button></CardContent></Card>}
    {error && <p className="text-sm text-red-700">{error}</p>}{message && <p className="text-sm text-emerald-700">{message}</p>}
  </div>;
}
