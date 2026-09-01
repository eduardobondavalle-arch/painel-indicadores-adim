"use client";

import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { BLOCKS, INDICATORS } from "@/lib/indicators";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Manager = { id: string; name: string };

export function IndicatorFilters({ block, indicatorKey, managerId, month, year, managers }: { block: number; indicatorKey: string; managerId: string; month: number; year: number; managers: Manager[] }) {
  const [selectedBlock, setSelectedBlock] = useState(block);
  const [selectedIndicator, setSelectedIndicator] = useState(indicatorKey);
  const availableIndicators = useMemo(() => INDICATORS.filter((indicator) => indicator.block === selectedBlock), [selectedBlock]);
  const years = Array.from({ length: 8 }, (_, index) => new Date().getFullYear() + 1 - index);

  function changeBlock(value: number) {
    setSelectedBlock(value);
    setSelectedIndicator(INDICATORS.find((indicator) => indicator.block === value)?.key ?? "");
  }

  return (
    <form className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_2fr_1.4fr_1fr_1fr_auto]">
      <FilterField label="Categoria">
        <Select name="categoria" value={selectedBlock} onChange={(event) => changeBlock(Number(event.target.value))}>
          {BLOCKS.map((item) => <option key={item.number} value={item.number}>Bloco {item.number} — {item.title}</option>)}
        </Select>
      </FilterField>
      <FilterField label="Indicador">
        <Select name="indicador" value={selectedIndicator} onChange={(event) => setSelectedIndicator(event.target.value)}>
          {availableIndicators.map((indicator) => <option key={indicator.key} value={indicator.key}>{indicator.number}. {indicator.label}</option>)}
        </Select>
      </FilterField>
      <FilterField label="Gestora">
        <Select name="gestora" defaultValue={managerId}><option value="">Todas as gestoras</option>{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</Select>
      </FilterField>
      <FilterField label="Mês">
        <Select name="mes" defaultValue={month} className="capitalize">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, index, 1))}</option>)}</Select>
      </FilterField>
      <FilterField label="Ano">
        <Select name="ano" defaultValue={year}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</Select>
      </FilterField>
      <div className="flex items-end"><Button type="submit" className="w-full"><Filter className="size-4" />Aplicar filtros</Button></div>
    </form>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="label-caps">{label}<div className="mt-1 [&_select]:h-9 [&_select]:rounded-full">{children}</div></label>;
}
