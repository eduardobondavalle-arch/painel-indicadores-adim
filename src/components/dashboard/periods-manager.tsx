"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarPlus, Lock, LockOpen, RotateCcw, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Period = {
  id: string;
  reference_month: number;
  reference_year: number;
  status: "draft" | "open" | "closed";
  opens_at: string | null;
  closes_at: string | null;
  accept_late: boolean;
  created_at: string;
};

type Adjustment = {
  period: Period;
  deadline: string;
  reactivate: boolean;
};

const statusMap = {
  draft: { label: "Rascunho", variant: "default" as const },
  open: { label: "Aberto", variant: "success" as const },
  closed: { label: "Fechado", variant: "danger" as const },
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function periodLabel(period: Period) {
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" })
    .format(new Date(2024, period.reference_month - 1, 1));
  return `${month} de ${period.reference_year}`;
}

export function PeriodsManager({
  periods,
  lateByPeriod,
  canEdit,
}: {
  periods: Period[];
  lateByPeriod: Record<string, string[]>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleCreateForm() {
    setAdjustment(null);
    setError("");
    setShowForm((current) => !current);
  }

  function openAdjustment(period: Period) {
    setShowForm(false);
    setError("");
    setAdjustment({
      period,
      deadline: toLocalDateTime(period.closes_at),
      reactivate: false,
    });
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/admin/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        year,
        closesAt: new Date(deadline).toISOString(),
      }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) return setError(body.error ?? "Não foi possível criar o período.");
    setShowForm(false);
    setNotice("Período criado em rascunho.");
    router.refresh();
  }

  async function saveAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!adjustment) return;

    setSaving(true);
    setError("");
    const closesAt = new Date(adjustment.deadline).toISOString();
    const status = adjustment.period.status === "open" || adjustment.reactivate
      ? "open"
      : adjustment.period.status;
    const response = await fetch("/api/admin/periods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: adjustment.period.id,
        status,
        closesAt,
        acceptLate: status === "open" && new Date(closesAt) < new Date(),
      }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) return setError(body.error ?? "Não foi possível ajustar o período.");

    setNotice(adjustment.reactivate
      ? "Prazo atualizado e período reativado com sucesso."
      : "Prazo do período atualizado com sucesso.");
    setAdjustment(null);
    router.refresh();
  }

  async function change(period: Period, status: Period["status"]) {
    const verb = status === "open" ? "abrir/reabrir" : "fechar";
    if (!window.confirm(`Deseja ${verb} este período?`)) return;
    const acceptLate = status === "open" && Boolean(period.closes_at && new Date(period.closes_at) < new Date());
    const response = await fetch("/api/admin/periods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: period.id, status, acceptLate }),
    });
    if (!response.ok) window.alert((await response.json()).error);
    else {
      setNotice(status === "open" ? "Período aberto para recebimento." : "Período fechado.");
      router.refresh();
    }
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div aria-live="polite">
            {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">{notice}</p>}
          </div>
          <Button variant="accent" onClick={toggleCreateForm}><CalendarPlus className="size-4" />Novo período</Button>
        </div>
      )}

      {showForm && (
        <Card className="mb-5 border-orange-200">
          <CardContent className="p-5">
            <form className="grid gap-4 sm:grid-cols-4" onSubmit={create}>
              <div><Label>Mês</Label><Select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, index, 1))}</option>)}</Select></div>
              <div><Label>Ano</Label><Input type="number" min={2020} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} /></div>
              <div><Label>Data e hora limite</Label><Input required type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></div>
              <div className="flex items-end"><Button className="w-full" disabled={saving}>{saving ? "Criando..." : "Criar em rascunho"}</Button></div>
              {error && <p role="alert" className="text-sm text-red-600 sm:col-span-4">{error}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {adjustment && (
        <Card className="mb-5 border-orange-200">
          <CardContent className="p-5">
            <form onSubmit={saveAdjustment}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="label-caps text-primary">Ajustar período</p>
                  <h2 className="mt-1 text-lg font-semibold capitalize text-foreground">{periodLabel(adjustment.period)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Altere a data limite e, se necessário, reative o recebimento de formulários.</p>
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Fechar ajuste" disabled={saving} onClick={() => setAdjustment(null)}><X className="size-4" /></Button>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div>
                  <Label htmlFor="adjusted-deadline">Nova data e hora limite</Label>
                  <Input id="adjusted-deadline" required type="datetime-local" value={adjustment.deadline} onChange={(event) => setAdjustment({ ...adjustment, deadline: event.target.value })} />
                  <p className="mt-1.5 text-xs text-muted-foreground">Prazo atual: {adjustment.period.closes_at ? new Date(adjustment.period.closes_at).toLocaleString("pt-BR") : "sem limite"}</p>
                </div>

                {adjustment.period.status !== "open" ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-secondary/45 p-4">
                    <input type="checkbox" className="mt-0.5 size-5 accent-[#f28b30]" checked={adjustment.reactivate} onChange={(event) => setAdjustment({ ...adjustment, reactivate: event.target.checked })} />
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{adjustment.period.status === "closed" ? "Reativar período após salvar" : "Abrir período após salvar"}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">Volta a disponibilizar este mês no formulário. Se o prazo escolhido já venceu, os novos envios serão identificados como atrasados.</span>
                    </span>
                  </label>
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    O período continuará aberto após a atualização do prazo.
                  </div>
                )}
              </div>

              {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" disabled={saving} onClick={() => setAdjustment(null)}>Cancelar</Button>
                <Button disabled={saving}><Save className="size-4" />{saving ? "Salvando..." : adjustment.reactivate ? "Salvar e reativar" : "Salvar novo prazo"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {periods.map((period) => {
          const status = statusMap[period.status];
          const late = Boolean(period.closes_at && new Date(period.closes_at) < new Date() && period.status === "open");
          const lateManagers = lateByPeriod[period.id] ?? [];
          return (
            <Card key={period.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Referência</p>
                    <p className="mt-1 text-2xl font-black capitalize text-[#102b4e]">{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, period.reference_month - 1, 1))} <span className="text-[#d96c12]">{period.reference_year}</span></p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <div className="mt-5 space-y-2 text-sm text-slate-500">
                  <p>Abertura: {period.opens_at ? new Date(period.opens_at).toLocaleString("pt-BR") : "não definida"}</p>
                  <p>Limite: {period.closes_at ? new Date(period.closes_at).toLocaleString("pt-BR") : "sem limite"}</p>
                  {late && <p className="font-bold text-red-600">{period.accept_late ? "Reaberto para envios atrasados" : "Prazo expirado"}</p>}
                  {lateManagers.length > 0 && <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800"><strong>{lateManagers.length} envio(s) atrasado(s):</strong> {lateManagers.join(", ")}</div>}
                </div>
                {canEdit && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openAdjustment(period)}><CalendarClock className="size-4" />Ajustar período</Button>
                    {period.status !== "open" && <Button size="sm" variant="outline" onClick={() => change(period, "open")}>{period.status === "closed" ? <RotateCcw className="size-4" /> : <LockOpen className="size-4" />}{period.status === "closed" ? "Reabrir" : "Abrir"}</Button>}
                    {period.status === "open" && <Button size="sm" variant="outline" onClick={() => change(period, "closed")}><Lock className="size-4" />Fechar</Button>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
