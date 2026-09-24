import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatSchoolDate } from '../../utils/date.js';
import { formatPercent } from '../../utils/format.js';
import { AXIS_TICK, CHART_COLORS } from './chartTheme.js';
import { ChartFigure } from './ChartFigure.jsx';
import { summarizeTrend } from './summaries.js';

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-sm shadow-raised">
      <p className="font-semibold">
        {formatSchoolDate(point.date, { weekday: true, year: false })}
      </p>
      <p className="tabular-nums">
        {point.value == null ? 'No record' : formatPercent(point.value)}
      </p>
    </div>
  );
}

/**
 * Percentage over time (attendance rate per day). data: [{ date: 'YYYY-MM-DD', value }].
 * `threshold` draws the requirement line (e.g. 75) and is mentioned in the summary.
 * Animations follow prefers-reduced-motion (Recharts' default "auto").
 */
export function TrendLineChart({
  title,
  data,
  threshold,
  height = 220,
  unit = 'school day',
  className,
}) {
  const summary = summarizeTrend(data, { threshold, unit });
  return (
    <ChartFigure
      title={title}
      summary={summary}
      className={className}
      empty={!data.some((p) => p.value != null)}
      table={{
        columns: ['Date', 'Rate'],
        rows: data.map((p) => [
          formatSchoolDate(p.date, { weekday: true, year: false }),
          formatPercent(p.value),
        ]),
      }}
    >
      <ComposedChart
        data={data}
        responsive
        style={{ width: '100%', height }}
        margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        accessibilityLayer={false}
      >
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(date) => formatSchoolDate(date, { year: false })}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.grid }}
          minTickGap={24}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        {threshold != null && (
          <ReferenceLine
            y={threshold}
            stroke={CHART_COLORS.threshold}
            strokeDasharray="6 4"
            label={{
              value: `${threshold}%`,
              position: 'insideTopRight',
              fill: CHART_COLORS.threshold,
              fontSize: 12,
            }}
          />
        )}
        <Tooltip
          content={<TrendTooltip />}
          cursor={{ stroke: CHART_COLORS.grid, strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="none"
          fill={CHART_COLORS.area}
          fillOpacity={0.7}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={CHART_COLORS.line}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5, fill: CHART_COLORS.line, stroke: '#fff', strokeWidth: 2 }}
          connectNulls={false}
        />
      </ComposedChart>
    </ChartFigure>
  );
}
