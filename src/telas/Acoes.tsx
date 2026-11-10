import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { useFiltro } from '../App';
import { AREA, CAUSAS, HOJE, LINES, ncs, ORIGENS, type NC } from '../dados';
import { cap, fDate, fN, fP, pl, statusOf } from '../kit/formato';
import { periodLabel } from '../kit/meses';
import { Card, Kpis, Manchete, Pill, Segmentado, TabelaOrdenavel, type Coluna } from '../kit/ui';
import { eixoY, Grafico, tt, useCores } from '../kit/graficos';

const ETAPAS: [NC['stage'], string][] = [['Planejar', 'P'], ['Executar', 'D'], ['Verificar', 'C'], ['Agir', 'A']];
const GP: Record<string, string> = { 'Menor': 'neutral', 'Maior': 'warn', 'Crítica': 'bad' };
const GO: Record<string, number> = { 'Menor': 0, 'Maior': 1, 'Crítica': 2 };
type Situacao = 'all' | 'open' | 'late' | 'closed';

export default function Acoes() {
  const f = useFiltro();
  const cor = useCores();
  const naLinha = (n: NC) => f.linha === 'all' || n.line === +f.linha;
  const noPeriodo = (n: NC) => n.m >= f.periodo.from && n.m <= f.periodo.to;
  const selN = ncs.filter((n) => noPeriodo(n) && naLinha(n));
  const open = ncs.filter((n) => n.isOpen && naLinha(n)), late = open.filter((n) => n.late), closed = selN.filter((n) => !n.isOpen);
  const onTime = closed.length ? closed.filter((n) => !n.closedLate).length / closed.length : NaN;
  const eff = closed.length ? 1 - closed.filter((n) => n.reinc).length / closed.length : NaN;

  const c6 = CAUSAS.map((cz) => ({ cz, n: selN.filter((n) => n.causa === cz).length, area: AREA[cz] })).sort((a, b) => b.n - a.n);
  const og = ORIGENS.map((o) => ({ o, n: selN.filter((n) => n.origem === o).length })).sort((a, b) => b.n - a.n);

  const [sit, setSit] = useState<Situacao>('all');
  const [busca, setBusca] = useState('');
  const linhas = useMemo(() => {
    let r = selN;
    if (sit === 'open') r = r.filter((n) => n.isOpen); else if (sit === 'late') r = r.filter((n) => n.late); else if (sit === 'closed') r = r.filter((n) => !n.isOpen);
    const q = busca.trim().toLowerCase();
    if (q) r = r.filter((n) => [n.code, n.desc, n.area, n.origem, n.causa, n.stage].join(' ').toLowerCase().includes(q));
    return r.map((n) => ({ ...n, gO: GO[n.grav], lineN: LINES[n.line].id }));
  }, [selN, sit, busca]);

  type Linha = (typeof linhas)[number];
  const colunas: Coluna<Linha>[] = [
    { k: 'code', label: 'Código', render: (n) => <span className="mono">{n.code}</span> },
    { k: 'open', label: 'Abertura', num: true, render: (n) => fDate(n.open) },
    { k: 'lineN', label: 'Linha' },
    { k: 'gO', label: 'Gravidade', render: (n) => <Pill status={GP[n.grav]}>{n.grav}</Pill> },
    { k: 'desc', label: 'Descrição', render: (n) => <>{n.desc}<span className="fraco">Causa: {n.causa} · {n.origem}{n.reinc ? ' · reincidente' : ''}</span></> },
    { k: 'area', label: 'Área' },
    { k: 'stage', label: 'Situação', render: (n) => (n.isOpen ? (n.late ? <Pill status="bad">Vencida · {n.stage}</Pill> : <Pill status="acc">{n.stage}</Pill>) : <Pill status="ok">Encerrada{n.closedLate ? ' com atraso' : ''}</Pill>) },
    { k: 'age', label: 'Dias', num: true },
  ];

  return (
    <>
      <Manchete
        status={late.length ? 'bad' : onTime < 0.9 ? 'warn' : 'ok'}
        titulo={late.length
          ? `${late.length} ${late.length > 1 ? 'ações corretivas estão vencidas' : 'ação corretiva está vencida'} e ${pl(open.length - late.length, 'segue', 'seguem')} dentro do prazo.`
          : `Nenhuma ação corretiva vencida. ${open.length === 0 ? 'Não há ações em aberto.' : pl(open.length, 'segue dentro do prazo.', 'seguem dentro do prazo.')}`}
        texto={`${cap(periodLabel(f.periodo))}, ${fP(onTime, 0)} das ações foram encerradas no prazo e ${fP(eff, 0)} resolveram o problema sem reincidência.`}
      />

      <Kpis itens={[
        { label: 'Abertas agora', tip: 'Não conformidades ainda em tratamento.', value: fN(open.length), target: `${fN(selN.length)} registradas no período` },
        { label: 'Vencidas', tip: 'Abertas há mais tempo que o prazo da gravidade: 15 dias (crítica), 30 (maior) ou 45 (menor).', value: fN(late.length), target: 'Meta: nenhuma', status: late.length ? (late.length > 2 ? 'bad' : 'warn') : 'ok' },
        { label: 'Encerradas no prazo', tip: 'Parte das não conformidades encerradas dentro do prazo, no período.', value: fN(onTime * 100, 0), unit: '%', target: 'Meta ≥ 90%', status: statusOf(onTime, 0.9, true, 0.15) },
        { label: 'Eficácia das ações', tip: 'Encerradas que não voltaram a acontecer. É o Verificar do PDCA medido.', value: fN(eff * 100, 0), unit: '%', target: 'Meta ≥ 90%', status: statusOf(eff, 0.9, true, 0.05) },
      ]} />

      <Card titulo="Ações em andamento no ciclo PDCA" acoes={<span className="fraco">{open.length} abertas · hoje, {fDate(HOJE)}</span>}
        sub="Cada não conformidade aberta, na etapa em que está. Vencidas em destaque, ordenadas pelo prazo.">
        <div className="quadro">
          {ETAPAS.map(([st, l]) => {
            const itens = open.filter((n) => n.stage === st).sort((a, b) => a.prazo - b.prazo);
            return (
              <div className="coluna" key={st}>
                <div className="coluna-h"><b><span className="lt">{l}</span>{st}</b><span>{itens.length}</span></div>
                {itens.length === 0 ? <div className="vazio">Nada nesta etapa.</div> : null}
                {itens.map((n) => (
                  <div key={n.code} className={`ficha${n.late ? ' atrasada' : ''}`}>
                    <div className="ficha-top"><span className="mono">{n.code}</span><Pill status={GP[n.grav]}>{n.grav}</Pill></div>
                    <p>{n.desc}</p>
                    <div className="ficha-meta"><span>{LINES[n.line].id} · {n.area}</span>{n.late ? <b className="delta ruim">venceu em {fDate(n.prazo)}</b> : <span>prazo {fDate(n.prazo)}</span>}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grade g2">
        <Card titulo="Qual a causa raiz mais comum?" sub="Não conformidades do período pelos 6M (método, máquina, mão de obra, material, medição e meio ambiente).">
          <Grafico rotulo="Causas raiz pelos 6M" altura={250}>
            <BarChart data={c6} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="cz" {...eixoY} width={100} />
              <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={tt((v, _n, p) => `${v} · área: ${p.area}`)} />
              <Bar dataKey="n" name="Não conformidades" radius={[0, 5, 5, 0]} maxBarSize={22} isAnimationActive={false}>
                {c6.map((x, i) => <Cell key={x.cz} fill={i === 0 ? cor.accent : cor['seq-3']} />)}
              </Bar>
            </BarChart>
          </Grafico>
        </Card>
        <Card titulo="De onde vêm as não conformidades?" sub="Em vermelho, as que chegaram pelo cliente: são as que mais custam para a imagem da empresa.">
          <Grafico rotulo="Origem das não conformidades" altura={250}>
            <BarChart data={og} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="o" {...eixoY} width={150} />
              <Tooltip cursor={{ fill: cor['accent-soft'], opacity: 0.4 }} content={tt((v) => `${v}`)} />
              <Bar dataKey="n" name="Não conformidades" radius={[0, 5, 5, 0]} maxBarSize={22} isAnimationActive={false}>
                {og.map((x) => <Cell key={x.o} fill={x.o === 'Reclamação de cliente' ? cor.bad : cor['seq-4']} />)}
              </Bar>
            </BarChart>
          </Grafico>
        </Card>
      </div>

      <Card titulo="Todas as não conformidades do período" acoes={
        <>
          <Segmentado rotulo="Situação" valor={sit} onChange={setSit} opcoes={[['all', 'Todas'], ['open', 'Abertas'], ['late', 'Vencidas'], ['closed', 'Encerradas']]} />
          <input className="busca" type="search" placeholder="Buscar código, descrição, área…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar não conformidades" />
        </>
      } sub={`${linhas.length} registros. Clique no título da coluna para ordenar.`}>
        <TabelaOrdenavel colunas={colunas} linhas={linhas} ordemInicial={{ k: 'open', d: -1 }} chave={(n) => n.code} porPagina={15} vazio="Nenhuma não conformidade com esses filtros." />
      </Card>
    </>
  );
}
