import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { useFiltro } from '../App';
import { agg, LINES, lineIdx, META, ncs, pareto, prod, rowsP, SHIFTS, type Agg } from '../dados';
import { fBRL, fMil, fN, fP, fPP, nf, pl, statusOf, sum } from '../kit/formato';
import { MONTHS, periodLabel, prevRange } from '../kit/meses';
import { Card, Delta, Kpis, Legenda, Manchete, type Achado } from '../kit/ui';
import { eixoX, eixoY, faixasForaDoPeriodo, grade, Grafico, margem, opMes, rotuloTopo, tt, useCores } from '../kit/graficos';

export default function Resumo() {
  const f = useFiltro();
  const cor = useCores();
  const { from, to } = f.periodo;
  const rows = rowsP(f), a = agg(rows);
  const pr = prevRange(f.periodo);
  const b: Agg | null = pr ? agg(rowsP(f, pr[0], pr[1])) : null;
  const all = prod.filter((r) => (f.linha === 'all' || r.line === +f.linha) && (f.turno === 'all' || r.shift === +f.turno));
  const mAll = MONTHS.map((mm) => agg(all.filter((r) => r.m === mm.i)));
  const late = ncs.filter((n) => n.late && (f.linha === 'all' || n.line === +f.linha));
  const st = statusOf(a.OEE, META.oee, true, 0.04);
  const per = lineIdx(f).map((li) => ({ li, a: agg(rows.filter((r) => r.line === li)) })).sort((x, y) => x.a.OEE - y.a.OEE);

  // OEE por linha
  const li = lineIdx(f);
  const serieOEE = MONTHS.map((mm) => {
    const o: Record<string, number | string> = { mes: mm.label };
    li.forEach((i) => { o[LINES[i].curto] = +(agg(all.filter((r) => r.m === mm.i && r.line === i)).OEE * 100).toFixed(1); });
    return o;
  });
  const flat = serieOEE.flatMap((o) => li.map((i) => o[LINES[i].curto] as number));

  // cascata de perdas
  const lossA = 1 - a.A, lossP = a.A * (1 - a.P), lossQ = a.A * a.P * (1 - a.Q);
  const cascata = [
    { nome: 'Tempo planejado', base: 0, valor: 100, tipo: 'base' },
    { nome: 'Paradas', base: (1 - lossA) * 100, valor: lossA * 100, tipo: 'perda' },
    { nome: 'Lentidão', base: (1 - lossA - lossP) * 100, valor: lossP * 100, tipo: 'perda' },
    { nome: 'Defeitos', base: a.OEE * 100, valor: lossQ * 100, tipo: 'perda' },
    { nome: 'OEE', base: 0, valor: a.OEE * 100, tipo: 'resultado' },
  ].map((s) => ({ ...s, rotulo: s.tipo === 'perda' ? `−${nf(1).format(s.valor)} p.p.` : `${nf(1).format(s.valor)}%` }));

  // custo da má qualidade
  const custo = MONTHS.map((mm) => {
    const r = all.filter((x) => x.m === mm.i);
    return {
      mes: mm.label, i: mm.i,
      Refugo: Math.round(sum(r, (x) => x.scrap * LINES[x.line].custo)),
      Retrabalho: Math.round(sum(r, (x) => x.rework * LINES[x.line].custo * 0.3)),
    };
  });

  // achados
  const achados: Achado[] = [];
  const combos: { l: number; s: number; a: Agg }[] = [];
  [0, 1, 2].forEach((l) => [0, 1, 2].forEach((s) => { const r = rows.filter((x) => x.line === l && x.shift === s); if (r.length) combos.push({ l, s, a: agg(r) }); }));
  if (combos.length > 1) {
    combos.sort((x, y) => y.a.rate - x.a.rate);
    const w = combos[0];
    achados.push({ s: 'bad', titulo: <><b>{LINES[w.l].curto}, turno {SHIFTS[w.s]}</b> tem mais defeitos: {fN(w.a.rate * 100, 1)} a cada 100 peças.</>, texto: `É ${nf(1).format(w.a.rate / a.rate)} vezes a média do recorte.` });
  }
  const p = pareto(rows);
  if (p.length) {
    const vit = p.filter((x) => x.vital);
    achados.push({ s: 'warn', titulo: <><b>{vit.length} de {p.length}</b> tipos de defeito somam {fP(vit[vit.length - 1].cum, 0)} das ocorrências.</>, texto: <>O principal é <b>{p[0].name.toLowerCase()}</b>, com {fP(p[0].share, 0)}.</> });
  }
  const big = ([['paradas', lossA], ['lentidão', lossP], ['defeitos', lossQ]] as [string, number][]).sort((x, y) => y[1] - x[1])[0];
  achados.push({ s: 'info', titulo: <>A maior perda de eficiência vem de <b>{big[0]}</b>.</>, texto: `Representa ${nf(1).format(big[1] * 100)} pontos dos ${nf(1).format((1 - a.OEE) * 100)} perdidos.` });

  return (
    <>
      <Manchete
        status={st}
        titulo={`A eficiência global (OEE) foi de ${fP(a.OEE)} ${periodLabel(f.periodo)}${st === 'ok' ? ', acima da meta de 75%.' : ', abaixo da meta de 75%.'}`}
        texto={per.length > 1
          ? <>A linha com menor eficiência é a <b>{LINES[per[0].li].curto}</b> ({fP(per[0].a.OEE)}). A má qualidade custou {fBRL(a.cost)} em peças perdidas e retrabalho.</>
          : `A má qualidade custou ${fBRL(a.cost)} em peças perdidas e retrabalho.`}
        achados={achados}
      />

      <Kpis itens={[
        { label: 'Eficiência global (OEE)', tip: 'Quanto do tempo planejado virou peça boa. Desconta paradas, lentidão e peças com defeito. 75% é a meta da fábrica; 85% é referência de classe mundial.', value: fN(a.OEE * 100, 1), unit: '%', target: 'Meta ≥ 75%', status: st, delta: <Delta atual={a.OEE} anterior={b?.OEE} sobeBom fmt={(x) => fPP(x)} />, spark: mAll.map((x) => x.OEE) },
        { label: 'Peças boas de primeira', tip: 'FPY: parte das peças que saiu sem defeito, sem precisar de retrabalho.', value: fN(a.Q * 100, 2), unit: '%', target: 'Meta ≥ 98%', status: statusOf(a.Q, META.fpy, true, 0.005), delta: <Delta atual={a.Q} anterior={b?.Q} sobeBom fmt={(x) => fPP(x, 2)} />, spark: mAll.map((x) => x.Q) },
        { label: 'Custo da má qualidade', tip: 'Valor das peças perdidas (refugo) mais 30% do valor das peças consertadas (retrabalho).', value: fBRL(a.cost), target: `${fN(a.scrap)} peças perdidas`, delta: <Delta atual={a.cost} anterior={b?.cost} sobeBom={false} fmt={fBRL} />, spark: mAll.map((x) => x.cost) },
        { label: 'Ações corretivas vencidas', tip: 'Não conformidades ainda abertas depois do prazo, contadas hoje, qualquer que seja o período escolhido.', value: fN(late.length), target: 'Meta: nenhuma', status: late.length ? (late.length > 2 ? 'bad' : 'warn') : 'ok', note: pl(ncs.filter((n) => n.isOpen && (f.linha === 'all' || n.line === +f.linha)).length, 'aberta no total', 'abertas no total') },
      ]} />

      <div className="grade">
        <Card titulo="A fábrica está eficiente mês a mês?" sub="OEE de cada linha nos 12 meses. A linha tracejada é a meta. Os meses fora do período escolhido ficam esmaecidos.">
          <Legenda itens={[...li.map((i) => ({ label: LINES[i].curto, cor: cor.serie[i], tipo: 'linha' as const })), { label: 'Meta 75%', tipo: 'tracejado' as const }]} />
          <Grafico rotulo="OEE mensal por linha" altura={290}>
            <LineChart data={serieOEE} margin={margem}>
              <CartesianGrid {...grade} />
              {faixasForaDoPeriodo(from, to)}
              <XAxis dataKey="mes" {...eixoX} />
              <YAxis {...eixoY} domain={[Math.floor(Math.min(...flat, 75) - 3), Math.ceil(Math.max(...flat) + 2)]} tickFormatter={(v) => `${v}%`} />
              <ReferenceLine y={75} stroke={cor['ink-2']} strokeDasharray="5 4" label={{ value: 'Meta 75%', position: 'insideTopRight' }} />
              <Tooltip content={tt((v) => `${nf(1).format(v)}%`)} />
              {li.map((i) => (
                <Line key={i} type="linear" dataKey={LINES[i].curto} stroke={cor.serie[i]} strokeWidth={2.6} dot={{ r: 3, fill: cor.serie[i] }} activeDot={{ r: 5 }} isAnimationActive={false} />
              ))}
            </LineChart>
          </Grafico>
        </Card>
      </div>

      <div className="grade g2">
        <Card titulo="Para onde vai a eficiência?" sub={`Do tempo planejado até o OEE: quanto se perde em cada etapa ${periodLabel(f.periodo)}.`}>
          <Grafico rotulo="Cascata de perdas do OEE" altura={290}>
            <BarChart data={cascata} margin={{ ...margem, top: 24 }}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="nome" {...eixoX} interval={0} />
              <YAxis {...eixoY} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={tt((v, _n, pl) => (pl.tipo === 'perda' ? `perda de ${nf(1).format(v)} pontos` : `${nf(1).format(v)}%`), { filtrar: (i) => i.dataKey === 'valor' })} />
              <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="valor" name="Valor" stackId="c" radius={[5, 5, 5, 5]} maxBarSize={72} isAnimationActive={false}>
                {cascata.map((s) => <Cell key={s.nome} fill={s.tipo === 'perda' ? cor.bad : s.tipo === 'resultado' ? cor.accent : cor['seq-3']} />)}
                <LabelList dataKey="rotulo" content={rotuloTopo} />
              </Bar>
            </BarChart>
          </Grafico>
        </Card>
        <Card titulo="Quanto custa a má qualidade?" sub="Refugo (peça perdida) e retrabalho por mês, em reais.">
          <Legenda itens={[{ label: 'Refugo (peça perdida)', cor: cor['seq-6'] }, { label: 'Retrabalho', cor: cor['seq-3'] }]} />
          <Grafico rotulo="Custo da má qualidade por mês" altura={270}>
            <BarChart data={custo} margin={margem}>
              <CartesianGrid {...grade} />
              <XAxis dataKey="mes" {...eixoX} />
              <YAxis {...eixoY} tickFormatter={fMil} />
              <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={tt((v) => `R$ ${nf(0).format(v)}`, { rodape: (it) => `Total: R$ ${nf(0).format(sum(it, (i) => Number(i.value)))}` })} />
              <Bar dataKey="Refugo" stackId="c" fill={cor['seq-6']} maxBarSize={34} isAnimationActive={false}>
                {custo.map((c) => <Cell key={c.mes} fillOpacity={opMes(c.i, from, to)} />)}
              </Bar>
              <Bar dataKey="Retrabalho" stackId="c" fill={cor['seq-3']} radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                {custo.map((c) => <Cell key={c.mes} fillOpacity={opMes(c.i, from, to)} />)}
              </Bar>
            </BarChart>
          </Grafico>
        </Card>
      </div>
    </>
  );
}
