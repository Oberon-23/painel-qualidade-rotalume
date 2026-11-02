# Painel de Qualidade e Processos — Rotalume Indústria

> Dashboard interativo de qualidade industrial de uma fábrica **fictícia** (Rotalume Indústria), em HTML/CSS/JS puro, sem backend. Traz OEE, Controle Estatístico de Processo (CEP) e um quadro de ações corretivas no padrão PDCA.

![Visão geral](docs/img/qualidade_visao_geral.png)

## O que o painel responde

- A fábrica está eficiente mês a mês (OEE)?
- O processo está estatisticamente estável, ou há uma causa especial a investigar?
- Quais defeitos atacar primeiro (Pareto 80/20)?
- Qual é a causa raiz mais comum das não conformidades (Ishikawa 6M)?

![Estabilidade do processo (CEP)](docs/img/qualidade_estabilidade.png)

## Por que essas escolhas

- **OEE (Disponibilidade × Performance × Qualidade)**: indicador padrão de eficiência industrial (TPM, Nakajima 1988). Junta três perdas diferentes em um único número comparável entre linhas.
- **Cartas de controle X̄-R com regras de Western Electric**: em vez de olhar só a média, o painel aplica controle estatístico de processo de verdade — separa variação normal de causa especial, com os limites calculados a partir dos primeiros 25 dias medidos (Montgomery, *Introduction to Statistical Quality Control*).
- **Cpk tratado como "não confiável" quando o processo está fora de controle**: Cpk só é válido com processo estatisticamente estável; quando não está, o painel mostra esse alerta em vez de um número de capacidade enganoso, e aponta para o Ppk.
- **Pareto + diagrama de Ishikawa (6M)**: metodologia clássica de análise de causa raiz — identifica os poucos defeitos que concentram 80% das ocorrências e depois classifica a causa por Método, Máquina, Mão de obra, Material, Medição e Meio ambiente.
- **Quadro PDCA**: as ações corretivas seguem o ciclo Planejar → Executar → Verificar → Agir, alinhado à ISO 9001:2015, cláusula 10.2.
- **Eventos simulados nos dados** (desgaste de ferramenta, equipe nova sem padronização, umidade afetando pintura): testam se os indicadores conseguem de fato detectar os problemas que foram colocados de propósito.
- **Arquivo único, sem build**: HTML/CSS/JS em um só arquivo (`index.html`), dados sintéticos gerados no navegador (semente fixa) e gráficos via Chart.js por CDN — publicável em qualquer hospedagem estática.

![Quadro de ações corretivas](docs/img/qualidade_acoes.png)

## Dados

Todos os dados são fictícios, gerados no navegador ao carregar a página. Os eventos simulados e as fórmulas usadas (OEE, Cpk/Ppk, limites de controle) estão detalhados na aba **"Sobre os dados"** do próprio painel.

## Deploy

Projeto 100% estático — basta apontar a hospedagem para a raiz do repositório.

**Vercel:**
```bash
npm i -g vercel   # se ainda não tiver
vercel --prod
```
Ou: importar o repositório direto em [vercel.com/new](https://vercel.com/new) — nenhuma configuração de build é necessária (é um `index.html` puro).

**Localmente:** abra `index.html` no navegador, ou sirva com qualquer servidor estático (`npx serve .`).

## Stack

HTML5, CSS3 (custom properties para tema claro/escuro), JavaScript (ES6+), [Chart.js 4.4.1](https://www.chartjs.org/).

## Referências

Montgomery, *Introduction to Statistical Quality Control*; Western Electric, *Statistical Quality Control Handbook* (1956); Nakajima, *Introduction to TPM* (1988); ISO 9001:2015.
