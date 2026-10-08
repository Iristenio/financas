# Plano — Finanças (nova versão)

Base: `ESPECIFICACAO.md`. Cada etapa termina com algo **usável** no celular e no PC, publicado no GitHub
Pages. As regras de negócio ficam em `app/src/dominio/` com testes automáticos.

O app antigo foi o **oficial** até a etapa 8 (virada em 2026-09-26). Até a etapa 6, o app novo funciona só no aparelho
(sem planilha) — dá para testar à vontade sem risco para os dados reais.

| # | Etapa | Entrega (o que você consegue fazer) | Regras |
|---|---|---|---|
| 0 ✅ | **Publicação** | Repositório no GitHub criado; app base publicado e instalável | — |
| 1 ✅ | **Cadastros** | Criar, editar, desativar e excluir categorias, meios de pagamento e pessoas | R16–R18 |
| 2 ✅ | **Lançamentos** | Lançar conta (parcelada, retroativa, com rateio); lista com filtros; detalhe com saldo por pessoa e parcelas | R1–R6, R13, R14, D1–D3 |
| 3 ✅ | **Pagar e ajustar** | Pagar parcelas em lote; ajustar valor (3 modos); antecipar (manter/comprimir); editar; excluir (tudo/só abertas) — tudo com **Desfazer** | R7–R10 |
| 4 ✅ | **Acompanhamento** | Monitoramento, Recorrentes (renovar) e tela de Início com o resumo do mês | R11, R12, R15 |
| 5 ✅ | **Só do Admin** | Lançar/Histórico (gastos rotineiros) e **Carteira** (fontes, entradas, saldo disponível) | C1–C9 |
| 6 ✅ | **Sincronização** | Backend na conta pessoal com **um código por pessoa** e bloqueio do Colaborador no servidor; planilha nova; app do Paulo sem Lançar/Histórico/Carteira | P1–P4 |
| 7 ✅ | **Migração (ensaio)** | Script que copia os dados do app atual para uma planilha de ensaio; conferência dos totais nos dois apps | M1–M3 |
| 8 ✅ | **Virada** | Migração final, instalação nos aparelhos, app antigo só para consulta | M4 |

## Como cada etapa é conferida

1. Testes automáticos das regras (`npm test`).
2. Teste no navegador em **celular (375×812)** e **PC (~1440×900)**, conferindo a rolagem.
3. Commit + push → publicação automática.
4. Explicação para você de como usar o que foi entregue.

## O que preciso de você

- **Etapa 0:** criar um repositório **público** vazio no GitHub (sugestão de nome: `financas`) e ativar
  **Settings → Pages → Source: GitHub Actions**.
- **Etapa 6:** entrar com a conta pessoal no clasp (abre o navegador para autorizar) e executar
  `configurar()` no editor do Apps Script (autorizar o acesso à planilha).
- **Etapas 7 e 8:** conferir os totais e escolher o dia da virada.

## Andamento

- Etapas 0 a 5 concluídas em 2026-09-26 (53 testes automáticos).
- Adiantado da etapa 7: o importador (Ajustes → "Importar do app antigo", só Admin) já existe e foi
  conferido com os dados reais: totais do mês, saldo devedor total e a parte do Iristenio batem ao centavo.
- Etapa 6, parte do código (pronta e testada): um token por pessoa no servidor (`USUARIOS` em
  `backend/configurar.js`), bloqueio do Colaborador no servidor e o app assume a pessoa/papel do código.
- Backend publicado na conta pessoal em 2026-09-26 (projeto "Finanças API", planilha "Finanças - dados").
  PC do Iristenio conectado; a planilha recebeu exatamente os dados importados (59 contas, 673 parcelas…).
- Etapas 7 e 8 (2026-09-26): a migração foi feita pelo importador (Ajustes); os totais do app antigo e do novo
  conferem (59 contas, 673 parcelas, 314 pagas = R$ 60.721,29, total R$ 224.763,19, 22 gastos).
  O endereço antigo (iristenio.github.io/projeto-financas) agora só mostra o aviso "Este app foi substituído"
  com link para o novo. A planilha e o Apps Script antigos (conta Unilab) ficam guardados como arquivo.
- Falta: instalar no aparelho do Paulo com o código dele (conferir que não aparecem Gastos/Carteira).
- 2026-10-08: tela **Painel** (todos): valor devido por mês (pago × em aberto), saldo devedor no fim do mês e
  "quando as dívidas acabam", em 24 meses (12 para trás e 12 à frente), com filtros de pessoa, recorrentes,
  meio e categoria. Regras em `dominio/painel.ts` (com testes).
