import ReactFrappeChart from "react-frappe-charts";

type AppProps = { data: any };

export const DashboardLineChart: React.FC<AppProps> = ({ data }: AppProps) => {
  if (!data) {
    return <div>Loading...</div>;
  }

  const labels: string[] = [];
  const n_total: number[] = [];
  const n_finished: number[] = [];
  for (const row of data) {
    labels.push(row.createdAtDate);
    n_total.push(row.n_total);
    n_finished.push(row.n_finished);
  }

  return (
    <ReactFrappeChart
      type="line"
      colors={["light-green", "green"]}
      axisOptions={{
        xAxisMode: "tick",
        yAxisMode: "tick",
        xIsSeries: 1,
      }}
      lineOptions={{
        regionFill: 1,
        spline: 1,
      }}
      height={250}
      data={{
        labels: labels,
        datasets: [
          {
            name: "Total Sessions",
            values: n_total,
          },
          {
            name: "Finished Sessions",
            values: n_finished,
          },
        ],
      }}
    />
  );
};
