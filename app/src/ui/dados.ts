// Dados já organizados para as telas (mapas de nomes, parcelas e rateios por conta).
import { useMemo } from 'preact/hooks';
import type { Id, Lancamento, Parcela, Rateio } from '../dominio/tipos';
import { agruparPorLancamento, parcelasPorLancamento } from '../dominio/lancamentos';
import { useEntidade } from '../dados/ganchos';

export interface Contas {
  lancamentos: Lancamento[];
  /** Lançamentos vivos por id. */
  porId: Map<Id, Lancamento>;
  parcelas: Map<Id, Parcela[]>;
  rateios: Map<Id, Rateio[]>;
  /** Todas as parcelas vivas de lançamentos vivos. */
  todasParcelas: Parcela[];
}

export function useContas(): Contas {
  const lancamentos = useEntidade('lancamentos');
  const parcelas = useEntidade('parcelas');
  const rateios = useEntidade('rateios');
  return useMemo(() => {
    const vivos = lancamentos.filter((l) => !l.excluido);
    const porId = new Map(vivos.map((l) => [l.id, l]));
    const mapaParcelas = parcelasPorLancamento(parcelas);
    return {
      lancamentos: vivos,
      porId,
      parcelas: mapaParcelas,
      rateios: agruparPorLancamento(rateios),
      todasParcelas: [...mapaParcelas.entries()].filter(([id]) => porId.has(id)).flatMap(([, lista]) => lista),
    };
  }, [lancamentos, parcelas, rateios]);
}

export interface Nomes {
  categoria: (id: Id) => string;
  meio: (id: Id) => string;
  pessoa: (id: Id) => string;
}

export function useNomes(): Nomes {
  const categorias = useEntidade('categorias');
  const meios = useEntidade('meios_pagamento');
  const pessoas = useEntidade('pessoas');
  return useMemo(() => {
    const mapa = (lista: { id: Id; nome: string }[]) => new Map(lista.map((x) => [x.id, x.nome]));
    const c = mapa(categorias);
    const m = mapa(meios);
    const p = mapa(pessoas);
    return {
      categoria: (id) => c.get(id) ?? '—',
      meio: (id) => m.get(id) ?? '—',
      pessoa: (id) => p.get(id) ?? '—',
    };
  }, [categorias, meios, pessoas]);
}
