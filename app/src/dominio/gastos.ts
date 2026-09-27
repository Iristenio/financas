// Gastos do dia a dia (pronto pagamento: dinheiro, Pix, débito na hora) — só Admin.
import type { GastoRotineiro, Id, MeioPagamento, Pessoa } from './tipos';
import { somar } from './dinheiro';

export function novoGasto(id: Id, campos: Partial<GastoRotineiro> = {}, agora = new Date()): GastoRotineiro {
  const carimbo = agora.toISOString();
  return {
    id,
    criado_em: carimbo,
    atualizado_em: carimbo,
    excluido: false,
    data: '',
    categoria_id: '',
    meio_pagamento_id: '',
    pessoa_id: '',
    descricao: '',
    valor: 0,
    ...campos,
  };
}

export function validarGasto(g: GastoRotineiro, meios: MeioPagamento[], pessoas: Pessoa[]): string[] {
  const erros: string[] = [];
  if (!(g.valor > 0)) erros.push('Informe o valor.');
  if (!g.categoria_id) erros.push('Escolha a categoria.');
  const meio = meios.find((m) => m.id === g.meio_pagamento_id);
  if (!meio) erros.push('Escolha o meio de pagamento.');
  else if (meio.tipo !== 'Pronto Pagamento') erros.push('Cartão e débito automático vão em Lançamentos, não em Gastos.');
  const pessoa = pessoas.find((p) => p.id === g.pessoa_id);
  if (!pessoa) erros.push('Escolha quem gastou.');
  else if (pessoa.tipo !== 'Membro do Domicílio') erros.push('Gastos são só de quem mora na casa.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.data)) erros.push('Informe a data.');
  return erros;
}

/** Gastos vivos de um mês ("AAAA-MM"), do mais recente para o mais antigo. */
export function gastosDoMes(gastos: GastoRotineiro[], mes: string): GastoRotineiro[] {
  return gastos
    .filter((g) => !g.excluido && g.data.startsWith(mes))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criado_em.localeCompare(a.criado_em));
}

export function totalPorCategoria(gastos: GastoRotineiro[]): { id: Id; total: number }[] {
  const mapa = new Map<Id, number[]>();
  for (const g of gastos) mapa.set(g.categoria_id, [...(mapa.get(g.categoria_id) ?? []), g.valor]);
  return [...mapa.entries()].map(([id, vs]) => ({ id, total: somar(vs) })).sort((a, b) => b.total - a.total);
}
