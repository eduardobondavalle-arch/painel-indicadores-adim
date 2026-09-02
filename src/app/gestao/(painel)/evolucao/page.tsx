import { requireStaff } from "@/lib/auth";
import { EvolutionView } from "@/components/dashboard/evolution-view";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type SearchParams = Promise<{ inicio?: string; fim?: string; gestora?: string }>;
type ResponseRow = { id: string; manager_id: string | null; submitted_manager_name: string; reference_month: number; reference_year: number };
type ValueRow = { response_id: string; indicator_key: string; value_type: string; value_numeric: number | string | null; value_text: string | null };
type ManagerRow = { id: string; name: string };

const monthValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export default async function EvolutionPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const endDate = new Date(); const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 5, 1);
  const start = params.inicio && /^\d{4}-\d{2}$/.test(params.inicio) ? params.inicio : monthValue(startDate);
  const end = params.fim && /^\d{4}-\d{2}$/.test(params.fim) ? params.fim : monthValue(endDate);
  const { supabase } = await requireStaff();
  const [managersResult, responsesResult] = await Promise.all([
    supabase.from("managers").select("id,name").order("name"),
    supabase.from("responses").select("id,manager_id,submitted_manager_name,reference_month,reference_year").in("status", ["submitted", "reopened"]).order("reference_year").order("reference_month"),
  ]);
  const allResponses = (responsesResult.data ?? []) as ResponseRow[];
  const startNumber = Number(start.replace("-", "")); const endNumber = Number(end.replace("-", ""));
  const responses = allResponses.filter((response) => { const period = response.reference_year * 100 + response.reference_month; return period >= startNumber && period <= endNumber; });
  const valuesResult = responses.length ? await supabase.from("response_values").select("response_id,indicator_key,value_type,value_numeric,value_text").in("response_id", responses.map((response) => response.id)) : { data: [], error: null };
  const values = (valuesResult.data ?? []) as ValueRow[];
  const data = responses.map((response) => ({ ...response, values: Object.fromEntries(values.filter((value) => value.response_id === response.id).map((value) => [value.indicator_key, value.value_type === "text" ? value.value_text ?? "" : Number(value.value_numeric ?? 0)])) }));
  const managers = (managersResult.data ?? []) as ManagerRow[];
  return <><PageHeader eyebrow="Série histórica" title="Evolução dos indicadores" description="Analise mês a mês, consolide por trimestre e compare uma gestora com a média da equipe." actions={<form className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3 shadow-sm"><label className="text-xs font-bold uppercase text-slate-500">Início<Input className="mt-1 w-40" type="month" name="inicio" defaultValue={start} /></label><label className="text-xs font-bold uppercase text-slate-500">Fim<Input className="mt-1 w-40" type="month" name="fim" defaultValue={end} /></label><label className="text-xs font-bold uppercase text-slate-500">Gestora<Select className="mt-1 min-w-44" name="gestora" defaultValue={params.gestora ?? ""}><option value="">Equipe</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</Select></label><Button>Aplicar</Button></form>} />{responsesResult.error || valuesResult.error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{responsesResult.error?.message ?? valuesResult.error?.message}</div> : <EvolutionView responses={data} selectedManager={params.gestora} />}</>;
}
