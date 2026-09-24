import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatPercent } from '../../utils/format.js';
import { AXIS_TICK, CHART_COLORS } from './chartTheme.js';
import { ChartFigure } from './ChartFigure.jsx';
import { summarizeComparison } from './summaries.js';

function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2 text-sm shadow-raised">
      <p className="font-semibold">{item.label}</p>
      <p className="tabular-nums">{formatPercent(item.value)}</p>
    </div>
  );
}

/**
 * Percentages side by side (e.g. attendance per class). Horizontal bars so long labels fit on a
 * phone. Every bar carries its value as text; bars below `threshold` are cerise and the summary
 * names them, so colour is not the only signal.
 */
export function ComparisonBarChart({ title, data, threshold, className }) {
  const summary = summarizeComparison(data, { threshold });
  const height = Math.max(120, data.length * 44 + 40);
  const colorOf = (value) =>
    threshold != null && value < threshold ? CHART_COLORS.low : CHART_COLORS.good;

  return (
    <ChartFigure
      title={title}
      summary={summary}
      className={className}
      empty={!data.some((d) => d.value != null)}
      table={{
        columns: ['Group', 'Rate'],
        rows: data.map((d) => [d.label, formatPercent(d.value)]),
      }}
    >
      <BarChart
        data={data}
        layout="vertical"
        responsive
        style={{ width: '100%', height }}
        margin={{ top: 4, right: 48, bottom: 0, left: 4 }}
        accessibilityLayer={false}
      >
        <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ ...AXIS_TICK, fill: '#1e2616' }}
          tickLine={false}
          axisLine={false}
          width={96}
        />
        {threshold != null && (
          <ReferenceLine x={threshold} stroke={CHART_COLORS.threshold} strokeDasharray="6 4" />
        )}
        <Tooltip content={<BarTooltip />} cursor={{ fill: '#fdefea' }} />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={22}>
          {data.map((d) => (
            <Cell key={d.label} fill={colorOf(d.value)} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={formatPercent}
            fill="#1e2616"
            fontSize={13}
            fontWeight={600}
          />
        </Bar>
      </BarChart>
    </ChartFigure>
  );
}
