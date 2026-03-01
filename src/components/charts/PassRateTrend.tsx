import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import type { Run } from '../../types/supabase';
import { passRate, formatRelative } from '../../lib/formatters';

interface Props {
  runs: Run[];
}

interface ChartPoint {
  label: string;
  rate:  number;
}

export function PassRateTrend({ runs }: Props) {
  const data: ChartPoint[] = [...runs]
    .reverse()
    .slice(-30)
    .map(run => ({
      label: formatRelative(run.created_at),
      rate:  passRate(run.passed ?? 0, run.total ?? 0),
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted">
        No run data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E2230" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#64748B', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#64748B', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
        />
        <Tooltip
          contentStyle={{ background: '#111318', border: '1px solid #1E2230', borderRadius: 8 }}
          labelStyle={{ color: '#64748B', fontSize: 11 }}
          itemStyle={{ color: '#00E5FF' }}
          formatter={(v: number) => [`${v}%`, 'Pass rate']}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#00E5FF"
          strokeWidth={2}
          dot={{ fill: '#00E5FF', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#00E5FF' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
