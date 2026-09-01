"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Save, Send, ShieldCheck } from "lucide-react";
import { BLOCKS, indicatorsForBlock, type IndicatorDefinition } from "@/lib/indicators";
import { getConsistencyAlerts } from "@/lib/consistency";
import { blankIndicatorValues, validateIndicator } from "@/lib/submission";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FormData = {
  managerName: string;
  managerEmail: string;
  referenceMonth: number;
  referenceYear: number;
  confirmedReview: boolean;
  values: Record<string, string>;
};
type SubmissionResult = { protocol: string; submitted_at: string };

const DRAFT_KEY = "adim-indicadores-draft-v1";
const monthName = (month: number) => new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, month - 1, 1));

function currencyMask(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(digits) / 100);
}

function indicatorValueForDisplay(indicator: IndicatorDefinition, raw: string) {
  if (indicator.type === "currency") {
    const normalized = Number(raw.replace(/R\$/g, "").replace(/\./g, "").replace(",", "."));
    return formatCurrency(normalized);
  }
  if (indicator.type === "percent") return `${formatNumber(raw.replace(",", "."))}%`;
  return raw || "—";
}

export function PublicIndicatorForm() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear + 1 - index);
  const [step, setStep] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const hydrated = useRef(false);
  const { register, control, watch, getValues, reset } = useForm<FormData>({
    defaultValues: { managerName: "", managerEmail: "", referenceMonth: currentMonth, referenceYear: currentYear, confirmedReview: false, values: blankIndicatorValues() },
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const persisted = JSON.parse(saved);
        const legacyPeriod = typeof persisted.referencePeriod === "string" ? persisted.referencePeriod.split("-").map(Number) : [];
        reset({
          managerName: persisted.managerName ?? "",
          managerEmail: persisted.managerEmail ?? "",
          referenceMonth: Number(persisted.referenceMonth ?? legacyPeriod[0] ?? currentMonth),
          referenceYear: Number(persisted.referenceYear ?? legacyPeriod[1] ?? currentYear),
          confirmedReview: false,
          values: { ...blankIndicatorValues(), ...(persisted.values ?? {}) },
        });
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    } finally {
      hydrated.current = true;
    }
  }, [currentMonth, currentYear, reset]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (!hydrated.current || result) return;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [watch, result]);

  const currentBlock = BLOCKS[step];
  const alerts = getConsistencyAlerts(getValues("values"));
  const progress = reviewing ? 100 : ((step + 1) / BLOCKS.length) * 100;

  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(getValues()));
    setNotice("Rascunho salvo neste dispositivo.");
    window.setTimeout(() => setNotice(""), 3500);
  };

  const validateBlock = (blockNumber: number) => {
    const data = getValues();
    const errors: Record<string, string> = {};
    if (blockNumber === 1) {
      if (data.managerName.trim().length < 3) errors.managerName = "Informe o nome completo.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.managerEmail)) errors.managerEmail = "Informe um e-mail corporativo válido.";
      if (data.referenceMonth < 1 || data.referenceMonth > 12) errors.referenceMonth = "Selecione o mês de referência.";
      if (data.referenceYear < 2020 || data.referenceYear > 2100) errors.referenceYear = "Selecione o ano de referência.";
    }
    for (const indicator of indicatorsForBlock(blockNumber)) {
      const error = validateIndicator(indicator, data.values[indicator.key]);
      if (error) errors[indicator.key] = error;
    }
    if (blockNumber === 4) {
      const complaints = ["reclamacoes_google", "reclamacoes_reclame_aqui", "reclamacoes_diretoria"]
        .reduce((sum, key) => sum + Number(data.values[key] || 0), 0);
      if (complaints > 0 && !data.values.descricao_reclamacoes.trim()) errors.descricao_reclamacoes = "Descreva as reclamações registradas.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      window.scrollTo({ top: 280, behavior: "smooth" });
      return false;
    }
    return true;
  };

  const next = () => {
    if (!validateBlock(currentBlock.number)) return;
    if (step === BLOCKS.length - 1) setReviewing(true);
    else setStep((value) => value + 1);
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    if (reviewing) setReviewing(false);
    else setStep((value) => Math.max(0, value - 1));
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToBlock = (block: number) => {
    setReviewing(false);
    setStep(block - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    const data = getValues();
    if (!data.confirmedReview) {
      setFieldErrors({ confirmedReview: "Confirme que os dados foram conferidos." });
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/public/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerName: data.managerName,
          managerEmail: data.managerEmail,
          referenceMonth: Number(data.referenceMonth),
          referenceYear: Number(data.referenceYear),
          confirmedReview: data.confirmedReview,
          values: data.values,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível enviar.");
      localStorage.removeItem(DRAFT_KEY);
      setResult(body);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível registrar o envio.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <Card className="overflow-hidden border-emerald-200">
        <div className="h-2 bg-emerald-500" />
        <CardContent className="grid min-h-[460px] place-items-center py-12 text-center">
          <div>
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-10" /></div>
            <h2 className="mt-6 text-3xl font-black text-[#102b4e]">Envio registrado</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-600">Os 55 indicadores foram armazenados com sucesso. Guarde o protocolo abaixo para referência.</p>
            <div className="mx-auto mt-7 max-w-md rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">Protocolo</p>
              <p className="mt-2 break-all font-mono text-2xl font-black text-[#102b4e]">{result.protocol}</p>
              <p className="mt-2 text-xs text-slate-500">Enviado em {new Date(result.submitted_at).toLocaleString("pt-BR")}</p>
            </div>
            <p className="mt-6 text-sm text-slate-500">Para corrigir dados já enviados, entre em contato com a gestão.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Card className="rise-in mb-5 overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-4 text-sm">
            <span className="font-bold text-[#102b4e]">{reviewing ? "Revisão final" : `Etapa ${step + 1} de ${BLOCKS.length}`}</span>
            <span className="text-slate-500">{Math.round(progress)}% concluído</span>
          </div>
          <Progress value={progress} />
          <div className="mt-4 hidden grid-cols-6 gap-2 md:grid">
            {BLOCKS.map((block, index) => (
              <div key={block.number} className={`h-1 rounded-full ${reviewing || index <= step ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>
        </CardContent>
      </Card>

      {reviewing ? (
        <Review data={getValues()} alerts={alerts} onEdit={goToBlock} />
      ) : (
        <Card>
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm">{currentBlock.number}</div>
              <div><CardTitle>{currentBlock.title}</CardTitle><p className="mt-1 text-sm text-slate-500">{currentBlock.description}</p></div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {step === 0 && (
              <section className="mb-8 rounded-xl border border-border/60 bg-secondary/55 p-4 sm:p-5">
                <div className="mb-5 flex items-center gap-2"><ShieldCheck className="size-5 text-[#d96c12]" /><h3 className="font-bold text-[#102b4e]">Identificação da gestora</h3></div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <FieldShell label="Nome completo da gestora" error={fieldErrors.managerName}>
                    <Input autoComplete="name" placeholder="Seu nome completo" {...register("managerName")} />
                  </FieldShell>
                  <FieldShell label="E-mail corporativo" error={fieldErrors.managerEmail}>
                    <Input type="email" autoComplete="email" placeholder="nome@adimimoveis.com.br" {...register("managerEmail")} />
                  </FieldShell>
                  <FieldShell label="Mês de referência" error={fieldErrors.referenceMonth}>
                    <Select {...register("referenceMonth", { valueAsNumber: true })}>
                      {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1} className="capitalize">{monthName(index + 1)}</option>)}
                    </Select>
                  </FieldShell>
                  <FieldShell label="Ano de referência" error={fieldErrors.referenceYear}>
                    <Select {...register("referenceYear", { valueAsNumber: true })}>
                      {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
                    </Select>
                  </FieldShell>
                </div>
              </section>
            )}

            <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
              {indicatorsForBlock(currentBlock.number).map((indicator) => (
                <IndicatorField key={indicator.key} indicator={indicator} control={control} error={fieldErrors[indicator.key]} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {reviewing && (
        <Card className="mt-5 border-[#ccd8e5]">
          <CardContent className="pt-5 sm:pt-6">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-1 size-5 accent-[#f28b30]" {...register("confirmedReview")} />
              <span><span className="font-bold text-[#102b4e]">Confirmo que conferi os dados.</span><span className="mt-1 block text-sm text-slate-500">Estou ciente de que a resposta será fechada após o envio.</span></span>
            </label>
            {fieldErrors.confirmedReview && <p className="mt-2 text-sm text-red-600">{fieldErrors.confirmedReview}</p>}
            {submitError && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{submitError}</div>}
          </CardContent>
        </Card>
      )}

      <div className="glass-strong sticky bottom-3 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/60 p-3 shadow-md sm:p-4">
        <div className="flex gap-2">
          {(step > 0 || reviewing) && <Button type="button" variant="outline" onClick={back}><ArrowLeft className="size-4" />Voltar</Button>}
          <Button type="button" variant="ghost" onClick={saveDraft}><Save className="size-4" /><span className="hidden sm:inline">Salvar e continuar depois</span><span className="sm:hidden">Salvar</span></Button>
        </div>
        {reviewing ? <Button type="button" variant="accent" size="lg" disabled={submitting} onClick={submit}>{submitting ? "Enviando..." : <><Send className="size-4" />Confirmar envio</>}</Button> : <Button type="button" size="lg" onClick={next}>{step === BLOCKS.length - 1 ? "Revisar dados" : "Continuar"}<ArrowRight className="size-4" /></Button>}
      </div>
      {notice && <div className="fixed bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background shadow-xl" role="status">{notice}</div>}
    </div>
  );
}

function FieldShell({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label>{label}</Label>{children}{error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}</div>;
}

function IndicatorField({ indicator, control, error }: { indicator: IndicatorDefinition; control: ReturnType<typeof useForm<FormData>>["control"]; error?: string }) {
  return (
    <div className={indicator.type === "text" ? "sm:col-span-2" : ""}>
      <Label htmlFor={indicator.key}><span className="mr-2 text-[#d96c12]">{indicator.number}.</span>{indicator.label}</Label>
      {indicator.hint && <p className="mb-2 text-xs leading-5 text-slate-500">{indicator.hint}</p>}
      <Controller
        name={`values.${indicator.key}`}
        control={control}
        render={({ field }) => indicator.type === "text" ? (
          <Textarea id={indicator.key} value={field.value ?? ""} onChange={field.onChange} placeholder={indicator.key === "descricao_reclamacoes" ? "Obrigatório somente se houve reclamações" : "Descreva de forma objetiva"} />
        ) : (
          <div className="relative">
            {indicator.type === "currency" ? (
              <Input id={indicator.key} inputMode="numeric" value={field.value ?? ""} onChange={(event) => field.onChange(currencyMask(event.target.value))} />
            ) : (
              <Input id={indicator.key} type="number" inputMode={indicator.type === "integer" ? "numeric" : "decimal"} min={0} max={indicator.type === "percent" || indicator.type === "nps" ? 100 : undefined} step={indicator.type === "integer" || indicator.type === "nps" ? 1 : 0.01} value={field.value ?? ""} onChange={field.onChange} />
            )}
            {indicator.type === "percent" && <span className="pointer-events-none absolute right-3 top-3 text-sm text-slate-400">%</span>}
          </div>
        )}
      />
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function Review({ data, alerts, onEdit }: { data: FormData; alerts: ReturnType<typeof getConsistencyAlerts>; onEdit: (block: number) => void }) {
  const month = Number(data.referenceMonth);
  const year = Number(data.referenceYear);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="border-b border-slate-100"><CardTitle>Revise antes de enviar</CardTitle><p className="mt-1 text-sm text-slate-500">Confira a identificação e todos os 55 indicadores.</p></CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Gestora</p><p className="mt-1 font-semibold">{data.managerName}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">E-mail</p><p className="mt-1 font-semibold">{data.managerEmail}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Referência</p><p className="mt-1 font-semibold capitalize">{monthName(month)} de {year}</p></div>
        </CardContent>
      </Card>
      {alerts.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader><div className="flex items-center gap-3"><AlertTriangle className="size-6 text-amber-700" /><div><CardTitle className="text-amber-900">{alerts.length} {alerts.length === 1 ? "alerta de consistência" : "alertas de consistência"}</CardTitle><p className="mt-1 text-sm text-amber-800">Você pode corrigir os valores ou enviar mesmo assim. Os alertas serão registrados.</p></div></div></CardHeader>
          <CardContent><ul className="space-y-2">{alerts.map((alert) => <li key={alert.code} className="flex gap-2 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{alert.message}</li>)}</ul></CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><Check className="size-5" />Nenhuma inconsistência automática foi encontrada.</div>
      )}
      {BLOCKS.map((block) => (
        <Card key={block.number}>
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100"><div><p className="text-xs font-bold uppercase tracking-wide text-[#d96c12]">Bloco {block.number}</p><CardTitle className="mt-1">{block.title}</CardTitle></div><Button type="button" variant="ghost" size="sm" onClick={() => onEdit(block.number)}>Editar</Button></CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {indicatorsForBlock(block.number).map((indicator) => <div key={indicator.key} className="grid gap-1 py-3 sm:grid-cols-[1fr_220px] sm:gap-6"><p className="text-sm text-slate-600"><span className="mr-1 font-bold text-[#d96c12]">{indicator.number}.</span>{indicator.label}</p><p className="break-words text-sm font-bold text-[#102b4e] sm:text-right">{indicatorValueForDisplay(indicator, data.values[indicator.key])}</p></div>)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
