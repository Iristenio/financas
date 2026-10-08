import { describe, expect, it } from 'vitest';
import { filtrarParcelas, montarPainel, mesesDaJanela, type FiltroPainel } from './painel';
import { agruparPorLancamento, gerarConta, type DadosConta } from './lancamentos';

const dados = (campos: Partial<DadosConta>): DadosConta => ({
  data: '2026-08-01',
  categoria_id: 'casa',
  meio_pagamento_id: 'nubank',
  descricao: 'x',
  observacao: '',
  recorrente: false,
  valorTotal: 0,
  qtdParcelas: 1,
  mesParcelaAtual: '2026-08',
  numeroParcelaAtual: 1,
  rateio: [],
  ...campos,
});

// TV: 3 × 100 (ago, set, out), metade Iristenio, metade Paulo; agosto pago em 10/08
const tv = gerarConta('tv', dados({ descricao: 'TV', valorTotal: 300, qtdParcelas: 3, rateio: [{ pessoa_id: 'iris', valorParcela: 50 }, { pessoa_id: 'paulo', valorParcela: 50 }] }));
tv.parcelas[0] = { ...tv.parcelas[0], status: 'Pago', data_pagamento: '2026-08-10' };
// Energia: recorrente, 1 × 80 em setembro, só Iristenio, no débito
const energia = gerarConta('energia', dados({ descricao: 'Energia', recorrente: true, meio_pagamento_id: 'debito', valorTotal: 80, mesParcelaAtual: '2026-09', rateio: [{ pessoa_id: 'iris', valorParcela: 80 }] }));

const lancs = new Map([tv, energia].map((c) => [c.lancamento.id, c.lancamento]));
const parcelas = [...tv.parcelas, ...energia.parcelas];
const rateios = agruparPorLancamento([...tv.rateios, ...energia.rateios]);
const f = (campos: Partial<FiltroPainel> = {}): FiltroPainel => ({ pessoa_id: '', meio_pagamento_id: '', categoria_id: '', recorrentes: 'incluir', ...campos });
const painel = (campos: Partial<FiltroPainel> = {}) => montarPainel(filtrarParcelas(lancs, parcelas, rateios, f(campos)), '2026-09');
const mes = (r: ReturnType<typeof painel>, m: string) => r.meses.find((x) => x.mes === m)!;

describe('painel das dívidas', () => {
  it('janela de 24 meses: 12 antes, o atual e 11 depois', () => {
    const j = mesesDaJanela('2026-09');
    expect([j.length, j[0], j[12], j[23]]).toEqual([24, '2025-09', '2026-09', '2027-08']);
  });

  it('valor devido por mês, separando pago e aberto', () => {
    const r = painel();
    expect(mes(r, '2026-08')).toMatchObject({ pago: 100, aberto: 0 });
    expect(mes(r, '2026-09')).toMatchObject({ pago: 0, aberto: 180 });
    expect(mes(r, '2026-10')).toMatchObject({ pago: 0, aberto: 100 });
  });

  it('saldo devedor no fim de cada mês', () => {
    const r = painel();
    expect(mes(r, '2026-07').saldo).toBe(0); // a TV ainda não existia
    expect(mes(r, '2026-08').saldo).toBe(200 + 80); // a energia vence em setembro, mas a conta já existia em agosto
    expect(mes(r, '2026-09').saldo).toBe(100); // set (TV e energia) sai no próprio mês; falta outubro
    expect(mes(r, '2026-10').saldo).toBe(0);
    expect(r.saldoHoje).toBe(280);
  });

  it('filtro de pessoa usa só a parte dela; recorrentes podem ser excluídas', () => {
    expect(mes(painel({ pessoa_id: 'paulo' }), '2026-09').aberto).toBe(50);
    expect(mes(painel({ pessoa_id: 'iris' }), '2026-09').aberto).toBe(130);
    expect(mes(painel({ recorrentes: 'excluir' }), '2026-09').aberto).toBe(100);
    expect(mes(painel({ meio_pagamento_id: 'debito' }), '2026-09').aberto).toBe(80);
  });

  it('quando cada dívida acaba (recorrentes não entram)', () => {
    const r = painel();
    expect(r.fins.map((x) => [x.lancamento.descricao, x.mes, x.alivio])).toEqual([['TV', '2026-10', 100]]);
  });
});
