# Calculadora_de_Salarios_PT

Aplicacao para estimar salario liquido mensal e anual em Portugal (2026), com base em tabelas de retencao IRS por regiao, regras de Seguranca Social e composicao detalhada dos componentes salariais.

Tambem inclui calculo de acerto final de contrato e um parser para converter tabelas oficiais em Excel para JSON normalizado.

## Indice

- Visao Geral
- Objetivos
- Funcionalidades Principais
- Arquitetura e Modulos
- Estrutura do Projeto
- Requisitos
- Instalacao
- Utilizacao Web
- Utilizacao CLI
- Parser Excel para JSON
- Modelo de Dados JSON
- Regras de Calculo
- Limitacoes
- Resolucao de Problemas

## Visao Geral

Esta aplicacao resolve tres necessidades praticas:

- Estimar salario liquido de forma transparente e repetivel.
- Simular diferentes contextos de trabalhador (agregado, dependentes, turnos, horas extra, duodecimos, etc.).
- Estimar o valor bruto do acerto final em cessacao de contrato.

## Objetivos

- Fornecer uma calculadora web simples e clara para utilizadores nao tecnicos.
- Disponibilizar um modo CLI para automacao e testes rapidos.
- Manter os dados IRS desacoplados do codigo atraves de JSON gerado a partir de Excel.
- Permitir escolha de regiao fiscal (Continente, Madeira, Acores).

## Funcionalidades Principais

- Calculo de salario liquido mensal e anual.
- Escolha de 12 ou 14 pagamentos anuais.
- Aplicacao de tabelas IRS por regiao.
- Aplicacao da Seguranca Social a 11%.
- Suporte para Tabelas I a VII por contexto de agregado.
- Suporte para dependentes.
- Suporte para tempo inteiro e tempo parcial.
- Suporte para horas extra (50%, 75%, 100%).
- Suporte para trabalho por turnos com acrescimo noturno.
- Suporte para subsidio de alimentacao com parte tributavel.
- Suporte para modo com duodecimos e sem duodecimos.
- Calculo de acerto final com ferias vencidas e proporcionais.
- CLI com listagem de tabelas e calculo por indice ou preset.
- Parser de 3 ficheiros Excel para JSON por nome original.

## Arquitetura e Modulos

### Camada de interface

- index.html: estrutura da interface e campos do formulario.
- styles.css: estilos da aplicacao web.
- app.js: logica de UI, validacoes de input e integracao com motores de calculo.

### Camada de dominio

- salary-calculator.js: motor principal do salario liquido.
- final-settlement-calculator.js: motor de calculo do acerto final.

### Camada de dados e ferramentas

- parser.js: conversao de Excel IRS para JSON normalizado.
- Tabelas_IRS/: pasta com origem Excel e destino JSON.

### Camada de execucao

- serve.js: servidor HTTP local para correr a interface.
- net-salary.js: ponto de entrada da CLI.

## Estrutura do Projeto

- app.js
- final-settlement-calculator.js
- index.html
- net-salary.js
- parser.js
- salary-calculator.js
- serve.js
- styles.css
- package.json
- Tabelas_IRS/

## Requisitos

- Node.js 18+ (recomendado).
- npm.

## Instalacao

```bash
npm install
```

## Utilizacao Web

1. Iniciar servidor local.

```bash
npm run serve
```

1. Abrir no browser.

- <http://127.0.0.1:4173>

1. Preencher o formulario.

- Escolher regiao IRS.
- Definir perfil pessoal e agregado.
- Definir regime de trabalho e componentes salariais.
- Ativar acerto final, se necessario, e preencher datas.

1. Carregar em Calcular salario liquido.

## Utilizacao CLI

Comando base:

```bash
npm run salary -- [opcoes]
```

Exemplos:

```bash
node net-salary.js --list --region=continente
node net-salary.js --list --region=madeira
node net-salary.js --list --region=acores
```

```bash
node net-salary.js --base=1500 --table=0 --dependents=0 --months=14 --region=continente
```

```bash
node net-salary.js --base=1500 --preset=single-no-dependents --dependents=0 --months=12 --region=madeira
```

```bash
node net-salary.js --base=1500 --duodecimos=250 --subsidies=0 --overtime=120 --night=40 --commissions=80 --meal-taxable=30 --absence=0 --table=1 --dependents=1 --months=12 --region=acores
```

```bash
node net-salary.js --final-settlement --base=1500 --admission=2021-01-10 --termination=2026-05-17 --taken-vested=5 --taken-proportional=2 --seniority-extra=1
```

Argumentos relevantes:

- --region: continente, madeira ou acores.
- --table: indice da tabela IRS.
- --preset: predefinicao da tabela IRS.
- --base: salario base.
- --duodecimos: valor mensal de duodecimos.
- --subsidies: subsidios pagos no mes.
- --overtime: total de horas extra convertido em valor.
- --night: acrescimo noturno.
- --commissions: comissoes.
- --meal-taxable: parcela tributavel de alimentacao.
- --absence: descontos por faltas.
- --dependents: numero de dependentes.
- --months: 12 ou 14.
- --final-settlement: ativa modo de acerto final.
- --admission, --termination, --taken-vested, --taken-proportional, --seniority-extra: parametros do acerto final.

## Parser Excel para JSON

Objetivo:

- Converter tabelas IRS em Excel para JSON normalizado usado pela app.

Execucao:

```bash
npm run parse
```

Comportamento atual:

- Le ficheiros Excel em Tabelas_IRS.
- Exige exatamente 3 ficheiros Excel.
- Extrai tabelas, escaloes, formulas e parcelas.
- Gera um JSON por ficheiro original com o mesmo nome base.
- Extrai metadados year e region do nome do ficheiro.

Exemplo de mapeamento:

- Tabelas_RF_Continente_2026.xlsx -> Tabelas_RF_Continente_2026.json

## Modelo de Dados JSON

Campos principais por ficheiro normalizado:

- year
- region
- sourceFile
- tables

Campos esperados por tabela:

- name
- category
- formula
- legend
- rows

Campos esperados por row:

- range.minExclusive
- range.maxInclusive
- taxaMarginalMaxima
- parcelaAAbater
- parcelaAdicionalDependente
- taxaEfetivaMensalLimiteEscalao

## Regras de Calculo

### Salario liquido

- Seguranca Social: 11% sobre o bruto considerado.
- IRS: escalão identificado por intervalo de rendimento.
- IRS: aplicacao da taxa marginal maxima do escalao.
- IRS: subtracao de parcela a abater (fixa ou formula).
- IRS: subtracao de parcela adicional por dependente.
- IRS final nunca negativo.
- Bruto composto por soma de componentes positivos menos faltas.
- Totais anuais por multiplicacao por 12 ou 14.

### Acerto final

- Base diaria = salario base mensal / 30.
- Inclui proporcional do mes de cessacao.
- Inclui subsidio de ferias proporcional.
- Inclui subsidio de Natal proporcional.
- Inclui ferias vencidas nao gozadas.
- Inclui ferias proporcionais nao gozadas.
- Inclui efeito de dias extra por antiguidade.
- Valida datas e limites de dias gozados.

## Limitacoes

- Resultado de natureza estimativa tecnica.
- Nao substitui validacao contabilistica ou juridica especializada.
- Podem existir excecoes legais especificas fora do escopo implementado.
- O parser assume estrutura semelhante nas folhas Excel de origem.

## Resolucao de Problemas

Problema: nao carrega JSON IRS no frontend.

- Confirmar existencia dos JSON em Tabelas_IRS.
- Executar npm run parse para regenerar.

Problema: parser falha por numero de ficheiros.

- Garantir exatamente 3 ficheiros Excel na pasta Tabelas_IRS.

Problema: resultado inesperado no calculo.

- Rever regiao selecionada.
- Rever tabela/preset e dependentes.
- Rever inputs de horas, subsidios e faltas.
