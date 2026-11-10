/*
 * Padrões de gráfico (Recharts) da identidade Rotalume: cores lidas do
 * tema, eixos discretos, dica de passar o mouse no mesmo estilo e faixa
 * que marca o período escolhido nos gráficos mensais.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ReferenceArea, ResponsiveContainer } from 'recharts';
import { MONTHS } from './meses';

const NOMES = ['accent', 'accent-soft', 'ink', 'ink-2', 'muted', 'line', 'line-2', 'surface', 'good', 'warn', 'bad', 'lock',
  'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'seq-1', 'seq-2', 'seq-3', 'seq-4', 'seq-5', 'seq-6'] as const;
export type Cores = Record<(typeof NOMES)[number], string> & { serie: string[] };

function lerCores(): Cores {
  const cs = getComputedStyle(document.documentElement);
  const o = Object.fromEntries(NOMES.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as unknown as Cores;
  o.serie = [o.c1, o.c2, o.c3, o.c4, o.c5, o.c6];
  return o;
}

/** Cores do tema atual; muda junto quando o tema troca. */
export function useCores(): Cores {
  const [c, setC] = useState<Cores>(lerCores);
  useEffect(() => {
    const at = () => setC(lerCores());
    const mo = new MutationObserver(at);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', at);
    return () => { mo.disconnect(); mq.removeEventListener('change', at); };
  }, []);
  return c;
}

/** Contêiner com altura fixa e largura do cartão. */
export function Grafico({ altura = 280, rotulo, children, semDados = false, vazio = 'Sem dados suficientes neste recorte. Amplie o período ou retire um filtro.' }: {
  altura?: number; rotulo: string; children: ReactNode; semDados?: boolean; vazio?: string;
}) {
  if (semDados) return <div className="graf graf-vazio" style={{ height: altura }}><p>{vazio}</p></div>;
  return (
    <div className="graf" role="img" aria-label={rotulo} style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%" debounce={60}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export const eixoX = { tickLine: false, axisLine: { stroke: 'var(--line-2)' }, tickMargin: 8, minTickGap: 10 } as const;
export const eixoY = { tickLine: false, axisLine: false, tickMargin: 6, width: 52 } as const;
export const grade = { vertical: false, strokeDasharray: '0' } as const;
export const margem = { top: 10, right: 12, bottom: 0, left: 0 };

export type LinhaTt = { nome: string; valor: string; cor?: string };

/** Caixinha de "passar o mouse" padrão. */
export function CaixaTt({ titulo, linhas, rodape }: { titulo: ReactNode; linhas: LinhaTt[]; rodape?: ReactNode }) {
  return (
    <div className="tt">
      <div className="tt-t">{titulo}</div>
      {linhas.map((l) => (
        <div className="tt-l" key={l.nome}>{l.cor ? <i style={{ background: l.cor }} /> : null}<span>{l.nome}</span><b>{l.valor}</b></div>
      ))}
      {rodape ? <div className="tt-f">{rodape}</div> : null}
    </div>
  );
}

type PayloadItem = { name?: string | number; value?: unknown; color?: string; dataKey?: unknown; payload?: Record<string, unknown> };

/**
 * Fábrica de tooltip: recebe como formatar cada série e devolve o
 * componente que o Recharts espera em <Tooltip content={...} />.
 */
export function tt(fmt: (v: number, nome: string, p: Record<string, unknown>) => string, opts: {
  titulo?: (label: string, p: Record<string, unknown>) => ReactNode;
  rodape?: (itens: readonly PayloadItem[], label: string) => ReactNode;
  filtrar?: (i: PayloadItem) => boolean;
} = {}) {
  return function Tt(props: { active?: boolean; payload?: readonly PayloadItem[]; label?: string | number }) {
    const { active, payload, label } = props;
    if (!active || !payload?.length) return null;
    const itens = payload.filter((i) => i.value != null && (opts.filtrar ? opts.filtrar(i) : true));
    if (!itens.length) return null;
    const p0 = (itens[0].payload ?? {}) as Record<string, unknown>;
    return (
      <CaixaTt
        titulo={opts.titulo ? opts.titulo(String(label ?? ''), p0) : String(label ?? '')}
        linhas={itens.map((i) => ({ nome: String(i.name ?? ''), valor: fmt(Number(i.value), String(i.name ?? ''), (i.payload ?? {}) as Record<string, unknown>), cor: i.color }))}
        rodape={opts.rodape?.(itens, String(label ?? ''))}
      />
    );
  };
}

/** Sombreia, nos gráficos mensais, os meses fora do período escolhido. */
export function faixasForaDoPeriodo(from: number, to: number) {
  const out: ReactNode[] = [];
  if (from > 0) out.push(<ReferenceArea key="a" x1={MONTHS[0].label} x2={MONTHS[from - 1].label} fill="var(--surface-2)" fillOpacity={0.75} ifOverflow="extendDomain" />);
  if (to < 11) out.push(<ReferenceArea key="b" x1={MONTHS[to + 1].label} x2={MONTHS[11].label} fill="var(--surface-2)" fillOpacity={0.75} ifOverflow="extendDomain" />);
  return out;
}

/** Opacidade de uma barra mensal conforme o período escolhido. */
export const opMes = (i: number, from: number, to: number) => (i >= from && i <= to ? 1 : 0.35);

/** Rótulo de valor acima da barra, sem quebrar linha (para usar em <LabelList content={...} />). */
export function rotuloTopo(props: { x?: number | string; y?: number | string; width?: number | string; value?: unknown }) {
  const { x = 0, y = 0, width = 0, value } = props;
  return (
    <text x={Number(x) + Number(width) / 2} y={Number(y) - 7} textAnchor="middle" className="halo" fill="var(--ink)" fontSize={12} fontWeight={650}>
      {String(value ?? '')}
    </text>
  );
}

/** Marcas redondas no eixo: de lo a hi, de passo em passo. */
export const passos = (lo: number, hi: number, passo: number) => {
  const a = Math.floor(lo / passo) * passo, b = Math.ceil(hi / passo) * passo, r: number[] = [];
  for (let v = a; v <= b + passo / 1000; v += passo) r.push(+v.toFixed(6));
  return r;
};
