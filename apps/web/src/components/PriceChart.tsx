import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Point = { date: string; close?: number; predicted?: number; low?: number; high?: number }

export function PriceChart({
  data,
  showForecast = false,
}: {
  data: Point[]
  showForecast?: boolean
}) {
  if (!data.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl bg-white/60 text-sm text-ink-soft/60">
        No chart data available
      </div>
    )
  }

  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="closeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#d5e0d9" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#5a7268' }}
            tickFormatter={(v: string) => v.slice(5)}
            minTickGap={40}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fontSize: 11, fill: '#5a7268' }}
            width={56}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v.toLocaleString('en-IN')}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #d5e0d9',
              background: '#fff',
              fontSize: 12,
            }}
            formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#0f766e"
            strokeWidth={2}
            fill="url(#closeFill)"
            connectNulls={false}
            name="Close"
          />
          {showForecast && (
            <>
              <Area
                type="monotone"
                dataKey="high"
                stroke="none"
                fill="#c45c26"
                fillOpacity={0.08}
                connectNulls
                name="Forecast high"
              />
              <Area
                type="monotone"
                dataKey="low"
                stroke="none"
                fill="#fff"
                fillOpacity={1}
                connectNulls
                name="Forecast low"
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#c45c26"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
                name="Predicted"
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
