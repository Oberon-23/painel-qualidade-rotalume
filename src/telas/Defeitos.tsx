import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { useFiltro } from '../App';
import { agg, LINES, pareto, prod, rowsP, SHIFTS } from '../dados';
import { fN, fP, joinE, nf, sum } from '../kit/formato';
import { MONTHS, periodLabel } from '../kit/meses';
import { Card, Legenda, Manchete, MapaCalor } from '../kit/ui';
import { CaixaTt, eixoX, eixoY, grade, Grafico, margem, opMes, tt, useCores } from '../kit/graficos';

/** quebra o nome do defeito em até duas linhas no eixo */
function RotuloDefeito({ x, y, payload, estreito }: { x?: number | string; y?: number | string; payload?: { value: string }; estreito: boolean }) {
  const t = payload?.value ?? '';
  const palavras = t.split(' ');
  const linhas: string[] = [];
  let cur = '';
  palavras.forEach((w) => { if ((cur + ' ' + w).trim().length > 14 && cur) { linhas.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
  linhas.push(cur);
  const mostrar = estreito ? [t.length > 12 ? `${t.slice(0, 11)}…` : t] : linhas.slice(0, 3);
  return (
    <text x={Number(x)} y={Number(y ?? 0) + 12} textAnchor="middle" className="recharts-text" fontSize={11.5}>
      {mostrar.map((l, i) => <tspan key={i} x={Number(x)} dy={i ? 13 : 0}>{l}</tspan>)}
    </text>
  );
}

export default function Defeitos() {
  const f = useFiltro();
  const cor = useCores();
  const rows = rowsP(f), p = pareto(rows), a = agg(rows);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const sel = escolhido && p.some((x) => x.name === escolhido) ? escolhido : p[0]?.name;
  const vital = p.filter((x) => x.vital);
  const estreito = typeof window !== 'undefined' && window.innerWidth < 640;

  const dadosPareto = p.map((x) => ({ ...x, part: +(x.share * 100).toFixed(1), acum: +(x.cum * 100).toFixed(1) }));

  // mapa de calor: sempre todas as linhas e turnos, destacando o recorte
  const base = prod.filter((r) => r.m >= f.periodo.from && r.m <= f.periodo.to);
  const cells = [0, 1, 2].map((l) => [0, 1, 2].map((s) => agg(base.filter((r) => r.line === l && r.shift === s)).rate * 100));

  const all = prod.filter((r) => (f.linha === 'all' || r.line === +f.linha) && (f.turno === 'all' || r.shift === +f.turno));
  const serie = MONTHS.map((mm) => ({
    mes: mm.label, i: mm.i,
    n: sum(all.filter((r) => r.m === mm.i), (r) => { const k = LINES[r.line].defeitos.indexOf(sel ?? ''); return k >= 0 ? r.byType[k] : 0; }),
  }));

  return (
    <>
      <Manchete
        status={a.rate > 0.025 ? 'warn' : 'ok'}
        titulo={`${vital.length} tipos de defeito respondem por ${fP(vital.length ? vital[vital.length - 1].cum : 0, 0)} das ${fN(a.defects)} ocorrências ${periodLabel(f.periodo)}.`}
        texto={p.length ? <>Os principais são {joinE(vital.slice(0, 3).map((x) => x.name.toLowerCase()))}, que juntos somam {fP(vital.slice(0, 3).slice(-1)[0].cum, 0)}. A taxa geral é de {fN(a.rate * 100, 1)} defeitos a cada 100 peças.</> : null}
      />

      <Card titulo="Quais defeitos aparecem mais?" sub="Gráfico de Pareto: barras com as ocorrências (eixo da esquerda) e linha com o acumulado (eixo da direita). Os defeitos em azul somam 80% e são os primeiros a atacar. Clique em uma barra para ver a evolução daquele defeito.">
        <Legenda itens={[{ label: 'Poucos vitais (até 80%)', cor: cor.accent }, { label: 'Muitos triviais', cor: cor['line-2'] }, { label: 'Acumulado', cor: cor.ink, tipo: 'linha' }]} />
        <Grafico rotulo="Pareto dos defeitos" altura={estreito ? 300 : 340}>
          <ComposedChart data={dadosPareto} margin={{ ...margem, bottom: estreito ? 20 : 30 }}
            onClick={(e) => { const i = (e as { activeTooltipIndex?: number | string } | null)?.activeTooltipIndex; if (i != null) setEscolhido(p[Number(i)]?.name ?? null); }}>
            <CartesianGrid {...grade} />
            <XAxis dataKey="name" {...eixoX} interval={0} height={estreito ? 60 : 50} tick={(props) => <RotuloDefeito {...props} estreito={estreito} />} angle={estreito ? -40 : 0} />
            <YAxis yAxisId="n" {...eixoY} tickFormatter={(v) => fN(v)} />
            <YAxis yAxisId="p" orientation="right" {...eixoY} width={44} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <ReferenceLine yAxisId="p" y={80} stroke={cor['ink-2']} strokeDasharray="5 4" label={{ value: '80% acumulado', position: 'insideBottomRight' }} />
            <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const x = payload[0].payload as (typeof dadosPareto)[number];
              return <CaixaTt titulo={x.name} linhas={[{ nome: 'Ocorrências', valor: `${fN(x.n)} (${nf(1).format(x.part)}%)` }, { nome: 'Acumulado', valor: `${nf(1).format(x.acum)}%` }]} rodape="Clique para ver a evolução" />;
            }} />
            <Bar yAxisId="n" dataKey="n" name="Ocorrências" radius={[5, 5, 0, 0]} isAnimationActive={false} style={{ cursor: 'pointer' }}>
              {dadosPareto.map((x) => <Cell key={x.name} fill={x.vital ? cor.accent : cor['line-2']} stroke={x.name === sel ? cor.ink : 'none'} strokeWidth={x.name === sel ? 2 : 0} />)}
            </Bar>
            <Line yAxisId="p" dataKey="acum" name="Acumulado" stroke={cor.ink} strokeWidth={2} dot={{ r: 3, fill: cor.ink }} isAnimationActive={false} />
          </ComposedChart>
        </Grafico>
      </Card>

      <div className="grade g-5-7">
        <Card titulo="Onde os defeitos acontecem?" sub={`Defeitos a cada 100 peças por linha e turno, ${periodLabel(f.periodo)}. O recorte escolhido nos filtros fica em destaque.`}>
          <MapaCalor titulo="Defeitos por linha e turno" linhas={LINES.map((l) => l.curto)} colunas={SHIFTS.map((s) => `Turno ${s}`)}
            valores={cells} fmt={(v) => nf(1).format(v)}
            ativo={(l, s) => (f.linha === 'all' || +f.linha === l) && (f.turno === 'all' || +f.turno === s)} />
        </Card>
        <Card titulo={`Evolução do defeito: ${sel ?? '—'}`} sub="Ocorrências por mês. Os meses fora do período escolhido ficam esmaecidos.">
          <Grafico rotulo={`Evolução mensal de ${sel}`} altura={250}>
            <BarChart data={serie} margin={margem}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="mes" {...eixoX} />
              <YAxis {...eixoY} allowDecimals={false} />
              <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={tt((v) => `${fN(v)} ocorrências`)} />
              <Bar dataKey="n" name={sel ?? ''} fill={cor.accent} radius={[5, 5, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                {serie.map((s) => <Cell key={s.mes} fillOpacity={opMes(s.i, f.periodo.from, f.periodo.to)} />)}
              </Bar>
            </BarChart>
          </Grafico>
        </Card>
      </div>
    </>
  );
}
