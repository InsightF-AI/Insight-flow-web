/** Indicadores técnicos (RF-06) calculados sobre séries OHLCV. */

export function sma(values, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev = null;
  values.forEach((v, i) => {
    if (i < period - 1) return out.push(null);
    if (prev === null) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out.push(prev);
  });
  return out;
}

export function rsi(values, period = 14) {
  const out = [null];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = Math.max(diff, 0);
    const l = Math.max(-diff, 0);
    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        gain /= period;
        loss /= period;
        out.push(100 - 100 / (1 + gain / (loss || 1e-9)));
      } else out.push(null);
    } else {
      gain = (gain * (period - 1) + g) / period;
      loss = (loss * (period - 1) + l) / period;
      out.push(100 - 100 / (1 + gain / (loss || 1e-9)));
    }
  }
  return out;
}

export function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line = values.map((_, i) => (f[i] != null && s[i] != null ? f[i] - s[i] : null));
  const defined = line.map((v) => v ?? 0);
  const sig = ema(defined, signalPeriod).map((v, i) => (line[i] == null ? null : v));
  const hist = line.map((v, i) => (v != null && sig[i] != null ? v - sig[i] : null));
  return { line, signal: sig, hist };
}

export function bollinger(values, period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper = [];
  const lower = [];
  for (let i = 0; i < values.length; i++) {
    if (mid[i] == null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const win = values.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const sd = Math.sqrt(win.reduce((a, v) => a + (v - mean) ** 2, 0) / period);
    upper.push(mean + mult * sd);
    lower.push(mean - mult * sd);
  }
  return { mid, upper, lower };
}

export function relativeVolume(volumes, period = 20) {
  const avg = sma(volumes, period);
  return volumes.map((v, i) => (avg[i] ? v / avg[i] : null));
}

/** Consolida todos os indicadores da série (equivalente a IndicadorService.calcular_todos). */
export function computeIndicators(candles) {
  const close = candles.map((c) => c.close);
  const volume = candles.map((c) => c.volume);
  const bb = bollinger(close, 20, 2);
  const m = macd(close);
  return {
    sma20: sma(close, 20),
    sma50: sma(close, 50),
    sma200: sma(close, 200),
    rsi14: rsi(close, 14),
    macd: m,
    bollinger: bb,
    volRel: relativeVolume(volume, 20),
  };
}

export const lastDefined = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
};
