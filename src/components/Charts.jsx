import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { useUiStore } from '../store/index.js';
import { chartPalette } from '../lib/theme.js';

/** Recharts não observa variáveis CSS — recomputamos a paleta quando o tema muda. */
function usePalette() {
  const tema = useUiStore((s) => s.tema);
  return useMemo(() => chartPalette(), [tema]);
}

/** RSI(14) — RF-06. */
export function RsiChart({ candles = [], values = [], height = 130 }) {
  const p = usePalette();
  const axis = { stroke: p.axis, fontSize: 11, tickLine: false, axisLine: false };
  const tooltipStyle = {
    contentStyle: { background: p.tooltipBg, border: `1px solid ${p.tooltipBorder}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { color: p.axis },
  };
  const data = candles.map((c, i) => ({ time: c.time, rsi: values[i] })).filter((d) => d.rsi != null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="time" hide />
        <YAxis domain={[0, 100]} ticks={[30, 50, 70]} {...axis} />
        <ReferenceLine y={70} stroke={p.down} strokeDasharray="3 3" />
        <ReferenceLine y={30} stroke={p.up} strokeDasharray="3 3" />
        <Tooltip {...tooltipStyle} formatter={(v) => [v.toFixed(1), 'RSI(14)']} />
        <Line type="monotone" dataKey="rsi" stroke={p.sma20} strokeWidth={1.6} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** MACD (12, 26, 9) — RF-06. */
export function MacdChart({ candles = [], macd, height = 130 }) {
  const p = usePalette();
  const axis = { stroke: p.axis, fontSize: 11, tickLine: false, axisLine: false };
  const tooltipStyle = {
    contentStyle: { background: p.tooltipBg, border: `1px solid ${p.tooltipBorder}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { color: p.axis },
  };
  const data = macd
    ? candles
        .map((c, i) => ({ time: c.time, hist: macd.hist?.[i], line: macd.line?.[i], signal: macd.signal?.[i] }))
        .filter((d) => d.line != null)
    : [];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="time" hide />
        <YAxis {...axis} />
        <ReferenceLine y={0} stroke={p.border} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [Number(v).toFixed(3), n]} />
        <Bar dataKey="hist" name="Histograma">
          {data.map((d, i) => (
            <Cell key={i} fill={d.hist >= 0 ? p.upFill : p.downFill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Carteira vs. benchmarks (RF-11) — base 100. */
export function BenchmarkChart({ data = [], height = 240 }) {
  const p = usePalette();
  const axis = { stroke: p.axis, fontSize: 11, tickLine: false, axisLine: false };
  const tooltipStyle = {
    contentStyle: { background: p.tooltipBg, border: `1px solid ${p.tooltipBorder}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { color: p.axis },
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <XAxis dataKey="data" {...axis} tickFormatter={(d) => d.slice(5).replace('-', '/')} minTickGap={28} />
        <YAxis {...axis} domain={['dataMin - 2', 'dataMax + 2']} />
        <Tooltip {...tooltipStyle} formatter={(v, n) => [Number(v).toFixed(2), n]} />
        <Line type="monotone" dataKey="carteira" name="Carteira" stroke={p.benchPortfolio} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="ibovespa" name="Ibovespa" stroke={p.benchIndex} strokeWidth={1.4} dot={false} />
        <Line
          type="monotone"
          dataKey="cdi"
          name="CDI"
          stroke={p.benchCdi}
          strokeWidth={1.4}
          strokeDasharray="4 3"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Donut de distribuição (classe/setor/moeda) — RF-12. */
export function DonutChart({ data = [], height = 190 }) {
  const p = usePalette();
  const tooltipStyle = {
    contentStyle: { background: p.tooltipBg, border: `1px solid ${p.tooltipBorder}`, borderRadius: 8, fontSize: 12 },
    labelStyle: { color: p.axis },
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="pct" nameKey="nome" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="none">
          {data.map((d, i) => (
            <Cell key={d.nome} fill={p.categorical[i % p.categorical.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v, n) => [`${Number(v).toFixed(1)}%`, n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Sparkline compacto usado nos cards de watchlist. */
export function Sparkline({ candles = [], height = 34, positive = true }) {
  const p = usePalette();
  const data = candles.slice(-40).map((c, i) => ({ i, v: c.close }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={positive ? p.up : p.down} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
