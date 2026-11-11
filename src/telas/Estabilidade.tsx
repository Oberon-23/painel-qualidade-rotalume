import { useEffect, useState } from 'react';
import { useFiltro } from '../App';
import { BASE, d2, LINES, SHIFTS, spc } from '../dados';
import { useFiltros } from '../kit/filtros';
import { clamp, fDate, fN, joinE, mean, nf, pl, statusOf, sum } from '../kit/formato';
import { MONTHS, periodLabel } from '../kit/meses';
import { Card, Kpis, Legenda, Manchete, Segmentado } from '../kit/ui';
import { escala, Grafico, useCores } from '../kit/graficos';

export default function Estabilidade() {
  const f = useFiltro();
  const { setValor } = useFiltros();
  const cor = useCores();
  const [linha, setLinha] = useState(f.linha === 'all' ? 0 : +f.linha);
  useEffect(() => { if (f.linha !== 'all') setLinha(+f.linha); }, [f.linha]);
  const escolher = (v: string) => { setLinha(+v); if (f.linha !== 'all') setValor('linha', v); };

  const li = linha, L = LINES[li], c = L.carac, B = BASE[li], dec = c.dec;
  const fx = (v: number) => nf(dec).format(v);
  const sg = spc.filter((s) => s.line === li && s.m >= f.periodo.from && s.m <= f.periodo.to && (f.turno === 'all' || s.shift === +f.turno));

  // regras: fora dos limites (1) e 8 seguidas do mesmo lado do centro (2)
  const flags: number[] = sg.map((s) => (s.mean > B.ucl || s.mean < B.lcl ? 1 : 0));
  let run = 0, side = 0;
  sg.forEach((s, i) => { const sd = s.mean > B.xbb ? 1 : -1; if (sd === side) run++; else { side = sd; run = 1; } if (run >= 8 && !flags[i]) flags[i] = 2; });

  const n = sg.length, xbb = mean(sg.map((s) => s.mean)), rb = mean(sg.map((s) => s.range)), sig = rb / d2;
  const indiv = sg.flatMap((s) => s.vals);
  const sAll = Math.sqrt(sum(indiv, (v) => (v - xbb) ** 2) / Math.max(1, indiv.length - 1));
  const cpk = Math.min(c.lse - xbb, xbb - c.lie) / (3 * sig), ppk = Math.min(c.lse - xbb, xbb - c.lie) / (3 * sAll);
  const outSpec = indiv.filter((v) => v > c.lse || v < c.lie).length, nOut = flags.filter((x) => x === 1).length;
  const porMes: Record<number, number> = {};
  sg.forEach((s, i) => { if (flags[i] === 1) porMes[s.m] = (porMes[s.m] || 0) + 1; });
  const om = Object.entries(porMes).sort((x, y) => y[1] - x[1]).slice(0, 2).map((x) => +x[0]).sort((x, y) => x - y);
  const omTxt = om.length === 2 && MONTHS[om[0]].y === MONTHS[om[1]].y ? `${MONTHS[om[0]].long.split(' de ')[0]} e ${MONTHS[om[1]].long}` : joinE(om.map((i) => MONTHS[i].long));
  const estavel = nOut === 0;

  const pontos = sg.map((s, i) => ({
    dia: fDate(s.t).slice(0, 5), data: fDate(s.t), turno: SHIFTS[s.shift], media: s.mean, amp: s.range,
    fora: flags[i] === 1 ? s.mean : null, seq: flags[i] === 2 ? s.mean : null, ampFora: s.range > B.rucl ? s.range : null,
    faixa: [B.lcl, B.ucl] as [number, number], flag: flags[i],
  }));
  const yr = [B.lcl, B.ucl, ...sg.map((s) => s.mean)];
  const pad = (Math.max(...yr) - Math.min(...yr)) * 0.08;

  // histograma
  const span = c.lse - c.lie, lo = c.lie - span * 0.25, w = (span * 1.5) / 24, bins = new Array(24).fill(0);
  indiv.forEach((v) => { bins[clamp(Math.floor((v - lo) / w), 0, 23)]++; });
  const hist = bins.map((q, i) => { const ctr = lo + w * (i + 0.5); return { x: ctr, rot: fx(ctr), n: q, fora: ctr < c.lie || ctr > c.lse }; });
  /** posição (em barras) de um valor no histograma, para as linhas LIE, LSE e nominal */
  const posBin = (v: number) => clamp((v - lo) / w, 0, 24);
  const yX = escala(Math.min(...yr) - pad, Math.max(...yr) + pad, 6);
  const yXd = { min: Math.min(...yr) - pad, max: Math.max(...yr) + pad, ticks: yX.ticks.filter((t) => t >= Math.min(...yr) - pad && t <= Math.max(...yr) + pad), fmt: fx, largura: 60 };

  return (
    <>
      <div className="card-h">
        <Segmentado rotulo="Característica medida" valor={String(li)} onChange={escolher}
          opcoes={LINES.map((l, i) => [String(i), `${l.id} · ${l.carac.nome}`] as [string, string])} />
        <span className="fraco">Especificação do cliente: <b className="mono">{fx(c.nom)} ± {fx(c.lse - c.nom)} {c.un}</b></span>
      </div>

      <Manchete
        status={estavel ? 'ok' : nOut / Math.max(1, n) > 0.1 ? 'bad' : 'warn'}
        titulo={estavel
          ? `${c.art} ${c.nome.toLowerCase()} ficou estável ${periodLabel(f.periodo)}: nenhuma amostra saiu da faixa normal.`
          : `${c.art} ${c.nome.toLowerCase()} saiu do controle em ${nOut} de ${n} amostras ${periodLabel(f.periodo)}.`}
        texto={estavel
          ? `O processo é ${ppk >= 1.33 ? 'capaz de atender à especificação com folga' : ppk >= 1 ? 'capaz, mas com pouca folga' : 'estável, mas não atende à especificação com segurança'} (Ppk ${nf(2).format(ppk)}).`
          : `As saídas se concentram em ${omTxt}. ${outSpec ? `${pl(outSpec, 'peça medida ficou', 'peças medidas ficaram')} fora do que o cliente aceita.` : 'Nenhuma peça medida ficou fora da especificação, mas o processo já dá sinais antes de gerar refugo.'}`}
      />

      <Kpis itens={[
        { label: 'Amostras fora de controle', tip: 'Médias que saíram da faixa normal do processo. Cada uma indica uma causa especial a investigar.', value: fN(nOut), target: `de ${fN(n)} amostras`, status: nOut === 0 ? 'ok' : nOut / n > 0.1 ? 'bad' : 'warn', statusText: nOut === 0 ? 'Estável' : 'Instável' },
        { label: 'Capacidade real (Ppk)', tip: 'Quanto o processo cabe dentro da especificação, considerando toda a variação do período. 1,33 ou mais é considerado capaz.', value: n ? nf(2).format(ppk) : '—', target: 'Meta ≥ 1,33', status: statusOf(ppk, 1.33, true, 0.25) },
        { label: 'Capacidade potencial (Cpk)', tip: 'Mesma conta do Ppk, usando só a variação dentro de cada amostra. Só vale com o processo sob controle: com pontos fora dos limites, ele promete uma capacidade que o processo não entrega, e o Ppk é o número certo. Se for muito maior que o Ppk, o processo está mudando ao longo do tempo.', value: n ? nf(2).format(cpk) : '—', target: nOut ? 'Processo fora de controle: use o Ppk' : 'Meta ≥ 1,33', status: nOut ? 'neutral' : statusOf(cpk, 1.33, true, 0.25), statusText: nOut ? 'Não confiável' : undefined },
        { label: 'Peças fora da especificação', tip: 'Medições individuais fora dos limites aceitos pelo cliente, em partes por milhão.', value: n ? fN((outSpec / indiv.length) * 1e6) : '—', unit: ' ppm', target: `${fN(outSpec)} de ${fN(indiv.length)} medidas`, status: outSpec ? 'bad' : 'ok' },
      ]} />

      <Card titulo="O processo está estável?" sub="Carta X̄: média de 5 peças medidas por dia. A faixa verde é a variação normal do processo (limites de controle).">
        <Legenda itens={[
          { label: 'Média da amostra', cor: cor.serie[li], tipo: 'linha' },
          { label: 'Fora da faixa', cor: cor.bad },
          { label: '8 seguidas do mesmo lado', cor: cor.warn },
          { label: 'Faixa normal (limites de controle)', cor: cor.good, tipo: 'faixa' },
        ]} />
        <Grafico rotulo="Carta de controle das médias" altura={320} n={pontos.length} rotulosX={pontos.map((p) => p.dia)} gapX={28} y={yXd}
          camadas={[
            { tipo: 'faixa', de: B.lcl, ate: B.ucl, cor: cor.good },
            { tipo: 'linhaH', y: B.xbb, cor: cor.good, rotulo: 'Centro', posRotulo: 'abaixo' },
            { tipo: 'linha', valores: pontos.map((p) => p.media), cor: cor.serie[li], espessura: 1.5 },
            { tipo: 'pontos', valores: pontos.map((p) => p.fora), cor: cor.bad },
            { tipo: 'pontos', valores: pontos.map((p) => p.seq), cor: cor.warn },
          ]}
          dica={(i) => { const p = pontos[i]; return { titulo: `${p.data} · turno ${p.turno}`, linhas: [{ nome: 'Média', valor: `${nf(dec + 1).format(p.media)} ${c.un}`, cor: cor.serie[li] }], rodape: p.flag === 1 ? 'Fora da faixa normal' : p.flag === 2 ? '8ª amostra seguida do mesmo lado' : undefined }; }} />
      </Card>

      <div className="grade g2">
        <Card titulo="Amplitude do subgrupo (carta R)" sub="Diferença entre a maior e a menor peça de cada amostra. Acima do limite, a variação dentro do dia aumentou.">
          <Grafico rotulo="Carta de amplitude" altura={250} n={pontos.length} rotulosX={pontos.map((p) => p.dia)} gapX={28}
            y={{ ...escala(0, Math.max(B.rucl * 1.15, ...pontos.map((p) => p.amp))), fmt: fx, largura: 60 }}
            camadas={[
              { tipo: 'linhaH', y: B.rucl, rotulo: 'Limite', tracejado: true },
              { tipo: 'linhaH', y: B.rb, rotulo: 'Média', posRotulo: 'abaixo' },
              { tipo: 'linha', valores: pontos.map((p) => p.amp), cor: cor.serie[li], espessura: 1.2 },
              { tipo: 'pontos', valores: pontos.map((p) => p.ampFora), cor: cor.bad },
            ]}
            dica={(i) => ({ titulo: pontos[i].data, linhas: [{ nome: 'Amplitude', valor: `${nf(dec + 1).format(pontos[i].amp)} ${c.un}`, cor: cor.serie[li] }] })} />
        </Card>
        <Card titulo="Medições × especificação" sub="Cada peça medida no período. As barras vermelhas ficaram fora do que o cliente aceita (LIE e LSE).">
          <Grafico rotulo="Histograma das medições" altura={250} topo={22} n={hist.length} rotulosX={hist.map((h) => h.rot)} gapX={24}
            y={escala(0, Math.max(4, ...hist.map((h) => h.n)))}
            camadas={[
              { tipo: 'barras', valores: hist.map((h) => h.n), ocupa: 0.94, raio: 2, cor: (i) => (hist[i].fora ? cor.bad : cor.serie[li]) },
              { tipo: 'linhaV', x: posBin(c.lie), cor: cor.bad, largura: 1.5, rotulo: 'LIE' },
              { tipo: 'linhaV', x: posBin(c.lse), cor: cor.bad, largura: 1.5, rotulo: 'LSE' },
              { tipo: 'linhaV', x: posBin(c.nom), cor: cor.muted, tracejado: true, rotulo: 'Nominal' },
            ]}
            dica={(i) => ({ titulo: `${fx(hist[i].x - w / 2)} a ${fx(hist[i].x + w / 2)} ${c.un}`, linhas: [{ nome: 'Peças', valor: fN(hist[i].n) }] })} />
        </Card>
      </div>
    </>
  );
}
