import ReactFrappeChart from "react-frappe-charts";
import { formatChartValue } from "./formatChartValue.js";

type BarChartProps = {
  labels: Array<string>;
  values: Array<number>;
  name: string;
  colors?: Array<string>;
  height?: number;
  // Called to format the values shown in the chart's tooltip
  formatValue?: (value: number) => string;
};

// Generic bar chart, used to compare values between studies or categories
export const BarChart: React.FC<BarChartProps> = ({
  labels,
  values,
  name,
  colors = ["green"],
  height = 250,
  formatValue,
}: BarChartProps) => {
  return (
    // @ts-ignore
    <ReactFrappeChart
      type="bar"
      colors={colors}
      axisOptions={{
        xAxisMode: "tick",
        yAxisMode: "tick",
      }}
      tooltipOptions={{ formatTooltipY: formatChartValue(formatValue) }}
      height={height}
      data={{ labels, datasets: [{ name, values }] }}
    />
  );
};
