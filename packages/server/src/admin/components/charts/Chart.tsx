import ReactFrappeChart from "react-frappe-charts";

type ChartProps = {
  type: "line" | "bar";
  labels: Array<string>;
  datasets: Array<{ name: string; values: Array<number> }>;
  colors?: Array<string>;
  height?: number;
  // Called to format the values shown in the chart's tooltip. Charts call this
  // for every point they draw, including points which do not exist (yet), so
  // values which are not numbers have to be dealt with as well.
  formatValue?: (value: number) => string;
};

// The one chart used across the admin UI, drawn as a line or as bars
export const Chart: React.FC<ChartProps> = ({
  type,
  labels,
  datasets,
  colors = ["light-green", "green"],
  height = 250,
  formatValue,
}: ChartProps) => (
  // @ts-ignore
  <ReactFrappeChart
    type={type}
    colors={colors}
    axisOptions={{
      xAxisMode: "tick",
      yAxisMode: "tick",
      ...(type === "line" ? { xIsSeries: 1 } : {}),
    }}
    lineOptions={{ regionFill: 1, spline: 1 }}
    tooltipOptions={{
      formatTooltipY: formatValue
        ? (value: unknown) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? formatValue(parsed) : "-";
          }
        : undefined,
    }}
    height={height}
    data={{ labels, datasets }}
  />
);
