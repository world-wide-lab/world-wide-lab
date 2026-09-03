import ReactFrappeChart from "react-frappe-charts";
import { formatChartValue } from "./formatChartValue.js";

type LineChartProps = {
  labels: Array<string>;
  datasets: Array<{ name: string; values: Array<number> }>;
  colors?: Array<string>;
  height?: number;
  // Called to format the values shown in the chart's tooltip
  formatValue?: (value: number) => string;
};

// Generic line chart, used for all analyses over time
export const LineChart: React.FC<LineChartProps> = ({
  labels,
  datasets,
  colors = ["light-green", "green"],
  height = 250,
  formatValue,
}: LineChartProps) => {
  return (
    // @ts-ignore
    <ReactFrappeChart
      type="line"
      colors={colors}
      axisOptions={{
        xAxisMode: "tick",
        yAxisMode: "tick",
        xIsSeries: 1,
      }}
      lineOptions={{
        regionFill: 1,
        spline: 1,
      }}
      tooltipOptions={{ formatTooltipY: formatChartValue(formatValue) }}
      height={height}
      data={{ labels, datasets }}
    />
  );
};
