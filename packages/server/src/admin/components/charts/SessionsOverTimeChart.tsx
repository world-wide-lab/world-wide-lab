import type { SessionsOverTimeEntry } from "../../../analyses/index.js";
import { LineChart } from "./LineChart.js";

type SessionsOverTimeChartProps = {
  data: Array<SessionsOverTimeEntry> | null;
  height?: number;
};

// Number of started and finished sessions per day
export const SessionsOverTimeChart: React.FC<SessionsOverTimeChartProps> = ({
  data,
  height,
}: SessionsOverTimeChartProps) => {
  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <LineChart
      labels={data.map((entry) => entry.date)}
      datasets={[
        {
          name: "Total Sessions",
          values: data.map((entry) => entry.nSessions),
        },
        {
          name: "Finished Sessions",
          values: data.map((entry) => entry.nFinished),
        },
      ]}
      height={height}
    />
  );
};
