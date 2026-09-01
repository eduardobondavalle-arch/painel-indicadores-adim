"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, UserCheck, UserX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Manager = { id: string; name: string; email: string; active: boolean; joined_on: string; notes: string | null; is_demo: boolean; created_at: string };
type ManagerForm = { id?: string; name: string; email: string; joinedOn: string; notes: string; active: boolean };
const emptyForm = (): ManagerForm => ({ name: "", email: "", joinedOn: new Date().toISOString().slice(0, 10), notes: "", active: true });

export function ManagersManager({ initialManagers, canEdit }: { initialManagers: Manager[]; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<ManagerForm | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch("/api/admin/managers", { method: form?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) return setError(body.error ?? "Não foi possível salvar.");
    setForm(null); router.refresh();
  }
  async function toggle(manager: Manager) {
    if (!window.confirm(`${manager.active ? "Inativar" : "Ativar"} ${manager.name}?`)) return;
    const response = await fetch("/api/admin/managers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: manager.id, name: manager.name, email: manager.email, joinedOn: manager.joined_on, notes: manager.notes ?? "", active: !manager.active }) });
    if (!response.ok) window.alert((await response.json()).error); else router.refresh();
  }
  return <div><div className="mb-4 flex justify-end">{canEdit && <Button variant="accent" onClick={() => setForm(emptyForm())}><Plus className="size-4" />Nova gestora</Button>}</div>{form && <Card className="mb-5 border-orange-200"><CardContent className="p-5"><form onSubmit={save}><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-black text-[#102b4e]">{form.id ? "Editar gestora" : "Cadastrar gestora"}</h2><Button type="button" variant="ghost" size="icon" onClick={() => setForm(null)}><X className="size-4" /></Button></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Nome completo</Label><Input required minLength={3} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div><Label>E-mail corporativo</Label><Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div><div><Label>Data de entrada</Label><Input required type="date" value={form.joinedOn} onChange={(event) => setForm({ ...form, joinedOn: event.target.value })} /></div><label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold"><input type="checkbox" className="size-5 accent-[#f28b30]" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Gestora ativa</label><div className="sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div></div>{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-4 flex justify-end"><Button disabled={saving}>{saving ? "Salvando..." : "Salvar cadastro"}</Button></div></form></CardContent></Card>}
    <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Gestora</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Observações</th>{canEdit && <th className="px-5 py-3 text-right">Ações</th>}</tr></thead><tbody className="divide-y">{initialManagers.map((manager) => <tr key={manager.id} className={!manager.active ? "bg-slate-50 opacity-70" : ""}><td className="px-5 py-4"><div className="flex items-center gap-2"><p className="font-bold text-[#102b4e]">{manager.name}</p>{manager.is_demo && <Badge variant="warning">Demonstração</Badge>}</div><p className="mt-1 text-xs text-slate-500">{manager.email}</p></td><td className="px-4 py-4">{new Date(`${manager.joined_on}T12:00:00`).toLocaleDateString("pt-BR")}</td><td className="px-4 py-4"><Badge variant={manager.active ? "success" : "default"}>{manager.active ? "Ativa" : "Inativa"}</Badge></td><td className="max-w-xs px-4 py-4 text-slate-500">{manager.notes || "—"}</td>{canEdit && <td className="px-5 py-4"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setForm({ id: manager.id, name: manager.name, email: manager.email, joinedOn: manager.joined_on, notes: manager.notes ?? "", active: manager.active })}><Pencil className="size-4" />Editar</Button><Button variant="ghost" size="sm" onClick={() => toggle(manager)}>{manager.active ? <UserX className="size-4 text-red-500" /> : <UserCheck className="size-4 text-emerald-600" />}{manager.active ? "Inativar" : "Ativar"}</Button></div></td>}</tr>)}</tbody></table></div></Card></div>;
}
