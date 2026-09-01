import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ label, value, icon: Icon, tone = "navy", detail }: { label: string; value: string | number; icon: LucideIcon; tone?: "navy" | "orange" | "green" | "purple"; detail?: string }) {
  const tones = { navy: "bg-secondary text-foreground", orange: "bg-orange-100 text-primary", green: "bg-emerald-100 text-emerald-700", purple: "bg-purple-100 text-purple-700" };
  return <Card className="rise-in"><CardContent className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="label-caps leading-5">{label}</p><p className="metric-value mt-3 text-foreground">{value}</p>{detail && <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>}</div><div className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" /></div></div></CardContent></Card>;
}
