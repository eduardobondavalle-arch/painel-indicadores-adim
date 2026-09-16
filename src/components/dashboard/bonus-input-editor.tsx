"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BonusInputs } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export const BONUS_FIELD_LABELS: Record<keyof BonusInputs, string> = {
  eligible_renewals: "Renovações elegíveis à taxa", adjustments_due: "Reajustes devidos",
  adjustments_on_time: "Reajustes corretos e no prazo", eligible_vacancies: "Desocupações elegíveis",
  maintenance_csat: "CSAT manutenção (1–5)", owner_satisfaction_scale: "Escala proprietários",
  tenant_satisfaction_scale: "Escala locatários", directorate_complaints_attributable: "Reclamações da diretoria atribuíveis",
  cash_go_verified: "Adesões Cash Go verificadas", capture_fee_amount: "Bônus captação (R$)",
  migration_commission_amount: "Comissão migração (R$)",
};

export function BonusInputEditor({ responseId, facts, canEdit }: { responseId: string; facts: BonusInputs; canEdit: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<BonusInputs>({ ...facts,
    owner_satisfaction_scale: facts.owner_satisfaction_scale ?? "nps",
    tenant_satisfaction_scale: facts.tenant_satisfaction_scale ?? "nps" });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function save(field: keyof BonusInputs) {
    setSaving(field); setError("");
    try {
      const isScale = field.endsWith("_scale");
      const response = await fetch(`/api/admin/responses/${responseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bonus", field, valueNumeric: isScale ? null : Number(values[field]), valueText: isScale ? values[field] : null, justification: reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      setReason(""); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao salvar."); }
    finally { setSaving(null); }
  }
  return <Card className="mt-5"><CardHeader><CardTitle>Dados complementares da régua</CardTitle><p className="text-sm text-slate-500">Registros antigos permanecem pendentes até conferência. Apenas a gestão pode verificar Cash Go, reclamar atribuição e ajustar valores com justificativa.</p></CardHeader><CardContent>
    {canEdit && <label className="mb-4 block text-sm font-semibold">Justificativa obrigatória para qualquer ajuste<Input className="mt-1" value={reason} minLength={5} onChange={event => setReason(event.target.value)} placeholder="Explique a origem da correção" /></label>}
    <div className="grid gap-4 md:grid-cols-2">{(Object.keys(BONUS_FIELD_LABELS) as (keyof BonusInputs)[]).map(field => <div key={field} className="rounded-xl border bg-slate-50 p-3"><label className="block text-sm font-semibold">{BONUS_FIELD_LABELS[field]}</label><div className="mt-2 flex gap-2">{field.endsWith("_scale") ? <Select disabled={!canEdit} value={values[field] ?? ""} onChange={event => setValues(current => ({ ...current, [field]: event.target.value }))}><option value="">Pendente</option><option value="nps">NPS 0–100</option>{values[field] === "csat_0_100" && <option value="csat_0_100">CSAT histórico (não pontua como NPS)</option>}</Select> : <Input disabled={!canEdit} type="number" min={0} max={field === "maintenance_csat" ? 5 : undefined} step={["maintenance_csat", "capture_fee_amount", "migration_commission_amount"].includes(field) ? 0.01 : 1} placeholder="Pendente" value={values[field] ?? ""} onChange={event => setValues(current => ({ ...current, [field]: event.target.value === "" ? null : Number(event.target.value) }))} />}{canEdit && <Button type="button" disabled={saving !== null || reason.trim().length < 5 || values[field] == null} onClick={() => save(field)}>{saving === field ? "..." : "Salvar"}</Button>}</div></div>)}</div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </CardContent></Card>;
}
