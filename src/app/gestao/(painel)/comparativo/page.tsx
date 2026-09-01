import { Download } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { ComparisonView } from "@/components/dashboard/comparison-view";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReferenceFilter } from "@/components/dashboard/reference-filter";
import { Button } from "@/components/ui/button";

type SearchParams = Promise<{ mes?: string; ano?: string; gestora?: string }>;
type ResponseRow = { id: string; manager_id: string; submitted_manager_name: string; submitted_manager_email: string };
type ValueRow = { response_id: string; indicator_key: string; value_type: string; value_numeric: number | string | null; value_text: string | null };

export default async function ComparisonPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const today = new Date(); const month = Number(params.mes) || today.getMonth() + 1; const year = Number(params.ano) || today.getFullYear();
  const { supabase } = await requireStaff();
  const responsesResult = await supabase.from("responses").select("id,manager_id,submitted_manager_name,submitted_manager_email").eq("reference_month", month).eq("reference_year", year).in("status", ["submitted", "reopened"]).order("submitted_manager_name");
  const responses = (responsesResult.data ?? []) as ResponseRow[];
  const valuesResult = responses.length ? await supabase.from("response_values").select("response_id,indicator_key,value_type,value_numeric,value_text").in("response_id", responses.map((response) => response.id)) : { data: [], error: null };
  const values = (valuesResult.data ?? []) as ValueRow[];
  const data = responses.map((response) => ({ id: response.id, managerId: response.manager_id, name: response.submitted_manager_name, email: response.submitted_manager_email, values: Object.fromEntries(values.filter((value) => value.response_id === response.id).map((value) => [value.indicator_key, value.value_type === "text" ? value.value_text ?? "" : Number(value.value_numeric ?? 0)])) }));
  return <><PageHeader eyebrow="Análise lado a lado" title="Comparativo entre gestoras" description="Compare cada bloco sem misturar escalas e veja a média, o maior e o menor valor da equipe." actions={<><Button asChild variant="outline"><a href={`/api/admin/export?type=comparison&format=xlsx&mes=${month}&ano=${year}`}><Download className="size-4" />Exportar Excel</a></Button><ReferenceFilter month={month} year={year} /></>} />{responsesResult.error || valuesResult.error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{responsesResult.error?.message ?? valuesResult.error?.message}</div> : <ComparisonView data={data} highlightedManager={params.gestora} />}</>;
}
