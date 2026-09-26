import { describe, expect, it } from 'vitest';
import { distribuirPorPercentual, dividirEmParcelas, formatarMoeda, lerValor, somar } from './dinheiro';
import { diferencaMeses, formatarMesCurto, somarMeses } from './meses';

describe('dinheiro', () => {
  it('R4 — centavos que sobram vão para a última parcela', () => {
    expect(dividirEmParcelas(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(somar(dividirEmParcelas(1935.84, 12))).toBe(1935.84);
  });
  it('distribui por percentual sem perder centavos', () => {
    const partes = distribuirPorPercentual(100, [1 / 3, 1 / 3, 1 / 3]);
    expect(somar(partes)).toBe(100);
  });
  it('soma sem erro de ponto flutuante', () => {
    expect(somar([0.1, 0.2])).toBe(0.3);
  });
  it('lê valores digitados em português', () => {
    expect(lerValor('1.234,56')).toBe(1234.56);
    expect(lerValor('12,5')).toBe(12.5);
    expect(lerValor('99.90')).toBe(99.9);
    expect(lerValor('abc')).toBeNull();
    expect(lerValor('')).toBeNull();
  });
  it('formata em reais', () => {
    expect(formatarMoeda(1234.5)).toBe('R$ 1.234,50');
  });
});

describe('meses', () => {
  it('soma e subtrai atravessando o ano', () => {
    expect(somarMeses('2026-11', 3)).toBe('2027-02');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(diferencaMeses('2026-09', '2031-08')).toBe(59);
  });
  it('formato curto', () => {
    expect(formatarMesCurto('2026-09')).toBe('set/2026');
  });
});
