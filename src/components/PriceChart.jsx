import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { useUiStore } from '../store/index.js';
import { chartPalette } from '../lib/theme.js';

const line = (data, color, width = 1.5) => ({ data, color, width });

/** Gráfico de candles com overlays de SMA e Bollinger (Lightweight Charts). */
export default function PriceChart({ candles = [], indicators, moeda = 'BRL', height = 380 }) {
  const ref = useRef(null);
  const overlays = useUiStore((s) => s.overlays);
  const tema = useUiStore((s) => s.tema);

  useEffect(() => {
    if (!ref.current || candles.length === 0) return;
    const p = chartPalette();
    const chart = createChart(ref.current, {
      height,
      layout: { background: { color: 'transparent' }, textColor: p.axis, fontFamily: 'Inter, sans-serif' },
      grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
      rightPriceScale: { borderColor: p.border },
      timeScale: { borderColor: p.border, timeVisible: false },
      crosshair: { mode: 0, vertLine: { color: p.crosshair }, horzLine: { color: p.crosshair } },
      localization: {
        locale: 'pt-BR',
        priceFormatter: (v) =>
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, maximumFractionDigits: 2 }).format(v),
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: p.up,
      downColor: p.down,
      borderUpColor: p.up,
      borderDownColor: p.down,
      wickUpColor: p.up,
      wickDownColor: p.down,
    });
    candleSeries.setData(candles);

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      color: p.volumeNeutral,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeries.setData(
      candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? p.upFill : p.downFill })),
    );

    const asSeries = (values) =>
      candles.map((c, i) => ({ time: c.time, value: values?.[i] })).filter((v) => v.value != null);

    const add = ({ data, color, width }) => {
      const s = chart.addLineSeries({ color, lineWidth: width, priceLineVisible: false, lastValueVisible: false });
      s.setData(data);
    };

    if (indicators) {
      if (overlays.sma20) add(line(asSeries(indicators.sma20), p.sma20));
      if (overlays.sma50) add(line(asSeries(indicators.sma50), p.sma50));
      if (overlays.sma200) add(line(asSeries(indicators.sma200), p.sma200));
      if (overlays.bollinger) {
        add(line(asSeries(indicators.bollinger?.upper), p.bollinger, 1));
        add(line(asSeries(indicators.bollinger?.lower), p.bollinger, 1));
      }
    }

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: ref.current.clientWidth }));
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles, indicators, overlays, moeda, height, tema]);

  return <div ref={ref} className="w-full" />;
}
