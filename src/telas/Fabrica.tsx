import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Factory, Maximize2, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { LINES, META } from '../dados';
import { ATUAL, fabrica, melhorAlavanca, simular, type Cenario } from '../simulacao';
import { Card, Kpis, Manchete, Segmentado } from '../kit/ui';
import { useCores } from '../kit/graficos';
import type { Cena, CoresCena, Placar, Selecao } from './fabrica/cena';

const pct = (x: number, d = 1) => `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const num = (x: number) => Math.round(x).toLocaleString('pt-BR');
const brl = (x: number) => `R$ ${Math.round(x).toLocaleString('pt-BR')}`;
const pp = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} p.p.`;
const ESTADO_TXT = { produzindo: 'Produzindo', setup: 'Setup', parada: 'Parada' } as const;
const ESTADO_COR = { produzindo: 'ok', setup: 'info', parada: 'bad' } as const;

/** Variação contra o cenário atual, colorida conforme melhora ou piora. */
function Var({ v, bom, fmt }: { v: number; bom: 'sobe' | 'desce'; fmt: (x: number) => string }) {
  if (Math.abs(v) < 1e-6) return <span className="var-neutra">igual a hoje</span>;
  const melhor = bom === 'sobe' ? v > 0 : v < 0;
  return <span className={melhor ? 'var-boa' : 'var-ruim'}>{fmt(v)} vs hoje</span>;
}

export default function Fabrica() {
  const [c, setC] = useState<Cenario>(ATUAL);
  const r = useMemo(() => simular(c), [c]);
  const hoje = useMemo(() => fabrica(simular(ATUAL)), []);
  const f = fabrica(r);
  const dica = useMemo(() => melhorAlavanca(c), [c]);
  const alterado = JSON.stringify(c) !== JSON.stringify(ATUAL);
  const set = <K extends keyof Cenario>(k: K, v: Cenario[K]) => setC((x) => ({ ...x, [k]: v }));

  const piorLinha = [...r].sort((a, b) => a.OEE - b.OEE)[0];
  const status = f.OEE >= META.oee ? 'ok' : f.OEE >= META.oee - 0.03 ? 'warn' : 'bad';
  const titulo = alterado
    ? `Neste cenário, o OEE da fábrica vai para ${pct(f.OEE)} (${pp(f.OEE - hoje.OEE)}) e o custo da má qualidade para ${brl(f.custoDia)} por dia.`
    : `Hoje a fábrica roda com OEE de ${pct(f.OEE)}; ${LINES[piorLinha.linha].curto} é a linha mais fraca (${pct(piorLinha.OEE)}).`;

  return (
    <>
      <Manchete status={status} titulo={titulo}
        texto={dica ? <>A alavanca que mais ajudaria agora: <b>{dica.nome.toLowerCase()}</b> ({pp(dica.ganho)} de OEE). Mexa nos controles de “E se…?” e veja a fábrica mudar.</> : 'Todas as alavancas já estão no melhor ponto deste modelo.'} />

      <Kpis itens={[
        { label: 'OEE da fábrica', tip: 'Média das três linhas: disponibilidade × performance × qualidade.', value: pct(f.OEE), target: `Meta ≥ ${pct(META.oee, 0)}`, status: status === 'ok' ? 'ok' : status === 'warn' ? 'warn' : 'bad', delta: <Var v={f.OEE - hoje.OEE} bom="sobe" fmt={pp} /> },
        { label: 'Peças boas por dia', tip: 'Três turnos de 7h30, nas três linhas.', value: num(f.boasDia), delta: <Var v={f.boasDia - hoje.boasDia} bom="sobe" fmt={(x) => `${x > 0 ? '+' : '−'}${num(Math.abs(x))}`} /> },
        { label: 'Defeito', tip: 'Peças com defeito ÷ peças produzidas.', value: pct(f.defeitoPct, 2), delta: <Var v={f.defeitoPct - hoje.defeitoPct} bom="desce" fmt={pp} /> },
        { label: 'Custo da má qualidade', tip: 'Refugo e retrabalho por dia, com o custo médio por defeito de cada linha.', value: brl(f.custoDia), unit: '/dia', delta: <Var v={f.custoDia - hoje.custoDia} bom="desce" fmt={(x) => `${x > 0 ? '+' : '−'}${brl(Math.abs(x))}`} /> },
      ]} />

      <div className="fab-grid">
        <Card className="fab-card" titulo={<span className="tit-ic"><Factory size={18} aria-hidden="true" />Fábrica ao vivo</span>}
          sub="Peças andando nas esteiras, paradas de setup (azul) e de quebra (vermelho), e a inspeção no fim de cada linha: peça boa vai para o palete, peça com defeito cai na caixa vermelha. Arraste para girar, use a roda do mouse ou o gesto de pinça para aproximar e clique numa máquina para ver os números dela.">
          <Fabrica3D resultados={r} setup={c.setup} />
        </Card>

        <Card className="fab-controles" titulo="E se…?" sub="Mude uma alavanca e compare com hoje. Os números e a animação usam o mesmo modelo, calibrado com os últimos 3 meses."
          acoes={alterado ? <button type="button" className="limpar" onClick={() => setC(ATUAL)}><RotateCcw size={14} aria-hidden="true" />Voltar para hoje</button> : undefined}>
          <div className="alavancas">
            <Faixa id="setup" rotulo="Tempo de setup por turno" valor={c.setup} min={5} max={60} passo={5} un="min" hoje={ATUAL.setup} onChange={(v) => set('setup', v)}
              ajuda="Troca de produto. Com SMED (preparar fora da máquina) cai para 10–15 min." />
            <Faixa id="ritmo" rotulo="Ritmo das linhas" valor={c.ritmo} min={85} max={115} passo={1} un="%" hoje={ATUAL.ritmo} onChange={(v) => set('ritmo', v)}
              ajuda="Acima de 100% produz mais por hora, mas aumenta o defeito." />
            <Faixa id="umidade" rotulo="Umidade na cabine de pintura (L3)" valor={c.umidade} min={30} max={85} passo={1} un="%" hoje={ATUAL.umidade} onChange={(v) => set('umidade', v)}
              ajuda="Acima de 60% aparecem bolhas; abaixo de 40%, poeira e contaminação." />
            <Chave rotulo="Manutenção preventiva semanal" valor={c.preventiva} onChange={(v) => set('preventiva', v)} ajuda="Menos quebras, mas ocupa a máquina alguns minutos." />
            <Chave rotulo="Trocar a ferramenta pela vida útil (L1)" valor={c.trocaFerramenta} onChange={(v) => set('trocaFerramenta', v)} ajuda="Sem a troca, o diâmetro do eixo sai da especificação (como em abr–mai)." />
            <Chave rotulo="Turno C treinado no torque (L2)" valor={c.treinoTurnoC} onChange={(v) => set('treinoTurnoC', v)} ajuda="Sem o treinamento, o turno C dobra o defeito de torque (como em mar–set)." />
          </div>
        </Card>
      </div>

      <Card titulo="Por linha" sub="Os três componentes do OEE, peças boas por turno e o que está pesando na qualidade.">
        <div className="tabela-wrap" tabIndex={0} role="region" aria-label="Resultado por linha">
          <table>
            <thead><tr><th>Linha</th><th className="n">Disponib.</th><th className="n">Performance</th><th className="n">Qualidade</th><th className="n">OEE</th><th className="n">Boas/turno</th><th>O que pesa</th></tr></thead>
            <tbody>
              {r.map((x) => (
                <tr key={x.linha}>
                  <td><i className="bolinha" style={{ background: `var(--c${x.linha + 1})` }} />{LINES[x.linha].curto}</td>
                  <td className="n">{pct(x.A)}</td><td className="n">{pct(x.P)}</td><td className="n">{pct(x.Q)}</td>
                  <td className="n"><b className={x.OEE >= META.oee ? 'var-boa' : 'var-ruim'}>{pct(x.OEE)}</b></td>
                  <td className="n">{num(x.boasTurno)}</td>
                  <td>{x.motivo ?? <span className="muted">—</span>}{x.paradoMin > 60 ? <span className="muted">{x.motivo ? '; ' : ''}{num(x.paradoMin)} min parados por turno</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Faixa({ id, rotulo, valor, min, max, passo, un, hoje, ajuda, onChange }: { id: string; rotulo: string; valor: number; min: number; max: number; passo: number; un: string; hoje: number; ajuda: string; onChange: (v: number) => void }) {
  return (
    <div className="alavanca">
      <label htmlFor={`f-${id}`}><span>{rotulo}</span><b>{valor} {un}</b></label>
      <input id={`f-${id}`} type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => onChange(+e.target.value)} aria-describedby={`a-${id}`} />
      <small id={`a-${id}`}>{ajuda} Hoje: {hoje} {un}.</small>
    </div>
  );
}

function Chave({ rotulo, valor, ajuda, onChange }: { rotulo: string; valor: boolean; ajuda: string; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="alavanca chave">
      <button type="button" role="switch" aria-checked={valor} aria-labelledby={`${id}-r`} aria-describedby={`${id}-a`} onClick={() => onChange(!valor)} className="interruptor"><span /></button>
      <div><b id={`${id}-r`} onClick={() => onChange(!valor)}>{rotulo}</b><small id={`${id}-a`}>{ajuda}</small></div>
    </div>
  );
}

/** A parte 3D: carrega o three.js só aqui e cai para um aviso se o navegador não desenhar 3D. */
function Fabrica3D({ resultados, setup }: { resultados: ReturnType<typeof simular>; setup: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<Cena | null>(null);
  const cores = useCores();
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'sem3d'>('carregando');
  const [rodando, setRodando] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [vel, setVel] = useState<'1' | '5' | '20'>('5');
  const [sel, setSel] = useState<Selecao | null>(null);
  const [placar, setPlacar] = useState<{ relogio: string; turno: string; linhas: Placar } | null>(null);
  const [rot, setRot] = useState<{ x: number; y: number; visivel: boolean }[]>([]);

  const coresCena = (): CoresCena => ({
    fundo: cores.surface, chao: cores.surface, grade: cores.line, maquina: cores['line-2'], maquina2: cores.muted, esteira: cores['ink-2'],
    ok: cores.good, alerta: cores.warn, ruim: cores.bad, destaque: cores.accent, tinta: cores.c3, serie: cores.serie,
  });

  useEffect(() => {
    let vivo = true;
    // espera a página aparecer antes de montar o 3D, para os números e controles responderem primeiro
    const quando = (fn: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 800 }) : setTimeout(fn, 200));
    void new Promise<void>((ok) => quando(() => ok())).then(() => import('./fabrica/cena')).then(({ Cena: C, temWebGL }) => {
      if (!vivo || !caixa.current) return;
      if (!temWebGL()) { setEstado('sem3d'); return; }
      try {
        cena.current = new C(caixa.current, coresCena(), setSel);
        setEstado('pronto');
      } catch { setEstado('sem3d'); }
    }).catch(() => { if (vivo) setEstado('sem3d'); });
    return () => { vivo = false; cena.current?.dispose(); cena.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cena.current?.setCores(coresCena()); }, [cores, estado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (cena.current) { cena.current.setSetup(setup); cena.current.setResultados(resultados, META.oee); } }, [resultados, setup, estado]);
  useEffect(() => { if (cena.current) cena.current.rodando = rodando; }, [rodando, estado]);
  useEffect(() => { if (cena.current) cena.current.velocidade = +vel; }, [vel, estado]);

  // placar e rótulos acompanham a cena algumas vezes por segundo
  useEffect(() => {
    if (estado !== 'pronto') return;
    let id = 0;
    const tique = () => { if (cena.current) { setPlacar(cena.current.placar()); setRot(cena.current.rotulos()); } id = window.setTimeout(tique, 250); };
    tique();
    return () => clearTimeout(id);
  }, [estado]);

  if (estado === 'sem3d') return <p className="fab-sem3d">Este navegador não conseguiu desenhar a cena 3D. Os números e os controles de “E se…?” continuam funcionando.</p>;
  const linhaSel = sel ? placar?.linhas[sel.linha] : null;

  return (
    <div className="fab">
      <div className="fab-cena" ref={caixa} role="img" aria-label="Simulação 3D da fábrica com as três linhas de produção">
        {estado === 'carregando' && <p className="carregando" role="status">Carregando a fábrica 3D…</p>}
        {estado === 'pronto' && rot.map((p, li) => p.visivel && (
          <div key={li} className="fab-rot" style={{ left: p.x, top: p.y }} aria-hidden="true">
            <b>{LINES[li].curto}</b> OEE {pct(resultados[li].OEE)}
          </div>
        ))}
        {placar && <div className="fab-relogio" aria-hidden="true">Turno {placar.turno} · {placar.relogio}</div>}
        {sel && (
          <div className="fab-sel" role="dialog" aria-label={`${sel.nome}, ${LINES[sel.linha].curto}`}>
            <button type="button" className="fechar" onClick={() => setSel(null)} aria-label="Fechar">×</button>
            <b>{sel.nome}</b>
            <span className="muted">{LINES[sel.linha].nome}</span>
            {linhaSel && <span className={`pill ${ESTADO_COR[linhaSel.estado]}`}>{ESTADO_TXT[linhaSel.estado]}{linhaSel.estado === 'parada' && linhaSel.estacaoParada === sel.estacao ? ' (esta máquina)' : ''}</span>}
            <dl>
              <dt>OEE da linha</dt><dd>{pct(resultados[sel.linha].OEE)}</dd>
              <dt>Disponibilidade</dt><dd>{pct(resultados[sel.linha].A)}</dd>
              <dt>Defeito</dt><dd>{pct(resultados[sel.linha].defeitoPct, 2)}</dd>
              {linhaSel && <><dt>Neste turno</dt><dd>{num(linhaSel.boas)} boas, {num(linhaSel.defeitos)} com defeito</dd></>}
            </dl>
          </div>
        )}
      </div>
      <div className="fab-barra">
        <button type="button" className="btn-ic" onClick={() => setRodando(!rodando)} aria-label={rodando ? 'Pausar a simulação' : 'Continuar a simulação'}>{rodando ? <Pause size={16} /> : <Play size={16} />}</button>
        <Segmentado rotulo="Velocidade" valor={vel} onChange={setVel} opcoes={[['1', '1×'], ['5', '5×'], ['20', '20×']]} />
        <span className="fab-sep" />
        <button type="button" className="btn-ic" onClick={() => cena.current?.visaoGeral()} aria-label="Visão geral da fábrica"><Maximize2 size={16} /></button>
        <button type="button" className="btn-ic" onClick={() => cena.current?.zoom(0.8)} aria-label="Aproximar"><Plus size={16} /></button>
        <button type="button" className="btn-ic" onClick={() => cena.current?.zoom(1.25)} aria-label="Afastar"><Minus size={16} /></button>
        <span className="fab-leg" aria-hidden="true"><i className="ok" />Produzindo <i className="info" />Setup <i className="bad" />Parada</span>
      </div>
      {placar && (
        <ul className="fab-placar" aria-label={`Placar do turno ${placar.turno}, ${placar.relogio}`}>
          {placar.linhas.map((p) => (
            <li key={p.linha}>
              <button type="button" onClick={() => cena.current?.selecionar(p.linha, 3)} aria-label={`${LINES[p.linha].curto}: ${ESTADO_TXT[p.estado]}, ${p.boas} boas e ${p.defeitos} com defeito neste turno. Mostrar a inspeção.`}>
                <span className={`pill ${ESTADO_COR[p.estado]}`}>{ESTADO_TXT[p.estado]}</span>
                <b>{LINES[p.linha].curto}</b>
                <span className="fab-n">{num(p.boas)} boas</span>
                <span className={`num ${p.defeitos ? 'var-ruim' : 'muted'}`}>{num(p.defeitos)} defeito{p.defeitos === 1 ? '' : 's'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
