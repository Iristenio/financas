// Conversão dos dados do app antigo (projetoFinancas) para as entidades novas (M1, M2).
// IDs previsíveis a partir dos IDs antigos: importar de novo substitui, não duplica.
import type { Categoria, GastoRotineiro, Lancamento, MeioPagamento, Parcela, Pessoa, Rateio, TipoMeio, TipoPessoa } from './tipos';
import { arred } from './dinheiro';
import { idParcela, idRateio } from './lancamentos';

/* ---------------- Formato do app antigo (respostas da API) ---------------- */

export interface CategoriaAntiga { id: number; nome: string; ativo: boolean }
export interface MeioAntigo { id: number; nome: string; tipo: string; diaFechamento: number | ''; diaVencimento: number | ''; ativo: boolean }
export interface PessoaAntiga { id: number; nome: string; tipo: string; papel: string; ativo: boolean }
export interface LancamentoAntigo { id: number; data: string; categoriaId: number; meioPagamentoId: number; descricao: string; observacao: string; recorrente: boolean }
export interface ParcelaAntiga {
  ID: number;
  Lancamento_ID: number;
  'Nº Parcela': number;
  'Mês Vencimento': string;
  Valor: number;
  Status: string;
  'Data Pagamento': string;
}
export interface RateioAntigo { pessoaId: number; percentual: number }
export interface GastoAntigo {
  ID: number;
  Data: string;
  Categoria_ID: number;
  MeioPagamento_ID: number;
  Pessoa_ID: number;
  'Descrição': string;
  Valor: number;
}

export interface DadosAntigos {
  categorias: CategoriaAntiga[];
  meios: MeioAntigo[];
  pessoas: PessoaAntiga[];
  lancamentos: LancamentoAntigo[];
  parcelas: ParcelaAntiga[];
  /** Rateio de cada lançamento (id antigo → linhas). */
  rateios: Record<number, RateioAntigo[]>;
  gastos: GastoAntigo[];
}

/* ---------------- IDs ---------------- */

export const idCategoriaAntiga = (id: number) => `cat-${id}`;
export const idMeioAntigo = (id: number) => `meio-${id}`;
export const idPessoaAntiga = (id: number) => `pes-${id}`;
export const idLancamentoAntigo = (id: number) => `lanc-${id}`;
export const idGastoAntigo = (id: number) => `gasto-${id}`;

/* ---------------- Datas ---------------- */

const fmtSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Data da planilha antiga (ISO, meia-noite de Brasília) → "AAAA-MM-DD"; vazio → null. */
export function dataAntiga(valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return fmtSP.format(d);
}

/* ---------------- Conversão ---------------- */

export interface Convertidos {
  categorias: Categoria[];
  meios_pagamento: MeioPagamento[];
  pessoas: Pessoa[];
  lancamentos: Lancamento[];
  rateios: Rateio[];
  parcelas: Parcela[];
  gastos_rotineiros: GastoRotineiro[];
  avisos: string[];
}

const TIPOS_MEIO: TipoMeio[] = ['Pronto Pagamento', 'Cartão de Crédito', 'Débito Automático'];
const TIPOS_PESSOA: TipoPessoa[] = ['Membro do Domicílio', 'Terceiro Monitorado', 'Terceiro Devedor'];

export function converterDadosAntigos(a: DadosAntigos, agora = new Date()): Convertidos {
  const carimbo = agora.toISOString();
  const base = (id: string) => ({ id, criado_em: carimbo, atualizado_em: carimbo, excluido: false });
  const avisos: string[] = [];
  const dia = (v: number | '') => (v === '' || v === null || v === undefined ? null : Number(v));

  const categorias = a.categorias.map((c) => ({ ...base(idCategoriaAntiga(c.id)), nome: c.nome, ativo: c.ativo }));
  const meios_pagamento = a.meios.map((m) => ({
    ...base(idMeioAntigo(m.id)),
    nome: m.nome,
    tipo: (TIPOS_MEIO.includes(m.tipo as TipoMeio) ? m.tipo : 'Cartão de Crédito') as TipoMeio,
    dia_fechamento: dia(m.diaFechamento),
    dia_vencimento: dia(m.diaVencimento),
    ativo: m.ativo,
  }));
  const pessoas = a.pessoas.map((p) => {
    const tipo = (TIPOS_PESSOA.includes(p.tipo as TipoPessoa) ? p.tipo : 'Terceiro Devedor') as TipoPessoa;
    return {
      ...base(idPessoaAntiga(p.id)),
      nome: p.nome,
      tipo,
      papel: tipo === 'Membro do Domicílio' ? (p.papel === 'Admin' ? 'Admin' : 'Colaborador') : null,
      ativo: p.ativo,
    } as Pessoa;
  });

  const lancamentos: Lancamento[] = [];
  const rateios: Rateio[] = [];
  const parcelas: Parcela[] = [];
  const lancIds = new Set<number>();

  for (const l of a.lancamentos) {
    const id = idLancamentoAntigo(l.id);
    lancIds.add(l.id);
    lancamentos.push({
      ...base(id),
      data: dataAntiga(l.data) ?? carimbo.slice(0, 10),
      categoria_id: idCategoriaAntiga(l.categoriaId),
      meio_pagamento_id: idMeioAntigo(l.meioPagamentoId),
      descricao: String(l.descricao ?? '').trim(),
      observacao: String(l.observacao ?? '').trim(),
      recorrente: !!l.recorrente,
    });
    const linhas = a.rateios[l.id] ?? [];
    if (!linhas.length) avisos.push(`"${l.descricao}" veio sem rateio.`);
    const soma = linhas.reduce((s, r) => s + Number(r.percentual), 0) || 1;
    for (const r of linhas) {
      const pessoaId = idPessoaAntiga(r.pessoaId);
      rateios.push({ ...base(idRateio(id, pessoaId)), lancamento_id: id, pessoa_id: pessoaId, percentual: Number(r.percentual) / soma });
    }
  }

  for (const p of a.parcelas) {
    if (!lancIds.has(p.Lancamento_ID)) continue;
    const lancId = idLancamentoAntigo(p.Lancamento_ID);
    const numero = Number(p['Nº Parcela']);
    const mes = (dataAntiga(p['Mês Vencimento']) ?? '').slice(0, 7);
    if (!mes) avisos.push(`Parcela ${numero} de um lançamento veio sem mês de vencimento.`);
    parcelas.push({
      ...base(idParcela(lancId, numero)),
      lancamento_id: lancId,
      numero,
      mes_vencimento: mes,
      valor: arred(Number(p.Valor)),
      status: p.Status === 'Pago' ? 'Pago' : 'Aberto',
      data_pagamento: p.Status === 'Pago' ? dataAntiga(p['Data Pagamento']) : null,
    });
  }

  const gastos_rotineiros: GastoRotineiro[] = a.gastos.map((g) => ({
    ...base(idGastoAntigo(g.ID)),
    data: dataAntiga(g.Data) ?? carimbo.slice(0, 10),
    categoria_id: idCategoriaAntiga(g.Categoria_ID),
    meio_pagamento_id: idMeioAntigo(g.MeioPagamento_ID),
    pessoa_id: idPessoaAntiga(g.Pessoa_ID),
    descricao: String(g['Descrição'] ?? '').trim(),
    valor: arred(Number(g.Valor)),
  }));

  return { categorias, meios_pagamento, pessoas, lancamentos, rateios, parcelas, gastos_rotineiros, avisos };
}
