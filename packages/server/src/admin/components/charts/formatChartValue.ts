// Charts call their formatting function for every point they draw, including
// points which do not exist (yet), so formatters have to be able to deal with
// values that are not numbers.
export function formatChartValue(
  format: ((value: number) => string) | undefined,
) {
  if (!format) {
    return undefined;
  }
  return (value: unknown): string => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? format(parsed) : "-";
  };
}
