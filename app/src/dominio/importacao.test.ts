import { describe, expect, it } from 'vitest';
import { converterDadosAntigos, dataAntiga, type DadosAntigos } from './importacao';
import { resumirConta } from './lancamentos';

// Amostra no formato real da API antiga (valores de exemplo)
const antigo: DadosAntigos = {
  categorias: [{ id: 3, nome: 'Moradia', ativo: true }],
  meios: [{ id: 13, nome: 'Pagbank', tipo: 'Cartão de Crédito', diaFechamento: '', diaVencimento: 10, ativo: true }],
  pessoas: [
    { id: 1, nome: 'Iristenio', tipo: 'Membro do Domicílio', papel: 'Admin', ativo: true },
    { id: 5, nome: 'Malurde', tipo: 'Terceiro Devedor', papel: '', ativo: true },
  ],
  lancamentos: [{ id: 43, data: '2026-09-02T03:00:00.000Z', categoriaId: 3, meioPagamentoId: 13, descricao: 'Exames mãe, SIM', observacao: '', recorrente: false }],
  parcelas: [
    { ID: 1, Lancamento_ID: 43, 'Nº Parcela': 1, 'Mês Vencimento': '2026-06-01T03:00:00.000Z', Valor: 168.66, Status: 'Pago', 'Data Pagamento': '' },
    { ID: 2, Lancamento_ID: 43, 'Nº Parcela': 2, 'Mês Vencimento': '2026-07-01T03:00:00.000Z', Valor: 168.66, Status: 'Pago', 'Data Pagamento': '2026-09-26T03:00:00.000Z' },
    { ID: 3, Lancamento_ID: 43, 'Nº Parcela': 3, 'Mês Vencimento': '2026-08-01T03:00:00.000Z', Valor: 168.66, Status: 'Aberto', 'Data Pagamento': '' },
    { ID: 9, Lancamento_ID: 99, 'Nº Parcela': 1, 'Mês Vencimento': '2026-08-01T03:00:00.000Z', Valor: 10, Status: 'Aberto', 'Data Pagamento': '' },
  ],
  rateios: { 43: [{ pessoaId: 1, percentual: 0.667 }, { pessoaId: 5, percentual: 0.333 }] },
  gastos: [{ ID: 7, Data: '2026-09-01T03:00:00.000Z', Categoria_ID: 3, MeioPagamento_ID: 13, Pessoa_ID: 1, 'Descrição': 'Mercado', Valor: 50.5 }],
};

describe('importação do app antigo', () => {
  it('datas da planilha (meia-noite de Brasília) viram AAAA-MM-DD', () => {
    expect(dataAntiga('2026-09-02T03:00:00.000Z')).toBe('2026-09-02');
    expect(dataAntiga('')).toBeNull();
  });

  it('converte com IDs previsíveis e mantém as ligações', () => {
    const c = converterDadosAntigos(antigo);
    expect(c.lancamentos[0]).toMatchObject({ id: 'lanc-43', categoria_id: 'cat-3', meio_pagamento_id: 'meio-13', data: '2026-09-02' });
    expect(c.parcelas.map((p) => p.id)).toEqual(['lanc-43-p1', 'lanc-43-p2', 'lanc-43-p3']); // parcela de lançamento inexistente é ignorada
    expect(c.parcelas.map((p) => p.mes_vencimento)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(c.parcelas[0].data_pagamento).toBeNull();
    expect(c.parcelas[1].data_pagamento).toBe('2026-09-26');
    expect(c.rateios.map((r) => r.id)).toEqual(['lanc-43-pes-1', 'lanc-43-pes-5']);
    expect(c.pessoas.find((p) => p.nome === 'Malurde')?.papel).toBeNull();
    expect(c.meios_pagamento[0]).toMatchObject({ dia_fechamento: null, dia_vencimento: 10 });
    expect(c.gastos_rotineiros[0]).toMatchObject({ id: 'gasto-7', pessoa_id: 'pes-1', valor: 50.5 });
  });

  it('percentuais somam 1 e o saldo por pessoa bate com o total', () => {
    const c = converterDadosAntigos(antigo);
    expect(c.rateios.reduce((s, r) => s + r.percentual, 0)).toBeCloseTo(1, 9);
    const r = resumirConta(c.parcelas, c.rateios);
    expect(r.saldoDevedor).toBe(168.66);
    expect(r.porPessoa.reduce((s, p) => s + p.saldo, 0)).toBeCloseTo(168.66, 2);
  });

  it('importar de novo gera os mesmos IDs (substitui em vez de duplicar)', () => {
    const a = converterDadosAntigos(antigo);
    const b = converterDadosAntigos(antigo, new Date('2030-01-01'));
    expect(b.parcelas.map((p) => p.id)).toEqual(a.parcelas.map((p) => p.id));
  });
});
