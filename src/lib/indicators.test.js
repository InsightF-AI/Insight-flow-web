import { describe, expect, it } from 'vitest';

import { rsi, sma } from './indicators.js';

const serieQueSoSobe = Array.from({ length: 16 }, (_, i) => 100 + i);
const serieQueSoCai = Array.from({ length: 16 }, (_, i) => 100 - i);

describe('sma', () => {
  it('não devolve média antes de completar o período', () => {
    expect(sma([1, 2, 3, 4, 5], 3).slice(0, 2)).toEqual([null, null]);
  });

  it('devolve a média da janela a partir do período e desliza com a série', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('devolve uma posição por cotação, mesmo quando o período é maior que a série', () => {
    expect(sma([1, 2], 5)).toEqual([null, null]);
  });

  it('com período 1 devolve a própria série', () => {
    expect(sma([10, 20, 30], 1)).toEqual([10, 20, 30]);
  });

  it('devolve lista vazia para série vazia', () => {
    expect(sma([], 20)).toEqual([]);
  });
});

describe('rsi', () => {
  it('fica perto de 100 quando a série só sobe', () => {
    expect(rsi(serieQueSoSobe, 14).at(-1)).toBeGreaterThan(99.9);
  });

  it('fica perto de 0 quando a série só cai', () => {
    expect(rsi(serieQueSoCai, 14).at(-1)).toBeLessThan(0.1);
  });

  it('só tem valor a partir do índice do período', () => {
    const valores = rsi(serieQueSoSobe, 14);
    expect(valores[13]).toBeNull();
    expect(typeof valores[14]).toBe('number');
  });

  it('devolve uma posição por cotação', () => {
    expect(rsi(serieQueSoSobe, 14)).toHaveLength(serieQueSoSobe.length);
  });

  it('devolve lista vazia para série vazia', () => {
    expect(rsi([], 14)).toEqual([]);
  });
});
