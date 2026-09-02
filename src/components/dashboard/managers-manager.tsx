"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, Pencil, Plus, Trash2, UserCheck, UserX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Manager = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  joined_on: string;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
};

type ManagerForm = {
  id?: string;
  name: string;
  email: string;
  joinedOn: string;
  notes: string;
  active: boolean;
};

type DeleteDialogState = {
  manager: Manager;
  step: "confirmation" | "scope";
};

type DeleteResult = {
  error?: string;
  deletedResponses?: number;
  preservedResponses?: number;
};

const emptyForm = (): ManagerForm => ({
  name: "",
  email: "",
  joinedOn: new Date().toISOString().slice(0, 10),
  notes: "",
  active: true,
});

export function ManagersManager({ initialManagers, canEdit }: { initialManagers: Manager[]; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<ManagerForm | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!deleteDialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) {
        setDeleteDialog(null);
        setDeleteError("");
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleteDialog, deleting]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/admin/managers", {
      method: form?.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) return setError(body.error ?? "Não foi possível salvar.");
    setForm(null);
    router.refresh();
  }

  async function toggle(manager: Manager) {
    if (!window.confirm(`${manager.active ? "Inativar" : "Ativar"} ${manager.name}?`)) return;
    const response = await fetch("/api/admin/managers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: manager.id,
        name: manager.name,
        email: manager.email,
        joinedOn: manager.joined_on,
        notes: manager.notes ?? "",
        active: !manager.active,
      }),
    });
    if (!response.ok) window.alert((await response.json()).error);
    else router.refresh();
  }

  function openDeleteDialog(manager: Manager) {
    setDeleteError("");
    setDeleteDialog({ manager, step: "confirmation" });
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteDialog(null);
    setDeleteError("");
  }

  async function deleteManager(deleteData: boolean) {
    if (!deleteDialog) return;
    setDeleting(true);
    setDeleteError("");
    const response = await fetch("/api/admin/managers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteDialog.manager.id, deleteData }),
    });
    const body = await response.json() as DeleteResult;
    setDeleting(false);
    if (!response.ok) {
      setDeleteError(body.error ?? "Não foi possível excluir a gestora.");
      return;
    }

    const count = deleteData ? Number(body.deletedResponses ?? 0) : Number(body.preservedResponses ?? 0);
    setNotice(deleteData
      ? `Gestora excluída com ${count} ${count === 1 ? "envio associado" : "envios associados"}.`
      : `Cadastro excluído. ${count} ${count === 1 ? "envio histórico foi preservado" : "envios históricos foram preservados"}.`);
    setDeleteDialog(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite">
          {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">{notice}</p>}
        </div>
        {canEdit && <Button variant="accent" onClick={() => setForm(emptyForm())}><Plus className="size-4" />Nova gestora</Button>}
      </div>

      {form && (
        <Card className="mb-5 border-orange-200">
          <CardContent className="p-5">
            <form onSubmit={save}>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-black text-[#102b4e]">{form.id ? "Editar gestora" : "Cadastrar gestora"}</h2>
                <Button type="button" variant="ghost" size="icon" aria-label="Fechar formulário" onClick={() => setForm(null)}><X className="size-4" /></Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Nome completo</Label><Input required minLength={3} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
                <div><Label>E-mail corporativo</Label><Input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
                <div><Label>Data de entrada</Label><Input required type="date" value={form.joinedOn} onChange={(event) => setForm({ ...form, joinedOn: event.target.value })} /></div>
                <label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold"><input type="checkbox" className="size-5 accent-[#f28b30]" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Gestora ativa</label>
                <div className="sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <div className="mt-4 flex justify-end"><Button disabled={saving}>{saving ? "Salvando..." : "Salvar cadastro"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Gestora</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Observações</th>{canEdit && <th className="px-5 py-3 text-right">Ações</th>}</tr>
            </thead>
            <tbody className="divide-y">
              {initialManagers.map((manager) => (
                <tr key={manager.id} className={!manager.active ? "bg-slate-50 opacity-70" : ""}>
                  <td className="px-5 py-4"><div className="flex items-center gap-2"><p className="font-bold text-[#102b4e]">{manager.name}</p>{manager.is_demo && <Badge variant="warning">Demonstração</Badge>}</div><p className="mt-1 text-xs text-slate-500">{manager.email}</p></td>
                  <td className="px-4 py-4">{new Date(`${manager.joined_on}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-4"><Badge variant={manager.active ? "success" : "default"}>{manager.active ? "Ativa" : "Inativa"}</Badge></td>
                  <td className="max-w-xs px-4 py-4 text-slate-500">{manager.notes || "—"}</td>
                  {canEdit && (
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setForm({ id: manager.id, name: manager.name, email: manager.email, joinedOn: manager.joined_on, notes: manager.notes ?? "", active: manager.active })}><Pencil className="size-4" />Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => toggle(manager)}>{manager.active ? <UserX className="size-4 text-red-500" /> : <UserCheck className="size-4 text-emerald-600" />}{manager.active ? "Inativar" : "Ativar"}</Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => openDeleteDialog(manager)}><Trash2 className="size-4" />Excluir gestora</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {deleteDialog && (
        <DeleteManagerDialog
          state={deleteDialog}
          deleting={deleting}
          error={deleteError}
          onClose={closeDeleteDialog}
          onContinue={() => setDeleteDialog({ ...deleteDialog, step: "scope" })}
          onBack={() => setDeleteDialog({ ...deleteDialog, step: "confirmation" })}
          onDelete={deleteManager}
        />
      )}
    </div>
  );
}

function DeleteManagerDialog({
  state,
  deleting,
  error,
  onClose,
  onContinue,
  onBack,
  onDelete,
}: {
  state: DeleteDialogState;
  deleting: boolean;
  error: string;
  onClose: () => void;
  onContinue: () => void;
  onBack: () => void;
  onDelete: (deleteData: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="delete-manager-title" className="panel rise-in w-full max-w-lg bg-card p-6 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-700"><AlertTriangle className="size-5" /></span>
            <div>
              <p className="label-caps text-red-600">Ação irreversível</p>
              <h2 id="delete-manager-title" className="mt-1 text-xl font-semibold text-foreground">
                {state.step === "confirmation" ? `Excluir ${state.manager.name}?` : "Escolha o tipo de exclusão"}
              </h2>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar aviso" disabled={deleting} onClick={onClose}><X className="size-4" /></Button>
        </div>

        {state.step === "confirmation" ? (
          <>
            <p className="text-sm leading-6 text-muted-foreground">Tem certeza que deseja excluir a gestora? Essa ação não poderá ser desfeita.</p>
            <div className="mt-7 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="button" variant="danger" onClick={onContinue}><Trash2 className="size-4" />Sim, continuar</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-6 text-muted-foreground">Quer excluir somente o cadastro ou quer excluir cadastro e os dados preenchidos?</p>
            <div className="mt-5 grid gap-3">
              <button type="button" disabled={deleting} className="focus-ring rounded-2xl border border-border bg-secondary/45 p-4 text-left hover:bg-secondary disabled:opacity-50" onClick={() => onDelete(false)}>
                <span className="flex items-center gap-2 font-semibold text-foreground"><Trash2 className="size-4 text-primary" />Excluir somente o cadastro</span>
                <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">Remove a gestora da equipe e preserva os envios, indicadores e histórico já registrados.</span>
              </button>
              <button type="button" disabled={deleting} className="focus-ring rounded-2xl border border-red-300 bg-red-50 p-4 text-left hover:bg-red-100 disabled:opacity-50" onClick={() => onDelete(true)}>
                <span className="flex items-center gap-2 font-semibold text-red-800"><Database className="size-4" />Excluir cadastro e dados preenchidos</span>
                <span className="mt-1.5 block text-xs leading-5 text-red-700">Apaga definitivamente todos os envios, valores, alertas e alterações vinculados à gestora.</span>
              </button>
            </div>
            {deleting && <p className="mt-4 text-center text-sm font-medium text-muted-foreground">Excluindo, aguarde...</p>}
            {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" disabled={deleting} onClick={onBack}>Voltar</Button>
              <Button type="button" variant="outline" disabled={deleting} onClick={onClose}>Cancelar</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
