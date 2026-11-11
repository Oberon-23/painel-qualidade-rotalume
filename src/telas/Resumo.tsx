import { useFiltro } from '../App';
import { agg, LINES, lineIdx, META, ncs, pareto, prod, rowsP, SHIFTS, type Agg } from '../dados';
import { fBRL, fMil, fN, fP, fPP, nf, pl, statusOf, sum } from '../kit/formato';
import { MONTHS, periodLabel, prevRange } from '../kit/meses';
import { Card, Delta, Kpis, Legenda, Manchete, type Achado } from '../kit/ui';
import { escala, Grafico, opMes, rotuloAjustavel, sombrasForaDoPeriodo, useCores } from '../kit/graficos';

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
          <Grafico rotulo="OEE mensal por linha" altura={290} n={MONTHS.length} rotulosX={MONTHS.map((m) => m.label)}
            y={{ ...escala(Math.min(...flat, 75) - 1, Math.max(...flat) + 1, 4), fmt: (v) => `${nf(Number.isInteger(v) ? 0 : 1).format(v)}%` }}
            camadas={[
              ...sombrasForaDoPeriodo(from, to),
              { tipo: 'linhaH', y: 75, rotulo: 'Meta 75%', tracejado: true },
              ...li.map((i) => ({ tipo: 'linha' as const, valores: serieOEE.map((o) => o[LINES[i].curto] as number), cor: cor.serie[i], espessura: 2.6, pontos: 3 })),
            ]}
            dica={(k) => ({ titulo: MONTHS[k].label, linhas: li.map((i) => ({ nome: LINES[i].curto, valor: `${nf(1).format(serieOEE[k][LINES[i].curto] as number)}%`, cor: cor.serie[i] })) })} />
        </Card>
      </div>

      <div className="grade g2">
        <Card titulo="Para onde vai a eficiência?" sub={`Do tempo planejado até o OEE: quanto se perde em cada etapa ${periodLabel(f.periodo)}.`}>
          <Grafico rotulo="Cascata de perdas do OEE" altura={290} topo={24} n={cascata.length} rotulosX={cascata.map((c) => c.nome)} alturaEixoX={34} rotuloX={(t, _i, cx, y, passo) => rotuloAjustavel(t, cx, y, Math.max(passo, 44))}
            y={{ min: 0, max: 100, ticks: [0, 25, 50, 75, 100], fmt: (v) => `${v}%` }}
            camadas={[{ tipo: 'barras', valores: cascata.map((c) => c.valor), base: cascata.map((c) => c.base), larguraMax: 72, raio: 5, topo: 'redondo', rotulos: cascata.map((c) => c.rotulo),
              cor: (i) => (cascata[i].tipo === 'perda' ? cor.bad : cascata[i].tipo === 'resultado' ? cor.accent : cor['seq-3']) }]}
            dica={(i) => ({ titulo: cascata[i].nome, linhas: [{ nome: 'Valor', valor: cascata[i].tipo === 'perda' ? `perda de ${nf(1).format(cascata[i].valor)} pontos` : `${nf(1).format(cascata[i].valor)}%` }] })} />
        </Card>
        <Card titulo="Quanto custa a má qualidade?" sub="Refugo (peça perdida) e retrabalho por mês, em reais.">
          <Legenda itens={[{ label: 'Refugo (peça perdida)', cor: cor['seq-6'] }, { label: 'Retrabalho', cor: cor['seq-3'] }]} />
          <Grafico rotulo="Custo da má qualidade por mês" altura={270} n={custo.length} rotulosX={custo.map((c) => c.mes)}
            y={(() => { const e = escala(0, Math.max(...custo.map((c) => c.Refugo + c.Retrabalho))); return { ...e, fmt: fMil }; })()}
            camadas={[
              { tipo: 'barras', valores: custo.map((c) => c.Refugo), cor: cor['seq-6'], larguraMax: 34, raio: 0, opacidade: (i) => opMes(custo[i].i, from, to) },
              { tipo: 'barras', valores: custo.map((c) => c.Retrabalho), base: custo.map((c) => c.Refugo), cor: cor['seq-3'], larguraMax: 34, raio: 5, opacidade: (i) => opMes(custo[i].i, from, to) },
            ]}
            dica={(i) => ({ titulo: custo[i].mes, linhas: [{ nome: 'Refugo', valor: `R$ ${nf(0).format(custo[i].Refugo)}`, cor: cor['seq-6'] }, { nome: 'Retrabalho', valor: `R$ ${nf(0).format(custo[i].Retrabalho)}`, cor: cor['seq-3'] }], rodape: `Total: R$ ${nf(0).format(custo[i].Refugo + custo[i].Retrabalho)}` })} />
        </Card>
      </div>
    </>
  );
}
