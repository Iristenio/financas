import { describe, expect, it } from 'vitest';
import {
  ajustarValor,
  anteciparParcelas,
  contasParaRenovar,
  contemTexto,
  editarConta,
  excluirConta,
  filtrarContas,
  gerarConta,
  pagarParcelas,
  parcelasPorLancamento,
  agruparPorLancamento,
  renovarConta,
  resumirConta,
  validarConta,
  type DadosConta,
} from './lancamentos';
import { novoMeio } from './cadastros';
import { somar } from './dinheiro';

const meios = [novoMeio('nubank', { nome: 'Nubank', tipo: 'Cartão de Crédito' }), novoMeio('pix', { nome: 'Pix', tipo: 'Pronto Pagamento' })];

const dados = (campos: Partial<DadosConta> = {}): DadosConta => ({
  data: '2026-09-01',
  categoria_id: 'cat',
  meio_pagamento_id: 'nubank',
  descricao: 'Geladeira',
  observacao: '',
  recorrente: false,
  valorTotal: 1200,
  qtdParcelas: 12,
  mesParcelaAtual: '2026-09',
  numeroParcelaAtual: 1,
  rateio: [{ pessoa_id: 'iris', valorParcela: 100 }],
  ...campos,
});

describe('criar conta (R1–R5)', () => {
  it('R1 — pronto pagamento não entra em Lançamentos', () => {
    expect(validarConta(dados({ meio_pagamento_id: 'pix' }), meios).join()).toContain('Gastos');
    expect(validarConta(dados(), meios)).toEqual([]);
  });

  it('R2/R3 — parcela atual 9 em set/2026: a 1ª vence em jan/2026 e as 8 primeiras nascem pagas sem data', () => {
    const { parcelas } = gerarConta('c', dados({ numeroParcelaAtual: 9 }));
    expect(parcelas[0].mes_vencimento).toBe('2026-01');
    expect(parcelas[8]).toMatchObject({ numero: 9, mes_vencimento: '2026-09', status: 'Aberto' });
    expect(parcelas.filter((p) => p.status === 'Pago')).toHaveLength(8);
    expect(parcelas[0].data_pagamento).toBeNull();
    expect(parcelas[11].mes_vencimento).toBe('2026-12');
  });

  it('R4 — financiamento de 60x: soma das parcelas é o valor total', () => {
    const { parcelas } = gerarConta('car', dados({ valorTotal: 77815.8, qtdParcelas: 60, rateio: [{ pessoa_id: 'iris', valorParcela: 1296.93 }] }));
    expect(parcelas).toHaveLength(60);
    expect(somar(parcelas.map((p) => p.valor))).toBe(77815.8);
    expect(parcelas[59].mes_vencimento).toBe('2031-08');
  });

  it('D2 — ids previsíveis de parcelas e rateios', () => {
    const { parcelas, rateios } = gerarConta('abc', dados({ qtdParcelas: 2, valorTotal: 200 }));
    expect(parcelas.map((p) => p.id)).toEqual(['abc-p1', 'abc-p2']);
    expect(rateios[0].id).toBe('abc-iris');
  });

  it('R5 — rateio em percentual; soma precisa bater (tolerância de 1 centavo por parcela)', () => {
    const d = dados({ valorTotal: 2158.8, qtdParcelas: 12, rateio: [{ pessoa_id: 'iris', valorParcela: 120 }, { pessoa_id: 'paulo', valorParcela: 59.9 }] });
    expect(validarConta(d, meios)).toEqual([]);
    const { rateios } = gerarConta('c', d);
    expect(rateios[0].percentual).toBeCloseTo(120 / 179.9, 6);
    expect(rateios[0].percentual + rateios[1].percentual).toBeCloseTo(1, 9);
    expect(validarConta({ ...d, rateio: [{ pessoa_id: 'iris', valorParcela: 170 }] }, meios).join()).toContain('não bate');
    expect(validarConta({ ...d, rateio: [{ pessoa_id: 'iris', valorParcela: 100 }, { pessoa_id: 'iris', valorParcela: 79.9 }] }, meios).join()).toContain('duas vezes');
  });
});

describe('resumo (R13, R14)', () => {
  it('saldo, pago, próxima parcela e parte de cada pessoa', () => {
    const d = dados({ valorTotal: 300, qtdParcelas: 3, numeroParcelaAtual: 2, rateio: [{ pessoa_id: 'iris', valorParcela: 50 }, { pessoa_id: 'malurde', valorParcela: 50 }] });
    const { parcelas, rateios } = gerarConta('c', d);
    const r = resumirConta(parcelas, rateios);
    expect(r).toMatchObject({ valorTotal: 300, pagas: 1, valorPago: 100, saldoDevedor: 200, qtdParcelas: 3 });
    expect(r.proxima?.numero).toBe(2);
    expect(r.porPessoa.map((p) => p.saldo)).toEqual([100, 100]);
  });

  it('parcelas excluídas não contam', () => {
    const { parcelas, rateios } = gerarConta('c', dados({ valorTotal: 300, qtdParcelas: 3 }));
    parcelas[2] = { ...parcelas[2], excluido: true };
    expect(resumirConta(parcelas, rateios).valorTotal).toBe(200);
  });
});

describe('filtros da lista', () => {
  it('por título, mês com parcela e pessoa do rateio', () => {
    const a = gerarConta('a', dados({ descricao: 'Fogão', qtdParcelas: 2, valorTotal: 200, rateio: [{ pessoa_id: 'malurde', valorParcela: 100 }] }));
    const b = gerarConta('b', dados({ descricao: 'Sofá', qtdParcelas: 1, valorTotal: 100, rateio: [{ pessoa_id: 'iris', valorParcela: 100 }] }));
    const parc = parcelasPorLancamento([...a.parcelas, ...b.parcelas]);
    const rat = agruparPorLancamento([...a.rateios, ...b.rateios]);
    const todos = [a.lancamento, b.lancamento];
    const vazio = { titulo: '', mes: '', categoria_id: '', meio_pagamento_id: '', pessoa_id: '' };
    expect(filtrarContas(todos, parc, rat, { ...vazio, titulo: 'fog' }).map((l) => l.id)).toEqual(['a']);
    expect(contemTexto('Exames mãe', ' MAE ')).toBe(true);
    expect(contemTexto('Exames mãe', 'pai')).toBe(false);
    expect(contemTexto('Qualquer', '')).toBe(true);
    expect(filtrarContas(todos, parc, rat, { ...vazio, mes: '2026-10' }).map((l) => l.id)).toEqual(['a']);
    expect(filtrarContas(todos, parc, rat, { ...vazio, pessoa_id: 'iris' }).map((l) => l.id)).toEqual(['b']);
  });
});

describe('editar (R6)', () => {
  it('troca o rateio: quem saiu fica excluído, percentuais recalculados', () => {
    const { lancamento, rateios } = gerarConta('c', dados({ valorTotal: 200, qtdParcelas: 2, rateio: [{ pessoa_id: 'iris', valorParcela: 50 }, { pessoa_id: 'paulo', valorParcela: 50 }] }));
    const r = editarConta(lancamento, rateios, { categoria_id: 'x', meio_pagamento_id: 'nubank', descricao: ' Nova ', observacao: '', rateio: [{ pessoa_id: 'iris', valorParcela: 100 }] }, 2);
    expect(r.lancamento).toMatchObject({ descricao: 'Nova', categoria_id: 'x' });
    expect(r.rateios.find((x) => x.pessoa_id === 'iris')).toMatchObject({ percentual: 1, excluido: false });
    expect(r.rateios.find((x) => x.pessoa_id === 'paulo')?.excluido).toBe(true);
  });
});

describe('pagar, ajustar, antecipar (R7, R8, R10)', () => {
  const base = () => gerarConta('c', dados({ valorTotal: 600, qtdParcelas: 6, numeroParcelaAtual: 3 })).parcelas; // 1–2 pagas

  it('R10 — paga só as abertas, com a data informada', () => {
    const r = pagarParcelas(base().slice(0, 4), '2026-09-10');
    expect(r.map((p) => p.numero)).toEqual([3, 4]);
    expect(r[0]).toMatchObject({ status: 'Pago', data_pagamento: '2026-09-10' });
  });

  it('R7 — ajustar: só esta, esta e as seguintes (abertas), todas (inclusive pagas)', () => {
    expect(ajustarValor(base(), 4, 120, 'apenasEsta').map((p) => p.numero)).toEqual([4]);
    expect(ajustarValor(base(), 4, 120, 'emDiante').map((p) => p.numero)).toEqual([4, 5, 6]);
    expect(ajustarValor(base(), 4, 120, 'emDiante')[0].valor).toBe(120);
    expect(ajustarValor(base(), 0, 120, 'todas')).toHaveLength(6);
  });

  it('R8 — antecipar comprimindo: restantes vencem nos meses seguintes ao pagamento', () => {
    const p = base(); // 3 = set/2026 … 6 = dez/2026
    const r = anteciparParcelas(p, [p[5].id], '2026-09-20', 'comprimir'); // antecipa a 6
    const porNumero = Object.fromEntries(r.map((x) => [x.numero, x]));
    expect(porNumero[6]).toMatchObject({ status: 'Pago', data_pagamento: '2026-09-20' });
    expect([porNumero[3].mes_vencimento, porNumero[4].mes_vencimento, porNumero[5].mes_vencimento]).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(anteciparParcelas(p, [p[5].id], '2026-09-20', 'manter')).toHaveLength(1);
  });
});

describe('excluir (R9)', () => {
  it('só as abertas preserva as pagas; sem pagas, exclui a conta inteira', () => {
    const c = gerarConta('c', dados({ valorTotal: 300, qtdParcelas: 3, numeroParcelaAtual: 2 }));
    const r = excluirConta(c.lancamento, c.parcelas, c.rateios, 'abertas');
    expect(r.lancamento).toBeNull();
    expect(r.parcelas.map((p) => p.numero)).toEqual([2, 3]);

    const semPagas = gerarConta('d', dados({ valorTotal: 300, qtdParcelas: 3 }));
    const r2 = excluirConta(semPagas.lancamento, semPagas.parcelas, semPagas.rateios, 'abertas');
    expect(r2.lancamento?.excluido).toBe(true);
    expect(r2.rateios.every((x) => x.excluido)).toBe(true);

    const tudo = excluirConta(c.lancamento, c.parcelas, c.rateios, 'tudo');
    expect(tudo.parcelas).toHaveLength(3);
  });
});

describe('recorrentes (R11, R12)', () => {
  it('aparece com 2 ou menos abertas; renovar continua numeração, meses e valor', () => {
    const c = gerarConta('net', dados({ recorrente: true, valorTotal: 297, qtdParcelas: 3, numeroParcelaAtual: 2, mesParcelaAtual: '2026-09' }));
    const mapa = parcelasPorLancamento(c.parcelas);
    expect(contasParaRenovar([c.lancamento], mapa)).toHaveLength(1);
    const novas = renovarConta('net', c.parcelas, 12);
    expect(novas).toHaveLength(12);
    expect(novas[0]).toMatchObject({ id: 'net-p4', numero: 4, mes_vencimento: '2026-11', valor: 99, status: 'Aberto' });
    const depois = parcelasPorLancamento([...c.parcelas, ...novas]);
    expect(contasParaRenovar([c.lancamento], depois)).toHaveLength(0);
  });
});
