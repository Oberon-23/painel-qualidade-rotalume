import { useState } from 'react';
import { useFiltro } from '../App';
import { agg, LINES, pareto, prod, rowsP, SHIFTS } from '../dados';
import { fN, fP, joinE, nf, sum } from '../kit/formato';
import { MONTHS, periodLabel } from '../kit/meses';
import { Card, Legenda, Manchete, MapaCalor } from '../kit/ui';
import { escala, Grafico, opMes, rotuloAjustavel, useCores } from '../kit/graficos';

export default function Defeitos() {
  const f = useFiltro();
  const cor = useCores();
  const rows = rowsP(f), p = pareto(rows), a = agg(rows);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const sel = escolhido && p.some((x) => x.name === escolhido) ? escolhido : p[0]?.name;
  const vital = p.filter((x) => x.vital);

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
        <Grafico rotulo="Pareto dos defeitos" altura={360} alturaEixoX={64} n={dadosPareto.length} rotulosX={dadosPareto.map((x) => x.name)}
          rotuloX={(t, _i, cx, y, passo) => rotuloAjustavel(t, cx, y, passo)}
          y={{ ...escala(0, Math.max(1, ...dadosPareto.map((x) => x.n))), fmt: (v) => fN(v) }}
          y2={{ min: 0, max: 100, ticks: [0, 25, 50, 75, 100], fmt: (v) => `${v}%` }}
          camadas={[
            { tipo: 'barras', valores: dadosPareto.map((x) => x.n), raio: 5, ocupa: 0.78, cor: (i) => (dadosPareto[i].vital ? cor.accent : cor['line-2']), contorno: (i) => (dadosPareto[i].name === sel ? cor.ink : undefined) },
            { tipo: 'linhaH', y: 80, eixo: 'y2', rotulo: '80% acumulado', tracejado: true, posRotulo: 'abaixo' },
            { tipo: 'linha', valores: dadosPareto.map((x) => x.acum), eixo: 'y2', cor: cor.ink, espessura: 2, pontos: 3 },
          ]}
          aoClicar={(i) => setEscolhido(p[i]?.name ?? null)}
          dica={(i) => { const x = dadosPareto[i]; return { titulo: x.name, linhas: [{ nome: 'Ocorrências', valor: `${fN(x.n)} (${nf(1).format(x.part)}%)` }, { nome: 'Acumulado', valor: `${nf(1).format(x.acum)}%` }], rodape: 'Clique para ver a evolução' }; }} />
      </Card>

      <div className="grade g-5-7">
        <Card titulo="Onde os defeitos acontecem?" sub={`Defeitos a cada 100 peças por linha e turno, ${periodLabel(f.periodo)}. O recorte escolhido nos filtros fica em destaque.`}>
          <MapaCalor titulo="Defeitos por linha e turno" linhas={LINES.map((l) => l.curto)} colunas={SHIFTS.map((s) => `Turno ${s}`)}
            valores={cells} fmt={(v) => nf(1).format(v)}
            ativo={(l, s) => (f.linha === 'all' || +f.linha === l) && (f.turno === 'all' || +f.turno === s)} />
        </Card>
        <Card titulo={`Evolução do defeito: ${sel ?? '—'}`} sub="Ocorrências por mês. Os meses fora do período escolhido ficam esmaecidos.">
          <Grafico rotulo={`Evolução mensal de ${sel}`} altura={250} n={serie.length} rotulosX={serie.map((x) => x.mes)}
            y={escala(0, Math.max(4, ...serie.map((x) => x.n)))}
            camadas={[{ tipo: 'barras', valores: serie.map((x) => x.n), cor: cor.accent, larguraMax: 40, raio: 5, opacidade: (i) => opMes(serie[i].i, f.periodo.from, f.periodo.to) }]}
            dica={(i) => ({ titulo: serie[i].mes, linhas: [{ nome: sel ?? '', valor: `${fN(serie[i].n)} ocorrências`, cor: cor.accent }] })} />
        </Card>
      </div>
    </>
  );
}
