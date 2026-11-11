import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Activity, BarChart3, BookOpen, House, RefreshCcw, ShieldCheck } from 'lucide-react';
import { FiltrosProvider, useFiltros, type DefFiltro } from './kit/filtros';
import { Moldura, type Visao } from './kit/ui';
import { LINES, SHIFTS, type Filtro } from './dados';
const Resumo = lazy(() => import('./telas/Resumo'));
const Estabilidade = lazy(() => import('./telas/Estabilidade'));
const Defeitos = lazy(() => import('./telas/Defeitos'));
const Acoes = lazy(() => import('./telas/Acoes'));
const Sobre = lazy(() => import('./telas/Sobre'));

const FILTROS: DefFiltro[] = [
  { id: 'linha', label: 'Linha', options: [['all', 'Todas'], ...LINES.map((l, i) => [String(i), l.curto] as [string, string])] },
  { id: 'turno', label: 'Turno', options: [['all', 'Todos'], ...SHIFTS.map((s, i) => [String(i), `Turno ${s}`] as [string, string])] },
];

const VISOES: Visao[] = [
  { path: '/', label: 'Visão geral', curto: 'Geral', icon: <House />, heading: 'Visão geral da qualidade', sub: 'Eficiência das linhas, peças boas e custo da má qualidade' },
  { path: '/estabilidade', label: 'Estabilidade', icon: <Activity />, heading: 'Estabilidade do processo', sub: 'O processo está sob controle e atende ao cliente?', filtros: ['turno'] },
  { path: '/defeitos', label: 'Defeitos', icon: <BarChart3 />, heading: 'Defeitos', sub: 'Quais defeitos atacar primeiro e onde eles acontecem' },
  { path: '/acoes', label: 'Ações corretivas', curto: 'Ações', icon: <RefreshCcw />, heading: 'Ações corretivas', sub: 'Não conformidades em tratamento, prazos e eficácia', filtros: ['linha'] },
  { path: '/sobre', label: 'Sobre os dados', curto: 'Sobre', icon: <BookOpen />, heading: 'Sobre os dados', sub: 'Como o painel foi construído', filtros: 'nenhum' },
];

/** Filtro atual no formato que as consultas usam. */
export function useFiltro(): Filtro {
  const { periodo, valor } = useFiltros();
  return { periodo, linha: valor('linha'), turno: valor('turno') };
}

export default function App() {
  return (
    <FiltrosProvider chave="rotalume-qual" defs={FILTROS}>
      <Routes>
        <Route element={<Moldura produto="Qualidade" icone={<ShieldCheck size={18} />} visoes={VISOES} asOf="31/10/2026"
          rodape={<>Projeto de portfólio de <a href="https://github.com/Oberon-23">Breno Silva</a> · Rotalume é uma empresa fictícia e todos os dados são simulados.</>} />}>
          <Route index element={<Resumo />} />
          <Route path="estabilidade" element={<Estabilidade />} />
          <Route path="defeitos" element={<Defeitos />} />
          <Route path="acoes" element={<Acoes />} />
          <Route path="sobre" element={<Sobre />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FiltrosProvider>
  );
}
