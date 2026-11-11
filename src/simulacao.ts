/*
 * Simulação "e se" da fábrica.
 *
 * Modelo simples e explicável: parte dos números reais dos últimos 3 meses de cada
 * linha e aplica o efeito de cada alavanca. Não é previsão; é para mostrar a ordem
 * de grandeza e qual alavanca mexe mais no OEE, no refugo e no custo.
 *
 *   OEE = Disponibilidade × Performance × Qualidade
 *   Disponibilidade = (tempo planejado − setup − quebras) ÷ tempo planejado
 *   Performance     = ritmo real ÷ ritmo ideal (cai se a linha andar acima do ritmo)
 *   Qualidade       = peças boas ÷ peças produzidas
 */
import { agg, LINES, prod } from './dados';

export const TURNO_MIN = 450;
export const TURNOS_DIA = 3;
const ULTIMOS = 3; // meses usados como linha de base

export type Cenario = {
  /** minutos de setup por turno (troca de produto) */
  setup: number;
  /** manutenção preventiva semanal: reduz as quebras */
  preventiva: boolean;
  /** L1: troca da ferramenta pela vida útil (contador de peças) */
  trocaFerramenta: boolean;
  /** L2: turno C treinado no aperto com torquímetro */
  treinoTurnoC: boolean;
  /** L3: umidade relativa na cabine de pintura (%) */
  umidade: number;
  /** ritmo da linha em % do ciclo ideal */
  ritmo: number;
};

/** Como a fábrica está hoje (situação dos últimos meses). */
export const ATUAL: Cenario = { setup: 30, preventiva: false, trocaFerramenta: true, treinoTurnoC: true, umidade: 52, ritmo: 100 };

export type Resultado = {
  linha: number;
  A: number; P: number; Q: number; OEE: number;
  produzidasTurno: number; boasTurno: number; defeitoPct: number;
  custoDia: number; paradoMin: number;
  /** por que a qualidade mudou, em palavras */
  motivo: string | null;
};

/** Linha de base de cada linha: médias reais dos últimos meses. */
export const BASE_LINHA = LINES.map((L, li) => {
  const meses = [...new Set(prod.map((r) => r.m))].sort((a, b) => a - b).slice(-ULTIMOS);
  const a = agg(prod.filter((r) => r.line === li && meses.includes(r.m)));
  const parado = (1 - a.A) * TURNO_MIN; // minutos parados por turno
  return {
    parado,
    setup: ATUAL.setup,
    quebras: Math.max(0, parado - ATUAL.setup),
    P: a.P,
    def: a.rate,
    custoPorDefeito: a.cost / Math.max(1, a.defects),
    ciclo: L.ciclo,
  };
});

/** Fator do defeito do turno C da montagem quando não está treinado (o problema de mar–set). */
const TURNO_C_SEM_TREINO = (1 + 1.08 + 1.15 * 2.0) / (1 + 1.08 + 1.15);

export function simular(c: Cenario): Resultado[] {
  return BASE_LINHA.map((b, li) => {
    const quebras = b.quebras * (c.preventiva ? 0.55 : 1) + (c.preventiva ? 4 : 0); // a preventiva também ocupa a máquina
    const parado = Math.min(TURNO_MIN - 60, c.setup + quebras);
    const A = (TURNO_MIN - parado) / TURNO_MIN;
    const acima = Math.max(0, c.ritmo - 100);
    const P = Math.min(0.99, b.P * (c.ritmo / 100) * (1 - acima * 0.006));

    let f = 1 + acima * 0.045; // correr acima do ritmo gera defeito
    const motivos: string[] = [];
    if (acima > 0) motivos.push('ritmo acima do ideal');
    if (li === 0 && !c.trocaFerramenta) { f *= 2.1; motivos.push('ferramenta usada além da vida útil'); }
    if (li === 1 && !c.treinoTurnoC) { f *= TURNO_C_SEM_TREINO; motivos.push('turno C sem treinamento de torque'); }
    if (li === 2) {
      const u = c.umidade;
      const fu = u > 60 ? 1 + (u - 60) * 0.045 : u < 40 ? 1 + (40 - u) * 0.02 : 1;
      if (fu > 1) motivos.push(u > 60 ? 'umidade alta na cabine (bolhas)' : 'ar seco demais (poeira e contaminação)');
      f *= fu;
    }
    const def = Math.min(0.5, b.def * f);
    const Q = 1 - def;
    const produzidas = ((TURNO_MIN - parado) / b.ciclo) * P;
    const custoDia = produzidas * def * b.custoPorDefeito * TURNOS_DIA;
    return { linha: li, A, P, Q, OEE: A * P * Q, produzidasTurno: produzidas, boasTurno: produzidas * Q, defeitoPct: def, custoDia, paradoMin: parado, motivo: motivos.length ? motivos.join(', ') : null };
  });
}

/** Totais da fábrica (as três linhas). */
export function fabrica(r: Resultado[]) {
  const prodT = r.reduce((s, x) => s + x.produzidasTurno, 0);
  return {
    OEE: r.reduce((s, x) => s + x.OEE, 0) / r.length,
    boasDia: r.reduce((s, x) => s + x.boasTurno, 0) * TURNOS_DIA,
    defeitoPct: r.reduce((s, x) => s + x.produzidasTurno * x.defeitoPct, 0) / prodT,
    custoDia: r.reduce((s, x) => s + x.custoDia, 0),
  };
}

/** Alavanca que mais melhora o OEE da fábrica a partir do cenário escolhido. */
export function melhorAlavanca(c: Cenario): { nome: string; ganho: number } | null {
  const base = fabrica(simular(c)).OEE;
  const tentativas: [string, Cenario][] = [
    ['Reduzir o setup para 15 min (SMED)', { ...c, setup: Math.min(c.setup, 15) }],
    ['Fazer manutenção preventiva', { ...c, preventiva: true }],
    ['Trocar a ferramenta pela vida útil', { ...c, trocaFerramenta: true }],
    ['Treinar o turno C no torque', { ...c, treinoTurnoC: true }],
    ['Controlar a umidade da cabine (40–60%)', { ...c, umidade: Math.min(60, Math.max(40, c.umidade)) }],
    ['Voltar a linha ao ritmo ideal', { ...c, ritmo: Math.min(c.ritmo, 100) }],
  ];
  const melhor = tentativas.map(([nome, x]) => ({ nome, ganho: fabrica(simular(x)).OEE - base })).sort((a, b) => b.ganho - a.ganho)[0];
  return melhor.ganho > 0.0005 ? melhor : null;
}
