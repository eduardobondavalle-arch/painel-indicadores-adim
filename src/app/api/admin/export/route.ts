import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getStaff } from "@/lib/auth";
import { calculateMetrics } from "@/lib/calculations";
import { loadPerformance } from "@/lib/performance-data";
import { INDICATOR_BY_KEY, INDICATORS } from "@/lib/indicators";
import { exportFilename, toCsv } from "@/lib/export";

type ResponseRow = { id: string; period_id: string; submitted_manager_name: string; submitted_manager_email: string; reference_month: number; reference_year: number; submitted_at: string; protocol: string; status: string };
type ValueRow = { response_id: string; indicator_key: string; indicator_number: number; label: string; value_type: string; value_numeric: number | string | null; value_text: string | null; original_numeric: number | string | null; original_text: string | null };

function download(body: BodyInit, filename: string, contentType: string) {
  return new NextResponse(body, { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}

const current = (value: ValueRow) => value.value_type === "text" ? value.value_text ?? "" : Number(value.value_numeric ?? 0);

export async function GET(request: NextRequest) {
  const { user, profile, supabase } = await getStaff();
  if (!user || !profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const search = request.nextUrl.searchParams;
  const type = search.get("type") ?? "monthly";
  const format = search.get("format") ?? "xlsx";
  const month = Number(search.get("mes")) || new Date().getMonth() + 1;
  const year = Number(search.get("ano")) || new Date().getFullYear();
  const id = search.get("id");

  if (type === "response") {
    if (!id) return NextResponse.json({ error: "Resposta não informada." }, { status: 400 });
    const [responseResult, valuesResult] = await Promise.all([
      supabase.from("responses").select("id,period_id,submitted_manager_name,submitted_manager_email,reference_month,reference_year,submitted_at,protocol,status").eq("id", id).maybeSingle(),
      supabase.from("response_values").select("response_id,indicator_key,indicator_number,label,value_type,value_numeric,value_text,original_numeric,original_text").eq("response_id", id).order("indicator_number"),
    ]);
    if (!responseResult.data) return NextResponse.json({ error: "Resposta não encontrada." }, { status: 404 });
    const response = responseResult.data as ResponseRow;
    const performance = (await loadPerformance(supabase, [response])).results.get(response.id)!;
    const values = (valuesResult.data ?? []) as ValueRow[];
    const filename = exportFilename("resposta", response.reference_month, response.reference_year, response.submitted_manager_name, format);
    if (format === "csv") {
      const rows = values.map((value) => [value.indicator_number, value.indicator_key, INDICATOR_BY_KEY[value.indicator_key]?.label ?? value.label, current(value), value.value_type === "text" ? value.original_text : value.original_numeric]);
      rows.push(["", "score", "Score geral", performance.score ?? "Pendente", ""]);
      rows.push(["", "performance", "Bônus performance", performance.bonus ?? "Pendente", ""]);
      rows.push(["", "cash_go", "Cash Go verificado", performance.cashGo ?? "Pendente", ""]);
      rows.push(["", "total", "Bônus total", performance.total ?? "Pendente", ""]);
      for (const pillar of performance.pillarScores) rows.push(["", `pillar_${pillar.number}`, pillar.name, pillar.score ?? "Pendente", ""]);
      return download(toCsv(["Número", "Chave", "Indicador", "Valor atual", "Valor original"], rows), filename, "text/csv; charset=utf-8");
    }
    if (format === "pdf") {
      const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      document.setTextColor(16, 43, 78); document.setFontSize(18); document.text("Adim Aluguéis — Indicadores mensais", 14, 18);
      document.setTextColor(60, 60, 60); document.setFontSize(10);
      document.text(`Gestora: ${response.submitted_manager_name}`, 14, 27);
      document.text(`Referência: ${String(response.reference_month).padStart(2, "0")}/${response.reference_year}  |  Protocolo: ${response.protocol}`, 14, 33);
      autoTable(document, { startY: 40, head: [["Score", "Performance", "Cash Go", "Total"]], body: [[performance.score === null ? "Pendente" : String(performance.score), performance.bonus ?? "Pendente", performance.cashGo ?? "Pendente", performance.total ?? "Pendente"]], styles: { fontSize: 9 } });
      autoTable(document, { startY: 65, head: [["Pilar", "Score", "Peso", "Trava"]], body: performance.pillarScores.map(p => [p.name, p.score ?? "Pendente", `${p.weight}%`, p.locked === null ? "Pendente" : p.locked ? "Não atingida" : "Atingida"]), styles: { fontSize: 8 } });
      autoTable(document, { startY: 110, head: [["Nº", "Indicador", "Valor"]], body: values.map((value) => [value.indicator_number, INDICATOR_BY_KEY[value.indicator_key]?.label ?? value.label, String(current(value))]), styles: { fontSize: 7.5, cellPadding: 2 }, headStyles: { fillColor: [16, 43, 78] }, alternateRowStyles: { fillColor: [248, 246, 241] }, columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 38 } } });
      const buffer = document.output("arraybuffer");
      return download(buffer, filename, "application/pdf");
    }
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
  }

  const responsesResult = await supabase.from("responses").select("id,period_id,submitted_manager_name,submitted_manager_email,reference_month,reference_year,submitted_at,protocol,status").eq("reference_month", month).eq("reference_year", year).in("status", ["submitted", "reopened"]).order("submitted_manager_name");
  const responses = (responsesResult.data ?? []) as ResponseRow[];
  const ids = responses.map((response) => response.id);
  const valuesResult = ids.length ? await supabase.from("response_values").select("response_id,indicator_key,indicator_number,label,value_type,value_numeric,value_text,original_numeric,original_text").in("response_id", ids).order("indicator_number") : { data: [] as ValueRow[], error: null };
  const values = (valuesResult.data ?? []) as ValueRow[];
  if (responsesResult.error || valuesResult.error) return NextResponse.json({ error: responsesResult.error?.message ?? valuesResult.error?.message }, { status: 500 });
  const performance = type === "restricted" || type === "history" ? null : await loadPerformance(supabase, responses);

  if (type === "history") {
    const historyResult = ids.length ? await supabase.from("change_history").select("response_id,field_key,old_value,new_value,justification,changed_at,admin_users(display_name,email)").in("response_id", ids).order("changed_at") : { data: [], error: null };
    const sheet = XLSX.utils.json_to_sheet(historyResult.data ?? []);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Histórico");
    const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return download(output, exportFilename("historico", month, year), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  const selectedIndicators = type === "restricted" ? INDICATORS.filter((indicator) => indicator.restricted) : INDICATORS;
  const rows = responses.map((response) => {
    const ownValues = values.filter((value) => value.response_id === response.id);
    const valueMap = Object.fromEntries(ownValues.map((value) => [value.indicator_key, current(value)]));
    const base: Record<string, unknown> = { Gestora: response.submitted_manager_name, Email: response.submitted_manager_email, Mês: month, Ano: year, Protocolo: response.protocol, "Data do envio": new Date(response.submitted_at).toLocaleString("pt-BR") };
    for (const indicator of selectedIndicators) base[`${indicator.number}. ${indicator.label}`] = valueMap[indicator.key] ?? "";
    if (type !== "restricted") {
      for (const metric of calculateMetrics(valueMap)) base[`Calculado — ${metric.label}`] = metric.value ?? "";
      const result = performance?.results.get(response.id);
      base["Score geral"] = result?.score ?? "Pendente";
      base["Bonificação performance"] = result?.bonus ?? "Pendente";
      base["Cash Go verificado"] = result?.cashGo ?? "Pendente";
      base["Bonificação total"] = result?.total ?? "Pendente";
      for (const pillar of result?.pillarScores ?? []) {
        base[`Pilar ${pillar.number} — ${pillar.name}`] = pillar.score ?? "Pendente";
        for (const kpi of pillar.kpis) base[`${kpi.key.toUpperCase()} — ${kpi.name}`] = kpi.value ?? "Pendente";
      }
    }
    return base;
  });
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!freeze"] = { xSplit: 1, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, sheet, type === "comparison" ? "Comparativo" : type === "restricted" ? "Gerencial restrito" : "Consolidação");
  if (type !== "restricted") {
    const dictionary = INDICATORS.map((indicator) => ({ Número: indicator.number, Chave: indicator.key, Indicador: indicator.label, Bloco: indicator.block, Tipo: indicator.type, Restrito: indicator.restricted ? "Sim" : "Não" }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dictionary), "Dicionário");
  }
  const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const fileType = type === "comparison" ? "comparativo" : type === "restricted" ? "gerencial-restrito" : "consolidacao";
  return download(output, exportFilename(fileType, month, year), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
