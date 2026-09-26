import { describe, expect, it } from 'vitest';
import { monitorar, type FiltroMonitor } from './monitoramento';
import { agruparPorLancamento, gerarConta, type DadosConta } from './lancamentos';

const dados = (campos: Partial<DadosConta>): DadosConta => ({
  data: '2026-09-01',
  categoria_id: 'terceiros',
  meio_pagamento_id: 'inter',
  descricao: 'x',
  observacao: '',
  recorrente: false,
  valorTotal: 0,
  qtdParcelas: 1,
  mesParcelaAtual: '2026-09',
  numeroParcelaAtual: 1,
  rateio: [],
  ...campos,
});

// Fogão da Malurde (100%) e compra dividida Iristenio/Paulo no Nubank
const fogao = gerarConta('fogao', dados({ descricao: 'Fogão', valorTotal: 322.64, qtdParcelas: 2, rateio: [{ pessoa_id: 'malurde', valorParcela: 161.32 }] }));
const tv = gerarConta('tv', dados({ descricao: 'TV', meio_pagamento_id: 'nubank', categoria_id: 'casa', valorTotal: 300, qtdParcelas: 3, rateio: [{ pessoa_id: 'iris', valorParcela: 50 }, { pessoa_id: 'paulo', valorParcela: 50 }] }));

const lancs = new Map([fogao, tv].map((c) => [c.lancamento.id, c.lancamento]));
const parcelas = [...fogao.parcelas, ...tv.parcelas];
const rateios = agruparPorLancamento([...fogao.rateios, ...tv.rateios]);
const f = (campos: Partial<FiltroMonitor>): FiltroMonitor => ({ mes: '', categoria_id: '', meio_pagamento_id: '', pessoa_id: '', status: 'Aberto', ...campos });

describe('monitoramento (R15)', () => {
  it('quanto a Malurde deve em setembro', () => {
    const r = monitorar(lancs, parcelas, rateios, f({ pessoa_id: 'malurde', mes: '2026-09' }));
    expect(r.porPessoa).toEqual([{ pessoa_id: 'malurde', total: 161.32 }]);
    expect(r.linhas).toHaveLength(1);
  });

  it('quanto se deve no Nubank no geral, dividido por pessoa', () => {
    const r = monitorar(lancs, parcelas, rateios, f({ meio_pagamento_id: 'nubank' }));
    expect(r.total).toBe(300);
    expect(r.porPessoa.map((p) => p.total)).toEqual([150, 150]);
    expect(r.porMeio).toEqual([{ id: 'nubank', total: 300 }]);
  });

  it('status: pagas não entram no padrão "Aberto"', () => {
    const pagas = parcelas.map((p) => (p.id === 'tv-p1' ? { ...p, status: 'Pago' as const } : p));
    expect(monitorar(lancs, pagas, rateios, f({ meio_pagamento_id: 'nubank' })).total).toBe(200);
    expect(monitorar(lancs, pagas, rateios, f({ meio_pagamento_id: 'nubank', status: 'Todos' })).total).toBe(300);
  });

  it('resumos ordenados do maior para o menor', () => {
    const r = monitorar(lancs, parcelas, rateios, f({}));
    expect(r.porCategoria.map((c) => c.id)).toEqual(['terceiros', 'casa']);
  });
});
