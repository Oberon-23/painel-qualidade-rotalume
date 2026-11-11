import { describe, expect, it } from 'vitest';
import { agg, prod } from './dados';
import { ATUAL, BASE_LINHA, fabrica, melhorAlavanca, simular } from './simulacao';

describe('simulação "e se"', () => {
  it('o cenário atual reproduz o OEE real dos últimos meses', () => {
    const meses = [...new Set(prod.map((r) => r.m))].sort((a, b) => a - b).slice(-3);
    simular(ATUAL).forEach((r, li) => {
      const real = agg(prod.filter((x) => x.line === li && meses.includes(x.m)));
      expect(r.OEE).toBeCloseTo(real.OEE, 2);
      expect(r.defeitoPct).toBeCloseTo(real.rate, 4);
    });
  });
  it('menos setup e preventiva aumentam a disponibilidade', () => {
    const a = simular(ATUAL)[0], b = simular({ ...ATUAL, setup: 10, preventiva: true })[0];
    expect(b.A).toBeGreaterThan(a.A);
    expect(b.boasTurno).toBeGreaterThan(a.boasTurno);
  });
  it('cada alavanca de qualidade mexe na linha certa', () => {
    const base = simular(ATUAL);
    const semFerr = simular({ ...ATUAL, trocaFerramenta: false });
    expect(semFerr[0].defeitoPct).toBeGreaterThan(base[0].defeitoPct * 2);
    expect(semFerr[1].defeitoPct).toBe(base[1].defeitoPct);
    expect(simular({ ...ATUAL, treinoTurnoC: false })[1].defeitoPct).toBeGreaterThan(base[1].defeitoPct);
    const umido = simular({ ...ATUAL, umidade: 75 });
    expect(umido[2].defeitoPct).toBeGreaterThan(base[2].defeitoPct * 1.5);
    expect(umido[2].motivo).toMatch(/umidade/);
  });
  it('correr acima do ritmo produz mais, mas com mais defeito', () => {
    const r = simular({ ...ATUAL, ritmo: 110 })[0], b = simular(ATUAL)[0];
    expect(r.produzidasTurno).toBeGreaterThan(b.produzidasTurno);
    expect(r.defeitoPct).toBeGreaterThan(b.defeitoPct);
  });
  it('custo e totais da fábrica são coerentes', () => {
    const f = fabrica(simular(ATUAL));
    expect(f.OEE).toBeGreaterThan(0.6);
    expect(f.OEE).toBeLessThan(0.9);
    expect(f.custoDia).toBeGreaterThan(0);
    expect(BASE_LINHA.every((b) => b.quebras >= 0)).toBe(true);
  });
  it('aponta a alavanca de maior ganho', () => {
    const m = melhorAlavanca({ ...ATUAL, umidade: 78 })!;
    expect(m.nome).toMatch(/umidade|setup/i);
    expect(m.ganho).toBeGreaterThan(0);
  });
});
