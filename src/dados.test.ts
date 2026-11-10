import { describe, expect, test } from 'vitest';
import { agg, BASE, LINES, pareto, prod, rowsP, spc, type Filtro } from './dados';
import { statusOf } from './kit/formato';

const TUDO: Filtro = { periodo: { from: 0, to: 11 }, linha: 'all', turno: 'all' };

describe('OEE', () => {
  test('é o produto de disponibilidade, performance e qualidade', () => {
    const a = agg(rowsP(TUDO));
    expect(a.OEE).toBeCloseTo(a.A * a.P * a.Q, 12);
    for (const x of [a.A, a.P, a.Q, a.OEE]) { expect(x).toBeGreaterThan(0); expect(x).toBeLessThanOrEqual(1); }
  });
  test('a soma das linhas é igual ao total', () => {
    const total = agg(rowsP(TUDO)).produced;
    const porLinha = LINES.map((_, i) => agg(rowsP({ ...TUDO, linha: String(i) })).produced).reduce((s, x) => s + x, 0);
    expect(porLinha).toBe(total);
  });
});

describe('Pareto', () => {
  test('o acumulado chega a 100% e está em ordem decrescente', () => {
    const p = pareto(prod);
    expect(p[p.length - 1].cum).toBeCloseTo(1, 10);
    for (let i = 1; i < p.length; i++) expect(p[i].n).toBeLessThanOrEqual(p[i - 1].n);
  });
});

describe('carta de controle', () => {
  test('limites simétricos em torno do centro e amostras com 5 peças', () => {
    BASE.forEach((b) => { expect(b.ucl - b.xbb).toBeCloseTo(b.xbb - b.lcl, 10); expect(b.rucl).toBeGreaterThan(b.rb); });
    expect(spc.every((s) => s.vals.length === 5)).toBe(true);
  });
});

describe('situação de um indicador', () => {
  test('na meta, perto e fora', () => {
    expect(statusOf(0.8, 0.75)).toBe('ok');
    expect(statusOf(0.74, 0.75)).toBe('warn');
    expect(statusOf(0.5, 0.75)).toBe('bad');
    expect(statusOf(0.02, 0.03, false)).toBe('ok');
  });
});
