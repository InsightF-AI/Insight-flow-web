/** Leitura das variáveis CSS do tema ativo — usado pelos gráficos (Lightweight
 * Charts e Recharts não aceitam classes Tailwind, só cores literais). */
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function chartPalette() {
  return {
    grid: cssVar('--chart-grid'),
    axis: cssVar('--chart-axis'),
    border: cssVar('--chart-border'),
    crosshair: cssVar('--chart-crosshair'),
    tooltipBg: cssVar('--chart-tooltip-bg'),
    tooltipBorder: cssVar('--chart-tooltip-border'),
    up: cssVar('--chart-up'),
    down: cssVar('--chart-down'),
    upFill: cssVar('--chart-up-fill'),
    downFill: cssVar('--chart-down-fill'),
    sma20: cssVar('--chart-sma20'),
    sma50: cssVar('--chart-sma50'),
    sma200: cssVar('--chart-sma200'),
    bollinger: cssVar('--chart-bollinger'),
    benchPortfolio: cssVar('--chart-bench-portfolio'),
    benchIndex: cssVar('--chart-bench-index'),
    benchCdi: cssVar('--chart-bench-cdi'),
    volumeNeutral: cssVar('--chart-volume-neutral'),
    categorical: [
      cssVar('--chart-sma20'),
      cssVar('--chart-bench-portfolio'),
      cssVar('--chart-sma200'),
      cssVar('--chart-sma50'),
      cssVar('--chart-axis'),
    ],
  };
}
