import { ncs, prod, spc } from '../dados';
import { fN } from '../kit/formato';
import { Card } from '../kit/ui';

export default function Sobre() {
  return (
    <>
      <div className="grade g2">
        <Card titulo="A empresa e os dados">
          <div className="prosa">
            <p>A <b>Rotalume Indústria</b> é fictícia. Ela fabrica eixos e conjuntos mecânicos em três linhas (L1 Usinagem CNC, L2 Montagem e L3 Pintura) e três turnos, de segunda a sexta.</p>
            <p>Os dados são gerados no navegador com semente fixa: <b>{fN(prod.length)}</b> registros de produção, <b>{fN(spc.length)}</b> amostras de medição e <b>{fN(ncs.length)}</b> não conformidades, de nov/2025 a out/2026.</p>
            <p>Eventos colocados de propósito para a análise encontrar:</p>
            <ul>
              <li><b>abr–mai/2026 · L1:</b> desgaste de ferramenta desloca o diâmetro do eixo para cima. Corrigido em junho.</li>
              <li><b>jan–jul/2026 · L2, turno C:</b> equipe nova sem padronização aumenta a variação do torque. Treinamento em julho.</li>
              <li><b>jan–mar/2026 · L3:</b> a umidade do verão aumenta bolhas e escorrimento na pintura.</li>
            </ul>
          </div>
        </Card>
        <Card titulo="Como foi construído">
          <div className="prosa">
            <ul>
              <li><b>React + TypeScript</b> com Vite, rotas por tela e filtros que ficam salvos no navegador.</li>
              <li><b>Recharts</b> para os gráficos, com as cores lidas do tema (claro, escuro ou automático).</li>
              <li>Identidade visual compartilhada com os outros painéis da Rotalume.</li>
              <li>Todos os cálculos rodam a partir dos dados brutos simulados: nada é digitado à mão.</li>
            </ul>
          </div>
        </Card>
      </div>

      <Card titulo="Fórmulas">
        <div className="defs">
          <div className="def"><b>OEE</b><code>Disponibilidade × Performance × Qualidade</code><span>Disponibilidade = tempo produzindo ÷ tempo planejado. Performance = peças × ciclo ideal ÷ tempo produzindo. Qualidade (FPY) = peças boas de primeira ÷ peças produzidas.</span></div>
          <div className="def"><b>Custo da má qualidade</b><code>refugo × custo + retrabalho × 30% do custo</code><span>Valor perdido em peças descartadas e consertadas.</span></div>
          <div className="def"><b>Carta X̄ e carta R</b><code>média ± A2·R̄ · limite R = D4·R̄</code><span>Amostras de 5 peças: A2 = 0,577 e D4 = 2,114. Limites calculados nos 25 primeiros dias medidos.</span></div>
          <div className="def"><b>Cpk e Ppk</b><code>mín(LSE − média ; média − LIE) ÷ 3σ</code><span>Cpk usa a variação dentro da amostra (R̄ ÷ d2); Ppk usa o desvio-padrão total do período.</span></div>
        </div>
      </Card>

      <Card titulo="Glossário e referências">
        <div className="prosa">
          <ul>
            <li><b>CEP</b> (Controle Estatístico de Processo): separa a variação normal das causas especiais.</li>
            <li><b>Limites de especificação</b>: o que o cliente aceita. Aparecem só no histograma, porque comparam peças individuais e não médias.</li>
            <li><b>PDCA</b>: Planejar, Executar (Do), Verificar (Check) e Agir. Ciclo de melhoria usado nas ações corretivas (ISO 9001:2015, cláusula 10.2).</li>
            <li><b>6M</b>: Método, Máquina, Mão de obra, Material, Medição e Meio ambiente.</li>
            <li>Referências: Montgomery, <i>Introduction to Statistical Quality Control</i>; Western Electric, <i>Statistical Quality Control Handbook</i> (1956); Nakajima, <i>Introduction to TPM</i> (1988).</li>
          </ul>
        </div>
      </Card>
    </>
  );
}
