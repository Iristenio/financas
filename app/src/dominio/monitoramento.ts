// Monitoramento (R15): quem deve quanto, por categoria e por meio de pagamento, parcela a parcela.
import type { Id, Lancamento, Parcela, Rateio } from './tipos';
import { distribuirPorPercentual, somar } from './dinheiro';

export type StatusFiltro = 'Aberto' | 'Pago' | 'Todos';

export interface FiltroMonitor {
  mes: string; // "" = todos
  categoria_id: string;
  meio_pagamento_id: string;
  pessoa_id: string;
  status: StatusFiltro;
}

export interface LinhaMonitor {
  parcela: Parcela;
  lancamento: Lancamento;
  /** Parte de cada pessoa nesta parcela (só a pessoa filtrada, se houver filtro de pessoa). */
  devedores: { pessoa_id: Id; valor: number }[];
}

export interface ResultadoMonitor {
  total: number;
  porPessoa: { pessoa_id: Id; total: number }[];
  porCategoria: { id: Id; total: number }[];
  porMeio: { id: Id; total: number }[];
  linhas: LinhaMonitor[];
}

function somarPor(pares: [Id, number][]): { id: Id; total: number }[] {
  const mapa = new Map<Id, number[]>();
  for (const [id, v] of pares) mapa.set(id, [...(mapa.get(id) ?? []), v]);
  return [...mapa.entries()].map(([id, vs]) => ({ id, total: somar(vs) })).sort((a, b) => b.total - a.total);
}

export function monitorar(lancamentos: Map<Id, Lancamento>, parcelas: Parcela[], rateios: Map<Id, Rateio[]>, f: FiltroMonitor): ResultadoMonitor {
  const linhas: LinhaMonitor[] = [];
  for (const p of parcelas) {
    if (p.excluido) continue;
    const l = lancamentos.get(p.lancamento_id);
    if (!l || l.excluido) continue;
    if (f.status !== 'Todos' && p.status !== f.status) continue;
    if (f.mes && p.mes_vencimento !== f.mes) continue;
    if (f.categoria_id && l.categoria_id !== f.categoria_id) continue;
    if (f.meio_pagamento_id && l.meio_pagamento_id !== f.meio_pagamento_id) continue;
    const rs = (rateios.get(l.id) ?? []).filter((r) => !r.excluido);
    if (f.pessoa_id && !rs.some((r) => r.pessoa_id === f.pessoa_id)) continue;
    const partes = distribuirPorPercentual(p.valor, rs.map((r) => r.percentual));
    const devedores = rs.map((r, i) => ({ pessoa_id: r.pessoa_id, valor: partes[i] })).filter((d) => !f.pessoa_id || d.pessoa_id === f.pessoa_id);
    linhas.push({ parcela: p, lancamento: l, devedores });
  }
  linhas.sort((a, b) => a.parcela.mes_vencimento.localeCompare(b.parcela.mes_vencimento) || a.lancamento.descricao.localeCompare(b.lancamento.descricao, 'pt-BR'));

  return {
    total: somar(linhas.map((x) => x.parcela.valor)),
    porPessoa: somarPor(linhas.flatMap((x) => x.devedores.map((d) => [d.pessoa_id, d.valor] as [Id, number])))
      .filter((x) => x.total > 0)
      .map((x) => ({ pessoa_id: x.id, total: x.total })),
    porCategoria: somarPor(linhas.map((x) => [x.lancamento.categoria_id, x.parcela.valor])),
    porMeio: somarPor(linhas.map((x) => [x.lancamento.meio_pagamento_id, x.parcela.valor])),
    linhas,
  };
}
