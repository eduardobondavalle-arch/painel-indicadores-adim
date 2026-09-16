import { formatCurrency, formatNumber } from "@/lib/utils";
import type { PerformanceResult } from "@/lib/scoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const amount = (value: number | null) => value === null ? "Pendente" : formatCurrency(value);
const percent = (value: number | null) => value === null ? "Pendente" : `${formatNumber(value)}%`;

export function PerformanceBreakdown({ result }: { result: PerformanceResult }) {
  return <section className="space-y-4" aria-label="Memória de cálculo da bonificação">
    <Card><CardHeader><CardTitle>Performance e bonificação</CardTitle><p className="text-sm text-slate-500">15 KPIs oficiais derivados dos dados operacionais. As parcelas são exibidas separadamente.</p></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ["Score geral", percent(result.score)], ["Bônus performance", amount(result.bonus)],
        ["Cash Go verificado", amount(result.cashGo)], ["Total performance + Cash Go", amount(result.total)],
      ].map(([label, value]) => <div key={label} className="rounded-xl border bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-[#102b4e]">{value}</p></div>)}</CardContent>
      {result.complaintApplied && <p className="px-6 pb-4 text-sm font-semibold text-red-700">Reclamação formal atribuível: Pilar 5 zerado e score recalculado; não há veto global.</p>}
      {result.missing.length > 0 && <p className="px-6 pb-4 text-sm text-amber-800">Dados pendentes para os KPIs: {result.missing.map(key => key.toUpperCase()).join(", ")}. O bônus não é calculado até serem conferidos.</p>}
      {result.configurationIssues.length > 0 && <p className="px-6 pb-4 text-sm text-red-700">Parâmetros incompletos: {result.configurationIssues.join(" ")}</p>}
      {(result.captureFee !== null || result.migrationCommission !== null) && <p className="px-6 pb-4 text-xs text-slate-500">Verbas independentes da régua: captação {amount(result.captureFee)}; comissão de migração {amount(result.migrationCommission)}.</p>}
    </Card>
    <div className="grid gap-3">{result.pillarScores.map(pillar => <details key={pillar.number} className="rounded-xl border bg-white open:border-orange-300">
      <summary className="cursor-pointer p-4 font-semibold text-[#102b4e]">Pilar {pillar.number} — {pillar.name}: {percent(pillar.score)} · peso {pillar.weight}% · trava {pillar.minimumLock}% ({pillar.locked === null ? "pendente" : pillar.locked ? "não atingida" : "atingida"})</summary>
      <div className="overflow-x-auto border-t"><table className="w-full min-w-[740px] text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr>{["KPI", "Resultado", "Meta 0%", "Meta 100%", "Score", "Peso", "Contribuição"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{pillar.kpis.map(kpi => <tr className="border-t" key={kpi.key}><td className="p-3">{kpi.key.toUpperCase()} — {kpi.name}</td><td className="p-3">{kpi.value === null ? "Pendente" : formatNumber(kpi.value)}</td><td className="p-3">{formatNumber(kpi.goalZero)}</td><td className="p-3">{formatNumber(kpi.goalFull)}</td><td className="p-3">{percent(kpi.score)}</td><td className="p-3">{kpi.weight}%</td><td className="p-3">{percent(kpi.contribution)}</td></tr>)}</tbody></table>
        {pillar.number === 5 && <p className="p-3 text-sm text-slate-600">Condição ajustável de ausência de reclamação formal: +{formatNumber(pillar.absenceContribution)} pontos no pilar. Com reclamação atribuível, o pilar inteiro é zerado.</p>}</div>
    </details>)}</div>
  </section>;
}
