// Carteira (C1–C9): tudo o que entra soma; cada parcela paga e cada gasto do dia a dia diminui.
import type { CarteiraConfig, Entrada, Fonte, GastoRotineiro, Id, Lancamento, Parcela } from './tipos';
import { ID_CARTEIRA } from './tipos';
import { arred, somar } from './dinheiro';

/** Fontes que já vêm prontas (C1). IDs fixos: iniciar a carteira em dois aparelhos não duplica. */
export const FONTES_PADRAO: { id: Id; nome: string }[] = [
  { id: 'fonte-salario', nome: 'Salário' },
  { id: 'fonte-terceiros', nome: 'Recebido de terceiros' },
  { id: 'fonte-emprestimo', nome: 'Empréstimo' },
  { id: 'fonte-renda-extra', nome: 'Renda extra' },
  { id: 'fonte-saldo-inicial', nome: 'Saldo inicial' },
];
export const ID_FONTE_SALDO_INICIAL = 'fonte-saldo-inicial';
export const ID_ENTRADA_SALDO_INICIAL = 'entrada-saldo-inicial';

/** C3 — define a data de início, cria as fontes padrão e registra o saldo inicial. */
export function iniciarCarteira(dataInicio: string, saldoInicial: number, fontesExistentes: Fonte[], agora = new Date()) {
  const carimbo = agora.toISOString();
  const base = (id: Id) => ({ id, criado_em: carimbo, atualizado_em: carimbo });
  const config: CarteiraConfig = { ...base(ID_CARTEIRA), data_inicio: dataInicio };
  const fontes: Fonte[] = FONTES_PADRAO.filter((f) => !fontesExistentes.some((e) => e.id === f.id)).map((f) => ({ ...base(f.id), nome: f.nome, ativo: true, excluido: false }));
  const entrada: Entrada = { ...base(ID_ENTRADA_SALDO_INICIAL), data: dataInicio, fonte_id: ID_FONTE_SALDO_INICIAL, valor: arred(saldoInicial), descricao: 'Saldo inicial', excluido: false };
  return { config, fontes, entrada };
}

export function novaEntrada(id: Id, campos: Partial<Entrada> = {}, agora = new Date()): Entrada {
  const carimbo = agora.toISOString();
  return { id, criado_em: carimbo, atualizado_em: carimbo, excluido: false, data: '', fonte_id: '', valor: 0, descricao: '', ...campos };
}

export function validarEntrada(e: Entrada): string[] {
  const erros: string[] = [];
  if (!(e.valor > 0) && e.id !== ID_ENTRADA_SALDO_INICIAL) erros.push('Informe o valor.');
  if (!e.fonte_id) erros.push('Escolha a fonte.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data)) erros.push('Informe a data.');
  return erros;
}

/* ---------------- Movimentos e saldo ---------------- */

export type TipoMovimento = 'entrada' | 'parcela' | 'gasto';

export interface Movimento {
  id: Id;
  tipo: TipoMovimento;
  data: string;
  /** Positivo = entrada; negativo = saída. */
  valor: number;
  /** Id do registro de origem (entrada, gasto ou lançamento da parcela). */
  ref: Id;
  /** Fonte (entradas) ou lançamento (parcelas) ou categoria (gastos). */
  chave: Id;
  numero?: number;
}

export interface BaseCarteira {
  config: CarteiraConfig | undefined;
  entradas: Entrada[];
  gastos: GastoRotineiro[];
  /** Parcelas vivas de lançamentos vivos. */
  parcelas: Parcela[];
  lancamentos: Map<Id, Lancamento>;
}

/** C4 — todos os movimentos a partir da data de início (antes dela nada conta). */
export function movimentosDaCarteira(b: BaseCarteira): Movimento[] {
  const inicio = b.config?.data_inicio;
  if (!inicio) return [];
  const movs: Movimento[] = [];
  for (const e of b.entradas) {
    if (e.excluido || e.data < inicio) continue;
    movs.push({ id: e.id, tipo: 'entrada', data: e.data, valor: e.valor, ref: e.id, chave: e.fonte_id });
  }
  for (const p of b.parcelas) {
    if (p.excluido || p.status !== 'Pago' || !p.data_pagamento || p.data_pagamento < inicio) continue;
    if (!b.lancamentos.has(p.lancamento_id)) continue;
    movs.push({ id: p.id, tipo: 'parcela', data: p.data_pagamento, valor: -p.valor, ref: p.lancamento_id, chave: p.lancamento_id, numero: p.numero });
  }
  for (const g of b.gastos) {
    if (g.excluido || g.data < inicio) continue;
    movs.push({ id: g.id, tipo: 'gasto', data: g.data, valor: -g.valor, ref: g.id, chave: g.categoria_id });
  }
  return movs.sort((a, c) => c.data.localeCompare(a.data) || c.valor - a.valor);
}

export interface ResumoCarteira {
  /** C5 — saldo disponível (todas as entradas − todas as saídas desde o início). */
  saldo: number;
  entradasMes: number;
  saidasMes: number;
  porFonteMes: { id: Id; total: number }[];
  movimentosMes: Movimento[];
}

export function resumirCarteira(movs: Movimento[], mes: string): ResumoCarteira {
  const doMes = movs.filter((m) => m.data.startsWith(mes));
  const entradas = doMes.filter((m) => m.valor > 0);
  const porFonte = new Map<Id, number[]>();
  for (const m of entradas) porFonte.set(m.chave, [...(porFonte.get(m.chave) ?? []), m.valor]);
  return {
    saldo: somar(movs.map((m) => m.valor)),
    entradasMes: somar(entradas.map((m) => m.valor)),
    saidasMes: somar(doMes.filter((m) => m.valor < 0).map((m) => -m.valor)),
    porFonteMes: [...porFonte.entries()].map(([id, vs]) => ({ id, total: somar(vs) })).sort((a, b) => b.total - a.total),
    movimentosMes: doMes,
  };
}
