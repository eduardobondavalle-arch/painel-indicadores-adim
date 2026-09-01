import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const months = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, index, 1)) }));

export function ReferenceFilter({ month, year, extra }: { month: number; year: number; extra?: React.ReactNode }) {
  const years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() + 1 - index);
  return <form className="panel flex flex-wrap items-end gap-2 p-3"><label className="label-caps min-w-36">Mês<Select name="mes" defaultValue={month} className="mt-1 h-8 rounded-full capitalize">{months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></label><label className="label-caps w-28">Ano<Select name="ano" defaultValue={year} className="mt-1 h-8 rounded-full">{years.map((item) => <option key={item}>{item}</option>)}</Select></label>{extra}<Button type="submit" size="sm">Aplicar</Button></form>;
}
