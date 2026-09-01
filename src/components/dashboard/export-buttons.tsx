"use client";

import { Download, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButtons({ responseId, month, year, manager }: { responseId: string; month: number; year: number; manager: string }) {
  const base = `/api/admin/export?id=${encodeURIComponent(responseId)}&mes=${month}&ano=${year}&gestora=${encodeURIComponent(manager)}`;
  return <div className="no-print flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="size-4" />Imprimir</Button><Button asChild variant="outline"><a href={`${base}&type=response&format=csv`}><Download className="size-4" />CSV</a></Button><Button asChild><a href={`${base}&type=response&format=pdf`}><FileText className="size-4" />PDF</a></Button></div>;
}
