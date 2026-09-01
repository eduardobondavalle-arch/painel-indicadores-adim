import { Download, History } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { INDICATOR_BY_KEY } from "@/lib/indicators";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type SearchParams = Promise<{ mes?: string; ano?: string }>;
type LogRow = { id: number; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string; admin_users: { display_name: string; email: string } | null };
type ChangeRow = { id: string; response_id: string; field_key: string; old_value: unknown; new_value: unknown; justification: string; changed_at: string; admin_users: { display_name: string; email: string } | null; responses: { submitted_manager_name: string; protocol: string } | null };

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams; const now = new Date(); const month = Number(params.mes) || now.getMonth() + 1; const year = Number(params.ano) || now.getFullYear();
  const { supabase } = await requireStaff();
  const [logsResult, changesResult] = await Promise.all([
    supabase.from("admin_logs").select("id,action,entity_type,entity_id,metadata,created_at,admin_users(display_name,email)").order("created_at", { ascending: false }).limit(100),
    supabase.from("change_history").select("id,response_id,field_key,old_value,new_value,justification,changed_at,admin_users(display_name,email),responses(submitted_manager_name,protocol)").order("changed_at", { ascending: false }).limit(100),
  ]);
  const logs = (logsResult.data ?? []) as unknown as LogRow[]; const changes = (changesResult.data ?? []) as unknown as ChangeRow[];
  return <><PageHeader eyebrow="Rastreabilidade" title="Auditoria" description="Registro cronológico de alterações de dados e ações administrativas." actions={<Button asChild variant="outline"><a href={`/api/admin/export?type=history&format=xlsx&mes=${month}&ano=${year}`}><Download className="size-4" />Exportar histórico do período</a></Button>} />
    <div className="grid gap-5 xl:grid-cols-2"><section><h2 className="mb-3 font-black text-[#102b4e]">Alterações em respostas</h2>{changes.length ? <Card className="divide-y">{changes.map((change) => <article key={change.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-[#102b4e]">{INDICATOR_BY_KEY[change.field_key]?.label ?? change.field_key}</p><p className="mt-1 text-xs text-slate-500">{change.responses?.submitted_manager_name ?? "Resposta"} • {change.responses?.protocol}</p></div><Badge variant="warning">Alteração</Badge></div><p className="mt-3 text-sm text-slate-600">{change.justification}</p><p className="mt-2 text-xs text-slate-400">{change.admin_users?.display_name ?? "Administrador"} • {new Date(change.changed_at).toLocaleString("pt-BR")}</p></article>)}</Card> : <EmptyState icon={History} title="Nenhuma alteração" description="A trilha aparecerá quando um administrador ajustar uma resposta." />}</section>
    <section><h2 className="mb-3 font-black text-[#102b4e]">Logs administrativos</h2>{logs.length ? <Card className="divide-y">{logs.map((log) => <article key={log.id} className="flex items-start gap-3 p-5"><div className="mt-1 size-2 shrink-0 rounded-full bg-[#f28b30]" /><div><p className="font-bold text-[#102b4e]">{humanAction(log.action)}</p><p className="mt-1 text-xs text-slate-500">{log.admin_users?.display_name ?? "Sistema"} • {new Date(log.created_at).toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-slate-400">{log.entity_type}{log.entity_id ? ` • ${log.entity_id}` : ""}</p></div></article>)}</Card> : <EmptyState icon={History} title="Nenhum log" description="As ações administrativas futuras aparecerão aqui." />}</section></div>
  </>;
}

function humanAction(action: string) { const map: Record<string, string> = { "manager.created": "Gestora cadastrada", "manager.updated": "Cadastro de gestora atualizado", "period.created": "Período criado", "period.open": "Período aberto", "period.closed": "Período fechado", "response.reopened": "Resposta reaberta", "response.soft_deleted": "Resposta excluída logicamente", "response.note_updated": "Observação atualizada", "indicator.updated": "Indicador alterado", "scoring.updated": "Parâmetros de pontuação atualizados" }; return map[action] ?? action; }
