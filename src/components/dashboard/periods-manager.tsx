"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Lock, LockOpen, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Period = { id: string; reference_month: number; reference_year: number; status: "draft" | "open" | "closed"; opens_at: string | null; closes_at: string | null; accept_late: boolean; created_at: string };
const statusMap = { draft: { label: "Rascunho", variant: "default" as const }, open: { label: "Aberto", variant: "success" as const }, closed: { label: "Fechado", variant: "danger" as const } };

export function PeriodsManager({ periods, lateByPeriod, canEdit }: { periods: Period[]; lateByPeriod: Record<string, string[]>; canEdit: boolean }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  async function create(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/admin/periods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, year, closesAt: deadline ? new Date(deadline).toISOString() : null }) });
    const body = await response.json(); if (!response.ok) return setError(body.error); setShowForm(false); router.refresh();
  }
  async function change(period: Period, status: Period["status"]) {
    const verb = status === "open" ? "abrir/reabrir" : "fechar";
    if (!window.confirm(`Deseja ${verb} este período?`)) return;
    const acceptLate = status === "open" && Boolean(period.closes_at && new Date(period.closes_at) < new Date());
    const response = await fetch("/api/admin/periods", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: period.id, status, acceptLate }) });
    if (!response.ok) window.alert((await response.json()).error); else router.refresh();
  }
  return <div>{canEdit && <div className="mb-4 flex justify-end"><Button variant="accent" onClick={() => setShowForm(!showForm)}><CalendarPlus className="size-4" />Novo período</Button></div>}{showForm && <Card className="mb-5 border-orange-200"><CardContent className="p-5"><form className="grid gap-4 sm:grid-cols-4" onSubmit={create}><div><Label>Mês</Label><Select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, index, 1))}</option>)}</Select></div><div><Label>Ano</Label><Input type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} /></div><div><Label>Data e hora limite</Label><Input required type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></div><div className="flex items-end"><Button className="w-full">Criar em rascunho</Button></div>{error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}</form></CardContent></Card>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{periods.map((period) => { const status = statusMap[period.status]; const late = period.closes_at && new Date(period.closes_at) < new Date() && period.status === "open"; const lateManagers = lateByPeriod[period.id] ?? []; return <Card key={period.id}><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Referência</p><p className="mt-1 text-2xl font-black capitalize text-[#102b4e]">{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, period.reference_month - 1, 1))} <span className="text-[#d96c12]">{period.reference_year}</span></p></div><Badge variant={status.variant}>{status.label}</Badge></div><div className="mt-5 space-y-2 text-sm text-slate-500"><p>Abertura: {period.opens_at ? new Date(period.opens_at).toLocaleString("pt-BR") : "não definida"}</p><p>Limite: {period.closes_at ? new Date(period.closes_at).toLocaleString("pt-BR") : "sem limite"}</p>{late && <p className="font-bold text-red-600">{period.accept_late ? "Reaberto para envios atrasados" : "Prazo expirado"}</p>}{lateManagers.length > 0 && <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800"><strong>{lateManagers.length} envio(s) atrasado(s):</strong> {lateManagers.join(", ")}</div>}</div>{canEdit && <div className="mt-5 flex gap-2">{period.status !== "open" && <Button size="sm" variant="outline" onClick={() => change(period, "open")}>{period.status === "closed" ? <RotateCcw className="size-4" /> : <LockOpen className="size-4" />}{period.status === "closed" ? "Reabrir" : "Abrir"}</Button>}{period.status === "open" && <Button size="sm" variant="outline" onClick={() => change(period, "closed")}><Lock className="size-4" />Fechar</Button>}</div>}</CardContent></Card>; })}</div></div>;
}
