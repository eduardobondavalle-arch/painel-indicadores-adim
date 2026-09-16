export type IndicatorPeriod = {
  reference_month: number;
  reference_year: number;
  status: string;
};

type PeriodSelection = { mes?: string; ano?: string };

export function resolveIndicatorPeriod(
  params: PeriodSelection,
  periods: IndicatorPeriod[],
  today = new Date(),
) {
  const latest = [...periods].sort((a, b) =>
    b.reference_year - a.reference_year || b.reference_month - a.reference_month,
  );
  const defaultPeriod = latest.find((period) => period.status === "open") ?? latest[0];
  const requestedMonth = Number(params.mes);
  const requestedYear = Number(params.ano);

  return {
    month: Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
      ? requestedMonth
      : defaultPeriod?.reference_month ?? today.getMonth() + 1,
    year: Number.isInteger(requestedYear) && requestedYear >= 1900 && requestedYear <= 9999
      ? requestedYear
      : defaultPeriod?.reference_year ?? today.getFullYear(),
  };
}
