// Regras dos cadastros: categorias, meios de pagamento, pessoas e fontes da carteira (R16–R18).
import type {
  Categoria,
  Entrada,
  Fonte,
  GastoRotineiro,
  Id,
  Lancamento,
  MeioPagamento,
  Pessoa,
  Rateio,
  TipoMeio,
  TipoPessoa,
} from './tipos';
import { TIPOS_MEIO, TIPOS_PESSOA } from './tipos';

const carimbo = (agora: Date) => agora.toISOString();
const base = (id: Id, agora: Date) => ({ id, criado_em: carimbo(agora), atualizado_em: carimbo(agora), excluido: false });

export function novaCategoria(id: Id, nome = '', agora = new Date()): Categoria {
  return { ...base(id, agora), nome, ativo: true };
}

export function novoMeio(id: Id, campos: Partial<MeioPagamento> = {}, agora = new Date()): MeioPagamento {
  return { ...base(id, agora), nome: '', tipo: 'Cartão de Crédito', dia_fechamento: null, dia_vencimento: null, ativo: true, ...campos };
}

export function novaPessoa(id: Id, campos: Partial<Pessoa> = {}, agora = new Date()): Pessoa {
  return { ...base(id, agora), nome: '', tipo: 'Membro do Domicílio', papel: 'Colaborador', ativo: true, ...campos };
}

export function novaFonte(id: Id, nome = '', agora = new Date()): Fonte {
  return { ...base(id, agora), nome, ativo: true };
}

type ComNome = { id: Id; nome: string; excluido: boolean };

/** Registros não excluídos. */
export const vivos = <T extends { excluido: boolean }>(lista: T[]) => lista.filter((x) => !x.excluido);

/** R18 — ordem alfabética (português, sem diferenciar acentos/maiúsculas). */
export function ordenarPorNome<T extends { nome: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

/** Só os ativos e não excluídos, em ordem alfabética (para os campos de escolha dos formulários). */
export function paraEscolha<T extends ComNome & { ativo: boolean }>(lista: T[], manterId?: Id | null): T[] {
  return ordenarPorNome(lista.filter((x) => !x.excluido && (x.ativo || x.id === manterId)));
}

/** R16 — nome obrigatório e sem repetir (ignorando maiúsculas e espaços nas pontas). */
export function validarNome(nome: string, lista: ComNome[], idAtual: Id, rotulo: string): string[] {
  const limpo = nome.trim();
  if (!limpo) return ['Informe o nome.'];
  const repetido = lista.some((x) => !x.excluido && x.id !== idAtual && x.nome.trim().toLocaleLowerCase('pt-BR') === limpo.toLocaleLowerCase('pt-BR'));
  return repetido ? [`Já existe ${rotulo} com esse nome.`] : [];
}

export function validarMeio(m: MeioPagamento, lista: MeioPagamento[]): string[] {
  const erros = validarNome(m.nome, lista, m.id, 'um meio de pagamento');
  if (!TIPOS_MEIO.includes(m.tipo as TipoMeio)) erros.push('Escolha o tipo.');
  for (const [dia, rotulo] of [
    [m.dia_fechamento, 'fechamento'],
    [m.dia_vencimento, 'vencimento'],
  ] as const) {
    if (dia !== null && (!Number.isInteger(dia) || dia < 1 || dia > 31)) erros.push(`Dia de ${rotulo} deve estar entre 1 e 31.`);
  }
  return erros;
}

export function validarPessoa(p: Pessoa, lista: Pessoa[]): string[] {
  const erros = validarNome(p.nome, lista, p.id, 'uma pessoa');
  if (!TIPOS_PESSOA.includes(p.tipo as TipoPessoa)) erros.push('Escolha o tipo.');
  if (p.tipo === 'Membro do Domicílio' && !p.papel) erros.push('Membro do domicílio precisa de um papel (Admin ou Colaborador).');
  return erros;
}

/** Terceiros não têm papel. */
export function normalizarPessoa(p: Pessoa): Pessoa {
  return { ...p, nome: p.nome.trim(), papel: p.tipo === 'Membro do Domicílio' ? p.papel ?? 'Colaborador' : null };
}

/* ---------------- R17 — uso (só dá para excluir o que nunca foi usado) ---------------- */

export interface BaseUso {
  lancamentos: Lancamento[];
  rateios: Rateio[];
  gastos: GastoRotineiro[];
  entradas: Entrada[];
}

const contar = <T extends { excluido: boolean }>(lista: T[], teste: (x: T) => boolean) => lista.filter((x) => !x.excluido && teste(x)).length;

export function usosCategoria(id: Id, b: BaseUso): number {
  return contar(b.lancamentos, (l) => l.categoria_id === id) + contar(b.gastos, (g) => g.categoria_id === id);
}

export function usosMeio(id: Id, b: BaseUso): number {
  return contar(b.lancamentos, (l) => l.meio_pagamento_id === id) + contar(b.gastos, (g) => g.meio_pagamento_id === id);
}

export function usosPessoa(id: Id, b: BaseUso): number {
  return contar(b.rateios, (r) => r.pessoa_id === id) + contar(b.gastos, (g) => g.pessoa_id === id);
}

export function usosFonte(id: Id, b: BaseUso): number {
  return contar(b.entradas, (e) => e.fonte_id === id);
}
