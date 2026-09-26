# Especificação — Finanças (nova versão)

Reconstrução do **Projeto Finanças** (`D:\03-PESSOAL\CONTAS MONITORAMENTO\projetoFinancas`) sobre a base de
apps offline. O app atual **continua funcionando sem nenhuma alteração** até a virada; ele só é **lido**
para migrar os dados.

- **Dispositivos**: celular (principalmente para lançar contas) e PC (lançar e consultar tudo).
- **Usuários**: Iristenio (Admin) e Paulo (Colaborador). Inserções simultâneas praticamente não acontecem.
- **Planilha do Google** (conta pessoal iristeniosouza@gmail.com): passa a ser **só backup/sincronização** —
  não é mais editada à mão. Tudo (cadastros, edições, exclusões) é feito pelo app.

---

## 1. Entidades

Todas têm `id`, `criado_em`, `atualizado_em` (padrão da base) e **exclusão lógica** (`excluido: sim/não`) —
nada é apagado de verdade. Datas no formato `AAAA-MM-DD`; meses no formato `AAAA-MM`; valores em reais com
2 casas.

| Entidade | Campos principais | Quem vê/edita |
|---|---|---|
| **categorias** | nome, ativo | todos |
| **meios_pagamento** | nome, tipo (Pronto Pagamento · Cartão de Crédito · Débito Automático), dia_fechamento, dia_vencimento, ativo | todos |
| **pessoas** | nome, tipo (Membro do Domicílio · Terceiro Monitorado · Terceiro Devedor), papel (Admin · Colaborador, só p/ Membro), ativo | todos (token fica só no servidor) |
| **lancamentos** | data, categoria_id, meio_pagamento_id, descricao, observacao, recorrente | todos |
| **rateios** | lancamento_id, pessoa_id, percentual (0–1) | todos |
| **parcelas** | lancamento_id, numero, mes_vencimento, valor, status (Aberto · Pago), data_pagamento | todos |
| **gastos_rotineiros** | data, categoria_id, meio_pagamento_id, pessoa_id, descricao, valor | **só Admin** |
| **fontes** (Carteira — §5) | nome, ativo | **só Admin** |
| **entradas** (Carteira — §5) | data, fonte_id, valor, descricao | **só Admin** |
| **carteira_config** (Carteira — §5) | registro único: data_inicio | **só Admin** |

Decisões de desenho (diferenças em relação ao app atual):

- **D1. Totais não são gravados.** "Valor Total", "Qtd Parcelas" e "Total Parcelas" deixam de ser campos:
  são **calculados** a partir das parcelas não excluídas. Evita divergências entre aparelhos.
- **D2. IDs previsíveis para registros gerados em série**, para que duas gerações iguais se fundam em vez
  de duplicar: parcela = `<id do lançamento>-p<número>`; rateio = `<id do lançamento>-<id da pessoa>`.
- **D3.** Exclusão de parcela/lançamento = marcar `excluido`. "Excluir só as abertas" marca só as parcelas
  em aberto.

## 2. Permissões (opção b)

- **P1.** Cada pessoa com papel (Iristenio, Paulo) tem **seu próprio código de conexão**. O servidor sabe
  quem está sincronizando.
- **P2.** Para o Colaborador, o servidor **não envia** e **recusa gravar** `gastos_rotineiros`, `fontes`,
  `entradas` e `carteira_config`.
  A restrição vale no servidor, não só na tela.
- **P3.** Todo o resto é compartilhado, inclusive cadastros (Categorias, Meios de Pagamento, Pessoas).
  _Consequência conhecida (aceita no app atual): o Colaborador pode editar o papel das pessoas._
- **P4.** Terceiros (Malurde, Quilena, Alzenir, Silvana, Marta) não usam o app.

## 3. Regras de negócio (portadas do app atual)

**Lançamentos e parcelas**
- **R1.** Meio de pagamento de um lançamento: só Cartão de Crédito ou Débito Automático. Pronto Pagamento
  vai para Gastos Rotineiros.
- **R2.** Criar lançamento: informa valor total **ou** valor da parcela (o outro é calculado), qtd de
  parcelas, **mês da parcela atual** e **nº da parcela atual**. O app calcula o mês da parcela 1
  (mês atual − (nº − 1)); cada parcela seguinte vence um mês depois.
- **R3.** Retroativo: parcelas anteriores à parcela atual nascem **Pagas**, sem data de pagamento
  ("data não registrada").
- **R4.** Divisão do valor em parcelas: centavos de arredondamento vão para a última parcela.
- **R5.** Rateio por **percentual**. A soma precisa bater com o valor total (tolerância de R$ 0,01 × qtd de
  parcelas). No formulário o rateio é informado em R$ por parcela e convertido em percentual. A 1ª linha
  vem com a pessoa logada.
- **R6.** Editar: categoria, descrição e rateio (valor e nº de parcelas mudam só por ajuste/antecipação).
- **R7.** Ajustar valor: "só esta parcela" ou "esta e as seguintes" (só parcelas abertas), ou **"todas,
  inclusive pagas"**.
- **R8.** Antecipar: marca as parcelas escolhidas como pagas (com data e observação opcional). Restantes:
  "manter datas" ou "comprimir" (passam a vencer em meses seguidos a partir do mês seguinte ao pagamento).
- **R9.** Excluir: "tudo" ou "só as abertas" (preserva histórico pago).
- **R10.** Pagar parcelas: várias de uma vez, mesma data de pagamento.

**Recorrentes**
- **R11.** Lançamento recorrente com **2 ou menos** parcelas abertas aparece para renovação.
- **R12.** Renovar gera N parcelas (padrão 12) com o valor da última, continuando numeração e meses.

**Cálculos**
- **R13.** Saldo devedor de um lançamento = soma das parcelas abertas; valor pago = soma das pagas.
- **R14.** Parte de cada pessoa = percentual × valor (total, pago, saldo).
- **R15.** Monitoramento: parcelas filtradas por mês, categoria, meio de pagamento, pessoa e status
  (padrão: Aberto e mês atual); resumo por pessoa (só quem tem valor > 0), por categoria, por meio de
  pagamento e detalhamento parcela a parcela com os devedores.

**Cadastros**
- **R16.** Nomes não se repetem (sem diferenciar maiúsculas).
- **R17.** Só pode excluir o que nunca foi usado; senão, desativar.
- **R18.** Listas sempre em ordem alfabética.

## 4. Telas

Menu lateral no PC e no rodapé do celular. Formulários abrem no painel lateral (tela cheia no celular).

| Tela | Conteúdo | Quem |
|---|---|---|
| **Início** | Resumo do mês: a pagar, pago, próximos vencimentos, renovações pendentes | todos (Admin vê também gastos e carteira) |
| **Lançar** (gasto rotineiro) + **Histórico** | Registro rápido e lista por mês | só Admin |
| **Lançamentos** | Lista com filtros (título, mês/ano atual, categoria, meio, pessoa) → detalhe com saldo por pessoa, parcelas e ações (editar, ajustar, antecipar, excluir); botão "+" para nova conta | todos (tela padrão do Colaborador) |
| **Pagar Parcelas** | Filtros (mês/ano atual, meio, categoria, pessoa), agrupado por conta, "selecionar todas", total selecionado, `Nº2/10` | todos |
| **Monitoramento** | R15 | todos |
| **Recorrentes** | R11/R12 | todos |
| **Carteira** | ver §5 | só Admin |
| **Cadastros** | Categorias, Meios de pagamento, Pessoas | todos |
| **Ajustes** | Código de conexão, sincronização, tema | todos |

Toda ação destrutiva (pagar, antecipar, ajustar, excluir) oferece **Desfazer**.

## 5. Carteira (funcionalidade nova — só Admin)

Objetivo: saber **de onde vem o dinheiro** (terceiros, salário, empréstimo, renda extra) e **quanto ainda
está disponível**. Funciona como uma carteira única: tudo o que entra soma, cada pagamento diminui.

- **C1. Fontes** (cadastro): já vêm 4 — Salário · Recebido de terceiros · Empréstimo · Renda extra.
  O Admin pode criar outras (ex.: "Salário Paulo"), editar e desativar (mesmas regras R16–R18).
- **C2. Entradas**: data, fonte, valor e descrição opcional. Não ficam ligadas a nenhuma conta
  específica — o dinheiro vai para a carteira única.
- **C3. Início**: o Admin define uma **data de início** e registra o **saldo inicial** (uma entrada com
  fonte "Saldo inicial" nessa data). Nada antes da data de início conta.
- **C4. Saídas** (automáticas, sem o usuário informar nada):
  - cada **parcela paga** com data de pagamento a partir da data de início — **valor inteiro** da
    parcela (é o que sai da conta para pagar a fatura; a parte de outras pessoas volta como entrada);
  - cada **gasto rotineiro** com data a partir da data de início.
  Parcelas marcadas como pagas sem data (retroativas) não contam.
- **C5. Saldo disponível** = entradas − saídas. Pode ficar negativo (o app mostra em destaque).
- **C6.** Desfazer um pagamento, excluir um gasto ou excluir uma entrada recalcula o saldo na hora.
- **C7.** Entrada de empréstimo **não** cria dívida automaticamente — a dívida é lançada à parte.
- **C8.** Recebido de terceiros **não** altera o Monitoramento (a dívida de cada pessoa continua sendo
  calculada pelas parcelas).
- **C9. Tela Carteira**: saldo disponível em destaque; entradas e saídas do mês (filtro por mês/ano),
  totais por fonte; botão "+" para nova entrada.

Observação: os pagamentos feitos pelo Paulo também reduzem a carteira (ele não vê, mas o saldo do Admin
reflete).

## 6. Migração dos dados

- **M1.** Script de mão única: lê as 7 abas da planilha atual (sem alterar nada) e grava na planilha nova
  no formato da base, com IDs novos e todas as ligações refeitas.
- **M2.** Campos calculados (D1) não são migrados; parcelas recebem IDs previsíveis (D2).
- **M3.** Pode ser ensaiada quantas vezes for preciso. Antes da virada, os totais (saldo por pessoa,
  monitoramento, levantamento de dívidas) são conferidos nos dois apps.
- **M4.** Virada: parar de lançar no app antigo → migração final → conferência → instalar o novo nos
  aparelhos → antigo fica um tempo só para consulta.

## 7. Fora do escopo desta versão (pode entrar depois)

- Relatórios (resumo mensal por categoria/meio; levantamento de dívidas e plano de quitação como telas).
- Metas e alertas de gastos.
