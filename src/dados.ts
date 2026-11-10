/*
 * Base fictícia da Rotalume Indústria: produção por linha e turno,
 * medições para CEP e não conformidades, de nov/2025 a out/2026.
 * Gerada com semente fixa: os números são sempre os mesmos.
 */
import { rng } from './kit/rng';
import { clamp, mean, sum } from './kit/formato';
import { MONTHS, monthIdx, type Periodo } from './kit/meses';

const R = rng(20261031);
const { r: rnd, n: randn, between, binom, pickW } = R;
export const DAY = 86400000;
const T0 = Date.UTC(2025, 10, 1), T1 = Date.UTC(2026, 9, 31);
export const HOJE = T1;

export type Linha = {
  id: string; nome: string; curto: string; ciclo: number; perf: number; baseDef: number; custo: number;
  carac: { art: string; nome: string; un: string; nom: number; lie: number; lse: number; sd: number; dec: number };
  defeitos: string[]; mix: number[];
};

export const LINES: Linha[] = [
  { id: 'L1', nome: 'Usinagem CNC', curto: 'L1 Usinagem', ciclo: 0.5, perf: 0.90, baseDef: 0.016, custo: 38,
    carac: { art: 'O', nome: 'Diâmetro do eixo', un: 'mm', nom: 25.000, lie: 24.950, lse: 25.050, sd: 0.0095, dec: 3 },
    defeitos: ['Dimensional fora de especificação', 'Rebarba', 'Risco superficial', 'Rosca danificada'], mix: [0.46, 0.27, 0.17, 0.10] },
  { id: 'L2', nome: 'Montagem', curto: 'L2 Montagem', ciclo: 0.8, perf: 0.87, baseDef: 0.019, custo: 55,
    carac: { art: 'O', nome: 'Torque de aperto', un: 'N·m', nom: 12.0, lie: 11.0, lse: 13.0, sd: 0.24, dec: 2 },
    defeitos: ['Torque fora de especificação', 'Componente faltante', 'Montagem invertida', 'Risco superficial'], mix: [0.44, 0.24, 0.12, 0.20] },
  { id: 'L3', nome: 'Pintura', curto: 'L3 Pintura', ciclo: 0.6, perf: 0.89, baseDef: 0.019, custo: 24,
    carac: { art: 'A', nome: 'Espessura da tinta', un: 'µm', nom: 80, lie: 65, lse: 95, sd: 3.4, dec: 1 },
    defeitos: ['Bolha', 'Escorrimento', 'Espessura baixa', 'Contaminação'], mix: [0.44, 0.28, 0.17, 0.11] },
];
export const SHIFTS = ['A', 'B', 'C'];
const SHIFT_F = [1.0, 1.08, 1.15], PLANNED = 450;

export type Prod = {
  t: number; m: number; line: number; shift: number; planned: number; run: number; produced: number; ideal: number;
  defects: number; byType: number[]; scrap: number; rework: number; cost: number;
};
export type Amostra = { t: number; m: number; line: number; shift: number; vals: number[]; mean: number; range: number };

export const prod: Prod[] = [];
export const spc: Amostra[] = [];
const tWear0 = Date.UTC(2026, 3, 1), tWear1 = Date.UTC(2026, 5, 1);
let dayN = 0;
for (let t = T0; t <= T1; t += DAY) {
  const dow = new Date(t).getUTCDay(); if (dow === 0 || dow === 6) continue;
  const m = monthIdx(t), wear = t >= tWear0 && t < tWear1, l2c = m >= 2 && m <= 8, humid = m >= 2 && m <= 4;
  LINES.forEach((L, li) => {
    for (let s = 0; s < 3; s++) {
      let down = between(32, 64);
      if (rnd() < 0.035) down += between(60, 170);
      if (li === 0 && wear) down += between(12, 28);
      const run = Math.max(120, PLANNED - down);
      const perf = clamp(L.perf + randn() * 0.025, 0.7, 0.99);
      const produced = Math.floor(run / L.ciclo * perf);
      let p = L.baseDef * SHIFT_F[s], mix = L.mix;
      if (li === 0 && wear) { p *= 1.4 + 1.1 * ((t - tWear0) / (tWear1 - tWear0)); mix = [0.70, 0.15, 0.10, 0.05]; }
      if (li === 1 && s === 2 && l2c) { p *= 2.0; mix = [0.62, 0.16, 0.08, 0.14]; }
      if (li === 2 && humid) { p *= 1.55; mix = [0.55, 0.30, 0.09, 0.06]; }
      p *= (1 - 0.01 * m) * Math.exp(randn() * 0.16);
      const defects = Math.min(produced, binom(produced, p));
      const byType = [0, 0, 0, 0];
      for (let k = 0; k < defects; k++) byType[pickW(mix)]++;
      const sc = Math.min(defects, binom(defects, 0.4));
      prod.push({ t, m, line: li, shift: s, planned: PLANNED, run, produced, ideal: produced * L.ciclo, defects, byType, scrap: sc, rework: defects - sc, cost: sc * L.custo + (defects - sc) * L.custo * 0.3 });
    }
  });
  const sShift = dayN % 3;
  LINES.forEach((L, li) => {
    const c = L.carac; let mu = c.nom, sd = c.sd;
    if (li === 0 && wear) mu += 0.008 + 0.030 * ((t - tWear0) / (tWear1 - tWear0));
    if (li === 1 && sShift === 2 && l2c) { sd *= 1.75; mu += 0.12; }
    if (li === 2 && humid) { mu += 3.8; sd *= 1.2; }
    const vals: number[] = []; for (let k = 0; k < 5; k++) vals.push(mu + sd * randn());
    spc.push({ t, m, line: li, shift: sShift, vals, mean: vals.reduce((a, b) => a + b, 0) / 5, range: Math.max(...vals) - Math.min(...vals) });
  });
  dayN++;
}

/* ---------------- não conformidades ---------------- */
export const ORIGENS = ['Inspeção de processo', 'Auditoria interna', 'Reclamação de cliente', 'Fornecedor'];
export const CAUSAS = ['Método', 'Máquina', 'Mão de obra', 'Material', 'Medição', 'Meio ambiente'];
export const AREA: Record<string, string> = { 'Método': 'Engenharia de processos', 'Máquina': 'Manutenção', 'Mão de obra': 'Produção', 'Material': 'Suprimentos', 'Medição': 'Metrologia', 'Meio ambiente': 'Facilities' };
export const GRAV = ['Menor', 'Maior', 'Crítica'] as const;
export type Grav = (typeof GRAV)[number];
export const PRAZO: Record<Grav, number> = { 'Menor': 45, 'Maior': 30, 'Crítica': 15 };
const MED_CLOSE: Record<Grav, number> = { 'Menor': 36, 'Maior': 28, 'Crítica': 13 };
const AUDIT = ['Instrução de trabalho desatualizada no posto', 'Registro de inspeção incompleto', 'Instrumento de medição com calibração vencida', 'Material não conforme sem identificação', 'Treinamento do posto sem registro'];
const FORN: [string, number | null][] = [['Matéria-prima com dureza fora do especificado', 0], ['Lote de tinta com viscosidade fora do padrão', 2], ['Parafusos com rosca irregular no recebimento', 1], ['Certificado de qualidade ausente no recebimento', null]];

export type Etapa = 'Planejar' | 'Executar' | 'Verificar' | 'Agir' | 'Encerrada';
export type NC = {
  code: string; open: number; m: number; line: number; origem: string; causa: string; area: string; grav: Grav; desc: string;
  prazo: number; close: number | null; reinc: boolean; isOpen: boolean; late: boolean; closedLate: boolean; age: number; stage: Etapa;
};
type NovaNC = { open: number; m: number; line: number; origem: string; causa: string; area: string; grav: Grav; desc: string; close?: number; reinc?: boolean };

const brutas: Omit<NC, 'code' | 'isOpen' | 'late' | 'closedLate' | 'age' | 'stage'>[] = [];
function addNC(o: NovaNC) {
  const days = Math.max(3, Math.round(MED_CLOSE[o.grav] * Math.exp(randn() * 0.55)));
  const close = o.close ?? (o.open + days * DAY);
  brutas.push({ ...o, prazo: o.open + PRAZO[o.grav] * DAY, close: close <= HOJE ? close : null, reinc: o.reinc ?? (rnd() < 0.11) });
}
for (let t = T0; t <= T1 - 2 * DAY; t += DAY) {
  const dow = new Date(t).getUTCDay(); if (dow === 0 || dow === 6) continue;
  const m = monthIdx(t);
  if (rnd() > 0.36) continue;
  const origem = ORIGENS[pickW([0.45, 0.18, 0.14, 0.23])];
  let line = pickW([1, 1.1, 1]), causa: string, desc: string;
  const L = LINES[line];
  if (origem === 'Auditoria interna') { desc = AUDIT[Math.floor(rnd() * AUDIT.length)]; causa = desc.includes('calibração') ? 'Medição' : desc.includes('Treinamento') ? 'Mão de obra' : 'Método'; }
  else if (origem === 'Fornecedor') { const f = FORN[Math.floor(rnd() * FORN.length)]; desc = f[0]; if (f[1] !== null) line = f[1]; causa = 'Material'; }
  else { const d = L.defeitos[pickW(L.mix)]; desc = origem === 'Reclamação de cliente' ? `Cliente reportou ${d.toLowerCase()} em lote entregue` : `${d} acima do limite de alerta`; causa = CAUSAS[pickW([0.3, 0.25, 0.2, 0.08, 0.1, 0.07])]; }
  const grav = origem === 'Reclamação de cliente' ? GRAV[pickW([0.2, 0.55, 0.25])] : GRAV[pickW([0.6, 0.33, 0.07])];
  addNC({ open: t, m, line, origem, causa, area: AREA[causa], grav, desc });
}
const D = (y: number, mo: number, d: number) => Date.UTC(y, mo - 1, d);
([
  { open: D(2026, 1, 20), line: 2, origem: 'Inspeção de processo', causa: 'Meio ambiente', grav: 'Maior', desc: 'Bolhas na pintura acima do limite de alerta com umidade relativa acima de 75%', close: D(2026, 3, 18) },
  { open: D(2026, 2, 24), line: 1, origem: 'Inspeção de processo', causa: 'Mão de obra', grav: 'Maior', desc: 'Torque fora de especificação recorrente no turno C', close: D(2026, 8, 14) },
  { open: D(2026, 4, 22), line: 0, origem: 'Inspeção de processo', causa: 'Máquina', grav: 'Maior', desc: 'Diâmetro do eixo acima do limite de controle: desgaste de ferramenta no torno CNC', close: D(2026, 6, 10) },
  { open: D(2026, 5, 18), line: 0, origem: 'Reclamação de cliente', causa: 'Máquina', grav: 'Crítica', desc: 'Cliente reportou eixos com diâmetro acima da especificação', close: D(2026, 6, 12) },
  { open: D(2026, 10, 6), line: 0, origem: 'Auditoria interna', causa: 'Medição', grav: 'Maior', desc: 'Micrômetro do posto L1 com calibração vencida', close: null },
  { open: D(2026, 9, 10), line: 1, origem: 'Fornecedor', causa: 'Material', grav: 'Crítica', desc: 'Lote de parafusos com rosca irregular bloqueado no recebimento', close: null },
] as { open: number; line: number; origem: string; causa: string; grav: Grav; desc: string; close: number | null }[]).forEach((o) => {
  addNC({ ...o, m: monthIdx(o.open), area: AREA[o.causa], reinc: false, close: o.close === null ? HOJE + 999 * DAY : o.close });
});
brutas.sort((a, b) => a.open - b.open);
const seqN: Record<number, number> = {};
export const ncs: NC[] = brutas.map((n) => {
  const y = new Date(n.open).getUTCFullYear(); seqN[y] = (seqN[y] || 0) + 1;
  const isOpen = n.close === null;
  const age = Math.round(((isOpen ? HOJE : n.close!) - n.open) / DAY);
  let stage: Etapa = 'Encerrada', reinc = n.reinc;
  if (isOpen) {
    const f = (HOJE - n.open) / (PRAZO[n.grav] * DAY);
    stage = f < 0.25 ? 'Planejar' : f < 0.55 ? 'Executar' : f < 0.85 ? 'Verificar' : 'Agir';
    reinc = false;
  }
  return { ...n, reinc, code: `NC-${y}-${String(seqN[y]).padStart(3, '0')}`, isOpen, late: isOpen && n.prazo < HOJE, closedLate: !isOpen && n.close! > n.prazo, age, stage };
});

/* ---------------- consultas ---------------- */
export const META = { oee: 0.75, fpy: 0.98 };

export type Filtro = { periodo: Periodo; linha: string; turno: string };
export const inL = (f: Filtro, r: { line: number }) => f.linha === 'all' || r.line === +f.linha;
export const inS = (f: Filtro, r: { shift: number }) => f.turno === 'all' || r.shift === +f.turno;
export const rowsP = (f: Filtro, from = f.periodo.from, to = f.periodo.to) => prod.filter((r) => r.m >= from && r.m <= to && inL(f, r) && inS(f, r));
export const lineIdx = (f: Filtro) => (f.linha === 'all' ? [0, 1, 2] : [+f.linha]);

export type Agg = { planned: number; run: number; ideal: number; produced: number; defects: number; scrap: number; rework: number; cost: number; A: number; P: number; Q: number; OEE: number; rate: number };
export function agg(rows: Prod[]): Agg {
  const a = { planned: sum(rows, (r) => r.planned), run: sum(rows, (r) => r.run), ideal: sum(rows, (r) => r.ideal), produced: sum(rows, (r) => r.produced), defects: sum(rows, (r) => r.defects), scrap: sum(rows, (r) => r.scrap), rework: sum(rows, (r) => r.rework), cost: sum(rows, (r) => r.cost) } as Agg;
  a.A = a.run / a.planned; a.P = a.ideal / a.run; a.Q = (a.produced - a.defects) / a.produced; a.OEE = a.A * a.P * a.Q; a.rate = a.defects / a.produced;
  return a;
}

export type ItemPareto = { name: string; n: number; share: number; prev: number; cum: number; vital: boolean };
export function pareto(rows: Prod[]): ItemPareto[] {
  const m = new Map<string, { name: string; n: number }>();
  rows.forEach((r) => LINES[r.line].defeitos.forEach((d, k) => { if (r.byType[k]) { const e = m.get(d) || { name: d, n: 0 }; e.n += r.byType[k]; m.set(d, e); } }));
  const arr = [...m.values()].sort((a, b) => b.n - a.n), tot = sum(arr, (x) => x.n);
  let c = 0;
  return arr.map((x) => { const prev = c; c += x.n; return { ...x, share: x.n / tot, prev, cum: c / tot, vital: prev / tot < 0.8 }; });
}

/* ---------------- CEP ---------------- */
export const A2 = 0.577, D4 = 2.114, d2 = 2.326;
/** limites de controle calculados nos 25 primeiros dias de cada linha */
export const BASE = LINES.map((_, li) => {
  const sg = spc.filter((s) => s.line === li).slice(0, 25);
  const xbb = mean(sg.map((x) => x.mean)), rb = mean(sg.map((x) => x.range));
  return { xbb, rb, ucl: xbb + A2 * rb, lcl: xbb - A2 * rb, rucl: D4 * rb };
});

export const mesesComDados = MONTHS;
