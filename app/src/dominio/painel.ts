// Painel (dashboard) da evolução das dívidas: janela de 24 meses (12 para trás + o atual e 11 à frente).
import type { Id, Lancamento, Parcela, Rateio } from './tipos';
import { distribuirPorPercentual, somar } from './dinheiro';
import { somarMeses } from './meses';

export type Recorrentes = 'incluir' | 'excluir';

export interface FiltroPainel {
  pessoa_id: string;
  meio_pagamento_id: string;
  categoria_id: string;
  recorrentes: Recorrentes;
}

/** Uma parcela que passou no filtro, já com o valor que conta (a parte da pessoa, se filtrada). */
export interface ParcelaPainel {
  parcela: Parcela;
  lancamento: Lancamento;
  valor: number;
}

export interface MesPainel {
  mes: string;
  /** Vence no mês e já foi paga. */
  pago: number;
  /** Vence no mês e está em aberto (no passado = atrasada). */
  aberto: number;
  /** Quanto falta pagar no fim do mês (no futuro, supondo cada parcela paga no seu mês). */
  saldo: number;
}

export interface FimDeDivida {
  lancamento: Lancamento;
  /** Mês da última parcela. */
  mes: string;
  /** Quanto deixa de sair por mês depois disso (valor da última parcela). */
  alivio: number;
}

export interface ResultadoPainel {
  meses: MesPainel[];
  /** Contas (não recorrentes) que terminam do mês atual em diante, dentro da janela. */
  fins: FimDeDivida[];
  saldoHoje: number;
}

/** Os 24 meses da janela: 12 antes do mês atual, o atual e 11 depois. */
export const mesesDaJanela = (atual: string) => Array.from({ length: 24 }, (_, i) => somarMeses(atual, i - 12));

export function filtrarParcelas(lancamentos: Map<Id, Lancamento>, parcelas: Parcela[], rateios: Map<Id, Rateio[]>, f: FiltroPainel): ParcelaPainel[] {
  const saida: ParcelaPainel[] = [];
  for (const p of parcelas) {
    if (p.excluido) continue;
    const l = lancamentos.get(p.lancamento_id);
    if (!l || l.excluido) continue;
    if (f.recorrentes === 'excluir' && l.recorrente) continue;
    if (f.meio_pagamento_id && l.meio_pagamento_id !== f.meio_pagamento_id) continue;
    if (f.categoria_id && l.categoria_id !== f.categoria_id) continue;
    let valor = p.valor;
    if (f.pessoa_id) {
      const rs = (rateios.get(l.id) ?? []).filter((r) => !r.excluido);
      const i = rs.findIndex((r) => r.pessoa_id === f.pessoa_id);
      if (i < 0) continue;
      valor = distribuirPorPercentual(p.valor, rs.map((r) => r.percentual))[i];
    }
    saida.push({ parcela: p, lancamento: l, valor });
  }
  return saida;
}

/** Mês em que a parcela sai (ou sairá) da dívida: paga → data do pagamento (ou o vencimento, se sem data);
 *  aberta → o vencimento, ou o mês atual se já estiver atrasada. */
function mesQueSai(p: Parcela, atual: string): string {
  if (p.status === 'Pago') return p.data_pagamento ? p.data_pagamento.slice(0, 7) : p.mes_vencimento;
  return p.mes_vencimento > atual ? p.mes_vencimento : atual;
}

export function montarPainel(itens: ParcelaPainel[], atual: string): ResultadoPainel {
  const janela = mesesDaJanela(atual);
  const meses: MesPainel[] = janela.map((mes) => {
    const doMes = itens.filter((x) => x.parcela.mes_vencimento === mes);
    // Na dívida no fim do mês: a conta já existia e a parcela ainda não tinha saído
    const naDivida = itens.filter((x) => x.lancamento.data.slice(0, 7) <= mes && mesQueSai(x.parcela, atual) > mes);
    return {
      mes,
      pago: somar(doMes.filter((x) => x.parcela.status === 'Pago').map((x) => x.valor)),
      aberto: somar(doMes.filter((x) => x.parcela.status === 'Aberto').map((x) => x.valor)),
      saldo: somar(naDivida.map((x) => x.valor)),
    };
  });

  const ultimo = janela[janela.length - 1];
  const porConta = new Map<Id, ParcelaPainel[]>();
  for (const x of itens) porConta.set(x.lancamento.id, [...(porConta.get(x.lancamento.id) ?? []), x]);
  const fins: FimDeDivida[] = [];
  for (const lista of porConta.values()) {
    const l = lista[0].lancamento;
    if (l.recorrente || !lista.some((x) => x.parcela.status === 'Aberto')) continue;
    const final = lista.reduce((a, b) => (b.parcela.mes_vencimento > a.parcela.mes_vencimento ? b : a));
    const mes = final.parcela.mes_vencimento;
    if (mes >= atual && mes <= ultimo) fins.push({ lancamento: l, mes, alivio: final.valor });
  }
  fins.sort((a, b) => a.mes.localeCompare(b.mes) || b.alivio - a.alivio);

  const saldoHoje = somar(itens.filter((x) => x.parcela.status === 'Aberto').map((x) => x.valor));
  return { meses, fins, saldoHoje };
}
