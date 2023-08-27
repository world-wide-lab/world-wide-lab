import { AreaChart, XAxis, YAxis, Tooltip, Area, ResponsiveContainer } from "recharts"

type AppProps = { data: any };

export const DashboardLineChart: React.FC<AppProps> = ({ data }: AppProps) => {
  return(
    <ResponsiveContainer width={'100%'} aspect={4 / 1}>
      <AreaChart
        data={data}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.7}/>
            <stop offset="99%" stopColor="#8884d8" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorFinished" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.7}/>
            <stop offset="99%" stopColor="#82ca9d" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis dataKey="createdAtDate" tick={false} hide/>
        <YAxis allowDecimals={false}/>
        <Tooltip />
        <Area type="monotone" dataKey="n_total" stroke="#8884d8" fillOpacity={1} fill="url(#colorTotal)" />
        <Area type="monotone" dataKey="n_finished" stroke="#82ca9d" fillOpacity={1} fill="url(#colorFinished)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}