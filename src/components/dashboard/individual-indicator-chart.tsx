"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

type ChartItem = { name: string; atual: number; original: number };

export function IndividualIndicatorChart({ data, type }: { data: ChartItem[]; type: string }) {
  const formatter = (value: unknown) => {
    const numeric = Number(Array.isArray(value) ? value[0] ?? 0 : value ?? 0);
    if (type === "currency") return formatCurrency(numeric);
    if (type === "percent") return formatPercent(numeric);
    return formatNumber(numeric);
  };
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" fontSize={12} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? "end" : "middle"} height={data.length > 5 ? 62 : 34} />
          <YAxis fontSize={12} />
          <Tooltip formatter={(value) => formatter(value)} />
          <Legend />
          <Bar dataKey="original" name="Informado originalmente" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
          <Bar dataKey="atual" name="Valor atual" fill="var(--chart-1)" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
