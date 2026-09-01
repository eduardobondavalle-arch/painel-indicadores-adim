import { notFound } from "next/navigation";
import { AlertTriangle, Calculator, FileClock, LockKeyhole } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { calculateMetrics, rateDivergences } from "@/lib/calculations";
import { BLOCKS, INDICATOR_BY_KEY } from "@/lib/indicators";
import { formatNumber, formatPercent } from "@/lib/utils";
import { ExportButtons } from "@/components/dashboard/export-buttons";
import { PageHeader } from "@/components/dashboard/page-header";
import { ResponseEditor, ResponseNoteEditor } from "@/components/dashboard/response-editor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ValueRow = { indicator_key: string; indicator_number: number; block_number: number; label: string; value_type: string; value_numeric: number | string | null; value_text: string | null; original_numeric: number | string | null; original_text: string | null };
type AlertRow = { id: string; code: string; message: string; created_at: string };
type HistoryRow = { id: string; field_key: string; old_value: unknown; new_value: unknown; justification: string; changed_at: string; admin_users: { display_name: string; email: string } | null };
type ResponseRow = { id: string; submitted_manager_name: string; submitted_manager_email: string; reference_month: number; reference_year: number; protocol: string; status: string; submitted_at: string; updated_at: string; administrative_notes: string | null; consistency_alert_count: number };

function displayValue(value: ValueRow, original = false) {
  const raw = original ? (value.value_type === "text" ? value.original_text : value.original_numeric) : (value.value_type === "text" ? value.value_text : value.value_numeric);
  if (value.value_type === "percent") return formatPercent(raw as number | string | null);
  if (value.value_type === "currency") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(raw ?? 0));
  if (value.value_type === "decimal") return formatNumber(raw as number | string | null);
  return raw == null || raw === "" ? "—" : String(raw);
}

function historyValue(value: unknown) {
  if (value == null) return "vazio";
  if (typeof value === "object") {
    const record = value as { numeric?: unknown; text?: unknown };
    return String(record.text ?? record.numeric ?? JSON.stringify(value));
  }
  return String(value);
}

export default async function ResponseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireStaff();
  const [responseResult, valuesResult, alertsResult, historyResult] = await Promise.all([
    supabase.from("responses").select("id,submitted_manager_name,submitted_manager_email,reference_month,reference_year,protocol,status,submitted_at,updated_at,administrative_notes,consistency_alert_count").eq("id", id).maybeSingle(),
    supabase.from("response_values").select("indicator_key,indicator_number,block_number,label,value_type,value_numeric,value_text,original_numeric,original_text").eq("response_id", id).order("indicator_number"),
    supabase.from("consistency_alerts").select("id,code,message,created_at").eq("response_id", id).order("created_at"),
    supabase.from("change_history").select("id,field_key,old_value,new_value,justification,changed_at,admin_users(display_name,email)").eq("response_id", id).order("changed_at", { ascending: false }),
  ]);
  if (!responseResult.data) notFound();
  const response = responseResult.data as ResponseRow;
  const values = (valuesResult.data ?? []) as ValueRow[];
  const alerts = (alertsResult.data ?? []) as AlertRow[];
  const history = (historyResult.data ?? []) as unknown as HistoryRow[];
  const valueMap = Object.fromEntries(values.map((value) => [value.indicator_key, value.value_type === "text" ? value.value_text ?? "" : Number(value.value_numeric ?? 0)]));
  const calculated = calculateMetrics(valueMap);
  const divergences = rateDivergences(valueMap);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(response.reference_year, response.reference_month - 1, 1));

  return (
    <>
      <PageHeader eyebrow={`Protocolo ${response.protocol}`} title={response.submitted_manager_name} description={`${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} • enviado em ${new Date(response.submitted_at).toLocaleString("pt-BR")}`} actions={<ExportButtons responseId={response.id} month={response.reference_month} year={response.reference_year} manager={response.submitted_manager_name} />} />
      <div className="mb-5 grid gap-4 md:grid-cols-4"><InfoCard label="E-mail informado" value={response.submitted_manager_email} /><InfoCard label="Status" value={response.status} /><InfoCard label="Alertas" value={String(response.consistency_alert_count)} /><InfoCard label="Última atualização" value={new Date(response.updated_at).toLocaleString("pt-BR")} /></div>
      {alerts.length > 0 && <Card className="mb-5 border-amber-300 bg-amber-50"><CardHeader><div className="flex gap-3"><AlertTriangle className="size-6 shrink-0 text-amber-700" /><div><CardTitle className="text-amber-900">Alertas confirmados no envio</CardTitle><p className="mt-1 text-sm text-amber-800">Os valores originais foram preservados.</p></div></div></CardHeader><CardContent><ul className="space-y-2 text-sm text-amber-900">{alerts.map((alert) => <li key={alert.id}>• {alert.message}</li>)}</ul></CardContent></Card>}
      <Card className="mb-5 border-blue-200 bg-blue-50/50"><CardHeader><div className="flex items-center gap-3"><Calculator className="size-6 text-[#102b4e]" /><div><CardTitle>Indicadores calculados pelo sistema</CardTitle><p className="mt-1 text-sm text-slate-500">Calculados sem alterar os valores declarados.</p></div></div></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{calculated.map((metric) => <div key={metric.key} className="rounded-xl border border-blue-100 bg-white p-4"><Badge>Calculado pelo sistema</Badge><p className="mt-3 text-sm text-slate-500">{metric.label}</p><p className="mt-1 text-xl font-black text-[#102b4e]">{metric.value == null ? "—" : metric.format === "percent" ? formatPercent(metric.value) : formatNumber(metric.value)}</p></div>)}</CardContent>{divergences.length > 0 && <div className="border-t border-blue-100 px-6 py-4 text-sm font-semibold text-amber-800">{divergences.map((item) => <p key={item.informedKey}>A {item.label} informada ({formatPercent(item.informed)}) diverge da calculada ({formatPercent(item.calculated)}).</p>)}</div>}</Card>
      <div className="space-y-5">
              {BLOCKS.map((block) => <Card key={block.number} className="print-card"><CardHeader className="border-b border-slate-100"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#d96c12]">Bloco {block.number}</p><CardTitle className="mt-1">{block.title}</CardTitle></CardHeader><CardContent className="divide-y divide-slate-100">{values.filter((value) => value.block_number === block.number).map((value) => { const definition = INDICATOR_BY_KEY[value.indicator_key]; const changed = displayValue(value) !== displayValue(value, true); return <div key={value.indicator_key} className={`py-4 ${definition?.restricted ? "rounded-lg bg-purple-50 px-3" : ""}`}><div className="grid gap-3 lg:grid-cols-[1fr_260px_auto] lg:items-start"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm text-slate-600"><span className="mr-1 font-bold text-[#d96c12]">{value.indicator_number}.</span>{definition?.label ?? value.label}</p>{definition?.restricted && <Badge variant="restricted"><LockKeyhole className="mr-1 size-3" />Gerencial restrito</Badge>}</div><div className="mt-2 flex flex-wrap gap-2"><Badge>Informado pela gestora</Badge>{changed && <Badge variant="warning">Alterado pela gestão</Badge>}</div></div><div><p className="break-words text-base font-bold text-[#102b4e]">{displayValue(value)}</p>{changed && <p className="mt-1 text-xs text-slate-400">Original: {displayValue(value, true)}</p>}</div>{profile.role === "admin" && ["submitted", "reopened"].includes(response.status) && <ResponseEditor responseId={id} value={value} />}</div></div>; })}</CardContent></Card>)}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Observações administrativas</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm text-slate-600">{response.administrative_notes || "Nenhuma observação registrada."}</p>{profile.role === "admin" && <ResponseNoteEditor responseId={id} currentNote={response.administrative_notes ?? ""} />}</CardContent></Card>
        <Card><CardHeader><div className="flex items-center gap-2"><FileClock className="size-5 text-[#d96c12]" /><CardTitle>Histórico de alterações</CardTitle></div></CardHeader><CardContent>{history.length ? <div className="space-y-4">{history.map((item) => <div key={item.id} className="border-l-2 border-orange-300 pl-3"><p className="text-sm font-bold text-[#102b4e]">{INDICATOR_BY_KEY[item.field_key]?.label ?? item.field_key}</p><p className="mt-1 text-xs text-slate-500">{item.admin_users?.display_name ?? "Administrador"} • {new Date(item.changed_at).toLocaleString("pt-BR")}</p><p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">Anterior: {historyValue(item.old_value)} → Novo: {historyValue(item.new_value)}</p><p className="mt-1 text-sm text-slate-600">Justificativa: {item.justification}</p></div>)}</div> : <p className="text-sm text-slate-500">Nenhuma alteração administrativa. Os dados permanecem como enviados.</p>}</CardContent></Card>
      </div>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 break-words text-sm font-bold capitalize text-[#102b4e]">{value}</p></CardContent></Card>;
}
