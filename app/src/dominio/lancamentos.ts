// Regras das contas (lançamentos, rateios e parcelas) — R1 a R14 da especificação.
// Funções PURAS: recebem registros e devolvem os registros que devem ser gravados.
import type { Id, Lancamento, MeioPagamento, Parcela, Rateio } from './tipos';
import { arred, distribuirPorPercentual, dividirEmParcelas, quaseIgual, somar } from './dinheiro';
import { mesDe, somarMeses } from './meses';

/* ---------------- IDs previsíveis (D2) ---------------- */

export const idParcela = (lancamentoId: Id, numero: number) => `${lancamentoId}-p${numero}`;
export const idRateio = (lancamentoId: Id, pessoaId: Id) => `${lancamentoId}-${pessoaId}`;

/* ---------------- Criar conta (R1–R5) ---------------- */

export interface LinhaRateio {
  pessoa_id: Id;
  /** Valor da parcela que cabe a essa pessoa (como no formulário). */
  valorParcela: number;
}

export interface DadosConta {
  data: string;
  categoria_id: Id;
  meio_pagamento_id: Id;
  descricao: string;
  observacao: string;
  recorrente: boolean;
  valorTotal: number;
  qtdParcelas: number;
  /** Mês da parcela atual ("AAAA-MM") e o número dela (R2). */
  mesParcelaAtual: string;
  numeroParcelaAtual: number;
  rateio: LinhaRateio[];
}

export interface ContaGerada {
  lancamento: Lancamento;
  rateios: Rateio[];
  parcelas: Parcela[];
}

const carimbo = (agora: Date) => agora.toISOString();
const reg = (id: Id, agora: Date) => ({ id, criado_em: carimbo(agora), atualizado_em: carimbo(agora), excluido: false });

/** Tolerância do rateio: R$ 0,01 por parcela (R5). */
export const toleranciaRateio = (qtdParcelas: number) => 0.01 * qtdParcelas;

/** Total do rateio informado (valor da parcela × qtd de parcelas, por pessoa). */
export const totalRateio = (rateio: LinhaRateio[], qtdParcelas: number) => somar(rateio.map((r) => arred(r.valorParcela * qtdParcelas)));

export function validarRateio(rateio: LinhaRateio[], valorTotal: number, qtdParcelas: number): string[] {
  const erros: string[] = [];
  if (!rateio.length) erros.push('Informe ao menos uma pessoa no rateio.');
  if (rateio.some((r) => !r.pessoa_id)) erros.push('Escolha a pessoa em todas as linhas do rateio.');
  const ids = rateio.map((r) => r.pessoa_id).filter(Boolean);
  if (new Set(ids).size !== ids.length) erros.push('A mesma pessoa aparece duas vezes no rateio.');
  if (rateio.some((r) => !(r.valorParcela >= 0))) erros.push('Os valores do rateio não podem ser negativos.');
  if (rateio.length && !quaseIgual(totalRateio(rateio, qtdParcelas), valorTotal, toleranciaRateio(qtdParcelas))) {
    erros.push('A soma do rateio não bate com o valor total.');
  }
  return erros;
}

export function validarConta(d: DadosConta, meios: MeioPagamento[]): string[] {
  const erros: string[] = [];
  if (!d.categoria_id) erros.push('Escolha a categoria.');
  const meio = meios.find((m) => m.id === d.meio_pagamento_id);
  if (!meio) erros.push('Escolha o meio de pagamento.');
  else if (meio.tipo === 'Pronto Pagamento') erros.push('Pronto pagamento (dinheiro, Pix) vai em Gastos, não em Lançamentos.');
  if (!d.descricao.trim()) erros.push('Informe a descrição.');
  if (!(d.valorTotal > 0)) erros.push('Informe o valor.');
  if (!Number.isInteger(d.qtdParcelas) || d.qtdParcelas < 1) erros.push('A quantidade de parcelas deve ser 1 ou mais.');
  if (!Number.isInteger(d.numeroParcelaAtual) || d.numeroParcelaAtual < 1 || d.numeroParcelaAtual > d.qtdParcelas) {
    erros.push('O nº da parcela atual deve estar entre 1 e a quantidade de parcelas.');
  }
  if (!/^\d{4}-\d{2}$/.test(d.mesParcelaAtual)) erros.push('Escolha o mês da parcela atual.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data)) erros.push('Informe a data da compra.');
  if (erros.length) return erros;
  return validarRateio(d.rateio, d.valorTotal, d.qtdParcelas);
}

/** Percentuais a partir dos valores em R$ (a soma dá exatamente 1). */
export function percentuaisDoRateio(rateio: LinhaRateio[], qtdParcelas: number): number[] {
  const totais = rateio.map((r) => r.valorParcela * qtdParcelas);
  const soma = totais.reduce((s, v) => s + v, 0);
  if (!soma) return rateio.map(() => 1 / rateio.length);
  return totais.map((t) => t / soma);
}

function montarRateios(lancamentoId: Id, rateio: LinhaRateio[], qtdParcelas: number, agora: Date): Rateio[] {
  const pct = percentuaisDoRateio(rateio, qtdParcelas);
  return rateio.map((r, i) => ({ ...reg(idRateio(lancamentoId, r.pessoa_id), agora), lancamento_id: lancamentoId, pessoa_id: r.pessoa_id, percentual: pct[i] }));
}

/** R2–R5 — gera o lançamento, o rateio e todas as parcelas. */
export function gerarConta(id: Id, d: DadosConta, agora = new Date()): ContaGerada {
  const mesInicial = somarMeses(d.mesParcelaAtual, -(d.numeroParcelaAtual - 1));
  const valores = dividirEmParcelas(d.valorTotal, d.qtdParcelas);
  const lancamento: Lancamento = {
    ...reg(id, agora),
    data: d.data,
    categoria_id: d.categoria_id,
    meio_pagamento_id: d.meio_pagamento_id,
    descricao: d.descricao.trim(),
    observacao: d.observacao.trim(),
    recorrente: d.recorrente,
  };
  const parcelas: Parcela[] = valores.map((valor, i) => {
    const numero = i + 1;
    return {
      ...reg(idParcela(id, numero), agora),
      lancamento_id: id,
      numero,
      mes_vencimento: somarMeses(mesInicial, i),
      valor,
      // R3 — anteriores à parcela atual nascem pagas, sem data registrada
      status: numero < d.numeroParcelaAtual ? 'Pago' : 'Aberto',
      data_pagamento: null,
    };
  });
  return { lancamento, rateios: montarRateios(id, d.rateio, d.qtdParcelas, agora), parcelas };
}

/* ---------------- Consulta (R13, R14) ---------------- */

/** Agrupa registros vivos pelo lançamento. */
export function agruparPorLancamento<T extends { lancamento_id: Id; excluido: boolean }>(lista: T[]): Map<Id, T[]> {
  const mapa = new Map<Id, T[]>();
  for (const x of lista) {
    if (x.excluido) continue;
    const grupo = mapa.get(x.lancamento_id);
    if (grupo) grupo.push(x);
    else mapa.set(x.lancamento_id, [x]);
  }
  return mapa;
}

/** Parcelas vivas de cada lançamento, em ordem de número. */
export function parcelasPorLancamento(parcelas: Parcela[]): Map<Id, Parcela[]> {
  const mapa = agruparPorLancamento(parcelas);
  for (const grupo of mapa.values()) grupo.sort((a, b) => a.numero - b.numero);
  return mapa;
}

export interface PartePessoa {
  pessoa_id: Id;
  percentual: number;
  total: number;
  pago: number;
  saldo: number;
}

export interface ResumoConta {
  valorTotal: number;
  qtdParcelas: number;
  pagas: number;
  valorPago: number;
  saldoDevedor: number;
  proxima: Parcela | null;
  porPessoa: PartePessoa[];
}

export function resumirConta(parcelas: Parcela[], rateios: Rateio[]): ResumoConta {
  const vivas = parcelas.filter((p) => !p.excluido).sort((a, b) => a.numero - b.numero);
  const pagasLista = vivas.filter((p) => p.status === 'Pago');
  const abertas = vivas.filter((p) => p.status === 'Aberto');
  const valorTotal = somar(vivas.map((p) => p.valor));
  const valorPago = somar(pagasLista.map((p) => p.valor));
  const ativos = rateios.filter((r) => !r.excluido);
  const pct = ativos.map((r) => r.percentual);
  const totais = distribuirPorPercentual(valorTotal, pct);
  const pagos = distribuirPorPercentual(valorPago, pct);
  return {
    valorTotal,
    qtdParcelas: vivas.length,
    pagas: pagasLista.length,
    valorPago,
    saldoDevedor: somar(abertas.map((p) => p.valor)),
    proxima: abertas[0] ?? null,
    porPessoa: ativos.map((r, i) => ({ pessoa_id: r.pessoa_id, percentual: r.percentual, total: totais[i], pago: pagos[i], saldo: arred(totais[i] - pagos[i]) })),
  };
}

/* ---------------- Filtros da lista de contas ---------------- */

export interface FiltroContas {
  titulo: string;
  /** "AAAA-MM" — conta com alguma parcela (paga ou aberta) vencendo nesse mês; vazio = todos. */
  mes: string;
  categoria_id: string;
  meio_pagamento_id: string;
  pessoa_id: string;
}

export function filtrarContas(lancamentos: Lancamento[], parcelas: Map<Id, Parcela[]>, rateios: Map<Id, Rateio[]>, f: FiltroContas): Lancamento[] {
  const termo = f.titulo.trim().toLocaleLowerCase('pt-BR');
  return lancamentos.filter((l) => {
    if (l.excluido) return false;
    if (termo && !l.descricao.toLocaleLowerCase('pt-BR').includes(termo)) return false;
    if (f.categoria_id && l.categoria_id !== f.categoria_id) return false;
    if (f.meio_pagamento_id && l.meio_pagamento_id !== f.meio_pagamento_id) return false;
    if (f.pessoa_id && !(rateios.get(l.id) ?? []).some((r) => r.pessoa_id === f.pessoa_id)) return false;
    if (f.mes && !(parcelas.get(l.id) ?? []).some((p) => p.mes_vencimento === f.mes)) return false;
    return true;
  });
}

/* ---------------- Editar (R6) ---------------- */

export interface EdicaoConta {
  categoria_id: Id;
  meio_pagamento_id: Id;
  descricao: string;
  observacao: string;
  rateio: LinhaRateio[];
}

/** Devolve o lançamento alterado e os rateios a gravar (os removidos ficam excluídos). */
export function editarConta(lanc: Lancamento, rateiosAtuais: Rateio[], e: EdicaoConta, qtdParcelas: number, agora = new Date()) {
  const lancamento: Lancamento = { ...lanc, categoria_id: e.categoria_id, meio_pagamento_id: e.meio_pagamento_id, descricao: e.descricao.trim(), observacao: e.observacao.trim() };
  const novos = montarRateios(lanc.id, e.rateio, qtdParcelas, agora).map((r) => {
    const existente = rateiosAtuais.find((x) => x.id === r.id);
    return existente ? { ...existente, percentual: r.percentual, excluido: false } : r;
  });
  const removidos = rateiosAtuais.filter((r) => !r.excluido && !novos.some((n) => n.id === r.id)).map((r) => ({ ...r, excluido: true }));
  return { lancamento, rateios: [...novos, ...removidos] };
}

/* ---------------- Pagar (R10) ---------------- */

export function pagarParcelas(parcelas: Parcela[], data: string): Parcela[] {
  return parcelas.filter((p) => p.status === 'Aberto' && !p.excluido).map((p) => ({ ...p, status: 'Pago' as const, data_pagamento: data }));
}

/* ---------------- Ajustar valor (R7) ---------------- */

export type ModoAjuste = 'apenasEsta' | 'emDiante' | 'todas';

export function ajustarValor(parcelas: Parcela[], numero: number, novoValor: number, modo: ModoAjuste): Parcela[] {
  const vivas = parcelas.filter((p) => !p.excluido);
  const alvo = vivas.filter((p) => {
    if (modo === 'todas') return true;
    if (p.status !== 'Aberto') return false;
    return modo === 'apenasEsta' ? p.numero === numero : p.numero >= numero;
  });
  return alvo.map((p) => ({ ...p, valor: arred(novoValor) }));
}

/* ---------------- Antecipar (R8) ---------------- */

export type ModoRestante = 'manter' | 'comprimir';

/**
 * Marca as escolhidas como pagas na data informada. Em "comprimir", as que continuam abertas passam a
 * vencer em meses seguidos a partir do mês seguinte ao pagamento, sem buraco.
 */
export function anteciparParcelas(parcelas: Parcela[], ids: Id[], data: string, modo: ModoRestante): Parcela[] {
  const vivas = parcelas.filter((p) => !p.excluido);
  const pagas = vivas.filter((p) => ids.includes(p.id) && p.status === 'Aberto').map((p) => ({ ...p, status: 'Pago' as const, data_pagamento: data }));
  if (modo === 'manter') return pagas;
  const base = somarMeses(mesDe(data), 1);
  const restantes = vivas
    .filter((p) => p.status === 'Aberto' && !ids.includes(p.id))
    .sort((a, b) => a.numero - b.numero)
    .map((p, i) => ({ ...p, mes_vencimento: somarMeses(base, i) }));
  return [...pagas, ...restantes];
}

/* ---------------- Excluir (R9) ---------------- */

export type ModoExclusao = 'tudo' | 'abertas';

/** Devolve tudo o que deve ser marcado como excluído. */
export function excluirConta(lanc: Lancamento, parcelas: Parcela[], rateios: Rateio[], modo: ModoExclusao) {
  const vivas = parcelas.filter((p) => !p.excluido);
  const vivosRateio = rateios.filter((r) => !r.excluido);
  const restaPaga = vivas.some((p) => p.status === 'Pago');
  if (modo === 'abertas' && restaPaga) {
    return { lancamento: null, parcelas: vivas.filter((p) => p.status === 'Aberto').map((p) => ({ ...p, excluido: true })), rateios: [] as Rateio[] };
  }
  // "tudo", ou "só as abertas" quando não sobra nenhuma paga: a conta inteira sai
  return {
    lancamento: { ...lanc, excluido: true },
    parcelas: vivas.map((p) => ({ ...p, excluido: true })),
    rateios: vivosRateio.map((r) => ({ ...r, excluido: true })),
  };
}

/* ---------------- Recorrentes (R11, R12) ---------------- */

export const LIMITE_RENOVACAO = 2;

export function contasParaRenovar(lancamentos: Lancamento[], parcelas: Map<Id, Parcela[]>) {
  return lancamentos
    .filter((l) => l.recorrente && !l.excluido)
    .map((l) => ({ lancamento: l, abertas: (parcelas.get(l.id) ?? []).filter((p) => p.status === 'Aberto').length }))
    .filter((x) => x.abertas <= LIMITE_RENOVACAO)
    .sort((a, b) => a.abertas - b.abertas || a.lancamento.descricao.localeCompare(b.lancamento.descricao, 'pt-BR'));
}

/** Gera mais N parcelas com o valor da última, continuando numeração e meses. */
export function renovarConta(lancamentoId: Id, parcelas: Parcela[], qtd = 12, agora = new Date()): Parcela[] {
  const vivas = parcelas.filter((p) => !p.excluido).sort((a, b) => a.numero - b.numero);
  const ultima = vivas[vivas.length - 1];
  if (!ultima) return [];
  return Array.from({ length: qtd }, (_, i) => {
    const numero = ultima.numero + i + 1;
    return {
      ...reg(idParcela(lancamentoId, numero), agora),
      lancamento_id: lancamentoId,
      numero,
      mes_vencimento: somarMeses(ultima.mes_vencimento, i + 1),
      valor: ultima.valor,
      status: 'Aberto' as const,
      data_pagamento: null,
    };
  });
}
