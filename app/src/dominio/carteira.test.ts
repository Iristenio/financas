import { describe, expect, it } from 'vitest';
import { iniciarCarteira, movimentosDaCarteira, novaEntrada, resumirCarteira, type BaseCarteira } from './carteira';
import { novoGasto, validarGasto, gastosDoMes } from './gastos';
import { gerarConta, pagarParcelas, type DadosConta } from './lancamentos';
import { novaPessoa, novoMeio } from './cadastros';

const conta = gerarConta('tv', {
  data: '2026-08-01',
  categoria_id: 'c',
  meio_pagamento_id: 'nubank',
  descricao: 'TV',
  observacao: '',
  recorrente: false,
  valorTotal: 300,
  qtdParcelas: 3,
  mesParcelaAtual: '2026-09',
  numeroParcelaAtual: 2, // parcela 1 nasce paga SEM data (retroativa)
  rateio: [{ pessoa_id: 'iris', valorParcela: 100 }],
} as DadosConta);

describe('carteira (C1–C5)', () => {
  const inicio = iniciarCarteira('2026-09-01', 1000, []);

  it('C1/C3 — início cria as fontes padrão e o saldo inicial', () => {
    expect(inicio.fontes.map((f) => f.nome)).toContain('Recebido de terceiros');
    expect(inicio.entrada).toMatchObject({ valor: 1000, data: '2026-09-01' });
    expect(iniciarCarteira('2026-09-01', 0, inicio.fontes).fontes).toHaveLength(0); // não duplica
  });

  it('C4/C5 — parcelas pagas (valor inteiro) e gastos saem; retroativas sem data e antes do início não contam', () => {
    const pagas = pagarParcelas([conta.parcelas[1]], '2026-09-10'); // parcela 2 paga em 10/09
    const parcelas = conta.parcelas.map((p) => pagas.find((x) => x.id === p.id) ?? p);
    const b: BaseCarteira = {
      config: inicio.config,
      entradas: [inicio.entrada, novaEntrada('e1', { data: '2026-09-05', fonte_id: 'fonte-salario', valor: 500 }), novaEntrada('velha', { data: '2026-08-30', fonte_id: 'fonte-salario', valor: 999 })],
      gastos: [novoGasto('g1', { data: '2026-09-12', categoria_id: 'mercado', valor: 50.5 }), novoGasto('g0', { data: '2026-08-31', valor: 80 })],
      parcelas,
      lancamentos: new Map([[conta.lancamento.id, conta.lancamento]]),
    };
    const movs = movimentosDaCarteira(b);
    expect(movs.map((m) => m.id).sort()).toEqual(['e1', 'entrada-saldo-inicial', 'g1', 'tv-p2']);
    const r = resumirCarteira(movs, '2026-09');
    expect(r.saldo).toBe(1000 + 500 - 100 - 50.5);
    expect(r.entradasMes).toBe(1500);
    expect(r.saidasMes).toBe(150.5);
    expect(r.porFonteMes[0]).toEqual({ id: 'fonte-saldo-inicial', total: 1000 });
  });

  it('sem data de início, a carteira está vazia', () => {
    expect(movimentosDaCarteira({ config: undefined, entradas: [], gastos: [], parcelas: [], lancamentos: new Map() })).toEqual([]);
  });
});

describe('gastos do dia a dia', () => {
  const meios = [novoMeio('pix', { nome: 'Pix', tipo: 'Pronto Pagamento' }), novoMeio('nu', { nome: 'Nubank', tipo: 'Cartão de Crédito' })];
  const pessoas = [novaPessoa('iris', { nome: 'Iristenio' }), novaPessoa('mal', { nome: 'Malurde', tipo: 'Terceiro Devedor', papel: null })];
  const g = novoGasto('g', { data: '2026-09-01', categoria_id: 'c', meio_pagamento_id: 'pix', pessoa_id: 'iris', valor: 10 });

  it('só pronto pagamento e só quem mora na casa', () => {
    expect(validarGasto(g, meios, pessoas)).toEqual([]);
    expect(validarGasto({ ...g, meio_pagamento_id: 'nu' }, meios, pessoas).join()).toContain('Lançamentos');
    expect(validarGasto({ ...g, pessoa_id: 'mal' }, meios, pessoas).join()).toContain('mora na casa');
  });

  it('gastos do mês, do mais recente para o mais antigo, sem excluídos', () => {
    const lista = [g, { ...g, id: 'h', data: '2026-09-20' }, { ...g, id: 'x', data: '2026-09-25', excluido: true }, { ...g, id: 'y', data: '2026-10-01' }];
    expect(gastosDoMes(lista, '2026-09').map((x) => x.id)).toEqual(['h', 'g']);
  });
});
