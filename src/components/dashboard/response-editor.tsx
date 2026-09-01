"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { parseBrazilianNumber } from "@/lib/submission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EditableValue = { indicator_key: string; value_type: string; value_numeric: number | string | null; value_text: string | null };

export function ResponseEditor({ responseId, value }: { responseId: string; value: EditableValue }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nextValue, setNextValue] = useState(value.value_type === "text" ? value.value_text ?? "" : String(value.value_numeric ?? 0));
  const [justification, setJustification] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true); setError("");
    const numeric = value.value_type === "text" ? null : parseBrazilianNumber(nextValue);
    const response = await fetch(`/api/admin/responses/${responseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", indicatorKey: value.indicator_key, valueNumeric: numeric, valueText: value.value_type === "text" ? nextValue : null, justification }) });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) return setError(body.error ?? "Não foi possível salvar.");
    setEditing(false); setJustification(""); router.refresh();
  }

  if (!editing) return <Button className="no-print" variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil className="size-3.5" />Editar</Button>;
  return <div className="no-print col-span-full mt-3 rounded-xl border border-orange-200 bg-orange-50 p-4 lg:col-span-3"><div className="grid gap-3 md:grid-cols-2">{value.value_type === "text" ? <Textarea value={nextValue} onChange={(event) => setNextValue(event.target.value)} /> : <Input type="number" min={0} max={value.value_type === "percent" || value.value_type === "nps" ? 100 : undefined} step={value.value_type === "integer" ? 1 : 0.01} value={nextValue} onChange={(event) => setNextValue(event.target.value)} />}<div><Label>Justificativa obrigatória</Label><Textarea className="min-h-20" value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="Explique o motivo da alteração" /></div></div>{error && <p className="mt-2 text-sm text-red-600">{error}</p>}<div className="mt-3 flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setEditing(false)}><X className="size-4" />Cancelar</Button><Button variant="accent" size="sm" disabled={saving || justification.trim().length < 5} onClick={save}><Save className="size-4" />{saving ? "Salvando..." : "Salvar alteração"}</Button></div></div>;
}

export function ResponseNoteEditor({ responseId, currentNote }: { responseId: string; currentNote: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(currentNote);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState("");
  async function save() {
    const response = await fetch(`/api/admin/responses/${responseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", note, justification }) });
    const body = await response.json();
    if (!response.ok) return setError(body.error ?? "Não foi possível salvar.");
    setEditing(false); router.refresh();
  }
  if (!editing) return <Button variant="outline" size="sm" className="mt-4 no-print" onClick={() => setEditing(true)}><Pencil className="size-4" />Editar observação</Button>;
  return <div className="no-print mt-4 space-y-3 rounded-xl bg-slate-50 p-4"><div><Label>Observação</Label><Textarea value={note} onChange={(event) => setNote(event.target.value)} /></div><div><Label>Justificativa</Label><Input value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="Motivo da alteração" /></div>{error && <p className="text-sm text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button><Button size="sm" disabled={justification.trim().length < 5} onClick={save}>Salvar</Button></div></div>;
}
