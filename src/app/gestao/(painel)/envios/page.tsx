import Link from "next/link";
import { AlertTriangle, Download, Eye, Files, GitCompareArrows } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { ResponseActions } from "@/components/dashboard/response-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";

type SearchParams = Promise<{ mes?: string; ano?: string; gestora?: string; status?: string; alertas?: string }>;
type ManagerRow = { id: string; name: string; email: string };
type ResponseRow = { id: string; manager_id: string | null; submitted_manager_name: string; submitted_manager_email: string; reference_month: number; reference_year: number; submitted_at: string; protocol: string; status: string; consistency_alert_count: number };

const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  submitted: { label: "Enviado", variant: "success" }, reopened: { label: "Reaberto", variant: "warning" }, replaced: { label: "Substituído", variant: "default" }, deleted: { label: "Excluído", variant: "danger" },
};

export default async function SubmissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const today = new Date();
  const month = Number(params.mes) || today.getMonth() + 1;
  const year = Number(params.ano) || today.getFullYear();
  const { supabase, profile } = await requireStaff();
  const managersResult = await supabase.from("managers").select("id,name,email").order("name");
  let query = supabase.from("responses").select("id,manager_id,submitted_manager_name,submitted_manager_email,reference_month,reference_year,submitted_at,protocol,status,consistency_alert_count").eq("reference_month", month).eq("reference_year", year).order("submitted_at", { ascending: false });
  if (params.gestora) query = query.eq("manager_id", params.gestora);
  if (params.status) query = query.eq("status", params.status);
  if (params.alertas === "sim") query = query.gt("consistency_alert_count", 0);
  if (params.alertas === "nao") query = query.eq("consistency_alert_count", 0);
  const result = await query;
  const managers = (managersResult.data ?? []) as ManagerRow[];
  const responses = (result.data ?? []) as ResponseRow[];

  return (
    <>
      <PageHeader eyebrow="Base de respostas" title="Envios" description="Filtre, consulte, compare, reabra ou exclua logicamente os registros mensais." actions={<><Button asChild variant="outline"><a href={`/api/admin/export?type=monthly&format=xlsx&mes=${month}&ano=${year}`}><Download className="size-4" />Consolidação</a></Button><Button asChild variant="outline"><a href={`/api/admin/export?type=restricted&format=xlsx&mes=${month}&ano=${year}`}><Download className="size-4" />Gerencial restrito</a></Button><Button asChild variant="outline"><a href={`/api/admin/export?type=history&format=xlsx&mes=${month}&ano=${year}`}><Download className="size-4" />Histórico</a></Button></>} />
      <Card className="mb-5"><CardContent className="p-4"><form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Filter label="Mês" name="mes" value={month}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, index, 1))}</option>)}</Filter><Filter label="Ano" name="ano" value={year}>{Array.from({ length: 7 }, (_, index) => <option key={today.getFullYear() + 1 - index}>{today.getFullYear() + 1 - index}</option>)}</Filter><Filter label="Gestora" name="gestora" value={params.gestora ?? ""}><option value="">Todas</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</Filter><Filter label="Status" name="status" value={params.status ?? ""}><option value="">Todos</option><option value="submitted">Enviado</option><option value="reopened">Reaberto</option><option value="replaced">Substituído</option><option value="deleted">Excluído</option></Filter><Filter label="Alertas" name="alertas" value={params.alertas ?? ""}><option value="">Todos</option><option value="sim">Com alertas</option><option value="nao">Sem alertas</option></Filter><div className="flex items-end"><Button type="submit" className="w-full">Filtrar</Button></div></form></CardContent></Card>
      {result.error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error.message}</div>}
      {!responses.length ? <EmptyState icon={Files} title="Nenhum envio encontrado" description="Ajuste os filtros ou aguarde o recebimento dos formulários deste período." /> : (
        <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Gestora</th><th className="px-4 py-3">Referência</th><th className="px-4 py-3">Envio</th><th className="px-4 py-3">Protocolo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Alertas</th><th className="px-5 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{responses.map((response) => { const status = statusLabels[response.status] ?? statusLabels.submitted; const comparisonUrl = `/gestao/comparativo?mes=${response.reference_month}&ano=${response.reference_year}${response.manager_id ? `&gestora=${response.manager_id}` : ""}`; return <tr key={response.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-bold text-[#102b4e]">{response.submitted_manager_name}</p><p className="mt-0.5 text-xs text-slate-500">{response.submitted_manager_email}</p></td><td className="px-4 py-4">{String(response.reference_month).padStart(2, "0")}/{response.reference_year}</td><td className="px-4 py-4"><p>{new Date(response.submitted_at).toLocaleDateString("pt-BR")}</p><p className="text-xs text-slate-400">{new Date(response.submitted_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></td><td className="px-4 py-4 font-mono text-xs">{response.protocol}</td><td className="px-4 py-4"><Badge variant={status.variant}>{status.label}</Badge></td><td className="px-4 py-4">{response.consistency_alert_count ? <span className="flex items-center gap-1 font-bold text-amber-700"><AlertTriangle className="size-4" />{response.consistency_alert_count}</span> : <span className="text-emerald-700">Sem alertas</span>}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button asChild variant="ghost" size="sm"><Link href={`/gestao/envios/${response.id}`}><Eye className="size-4" />Visualizar</Link></Button><Button asChild variant="ghost" size="sm"><Link href={comparisonUrl}><GitCompareArrows className="size-4" />Comparar</Link></Button>{profile.role === "admin" && <ResponseActions id={response.id} status={response.status} />}</div></td></tr>; })}</tbody></table></div></Card>
      )}
    </>
  );
}

function Filter({ label, name, value, children }: { label: string; name: string; value: string | number; children: React.ReactNode }) {
  return <label className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}<Select name={name} defaultValue={value} className="mt-1 capitalize">{children}</Select></label>;
}
