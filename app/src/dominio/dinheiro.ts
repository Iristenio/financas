// Valores em reais. As contas são feitas em centavos inteiros para não acumular erros de arredondamento.

export const paraCentavos = (valor: number) => Math.round(valor * 100);
export const deCentavos = (centavos: number) => centavos / 100;

/** Arredonda para 2 casas. */
export const arred = (valor: number) => deCentavos(paraCentavos(valor));

export function somar(valores: number[]): number {
  return deCentavos(valores.reduce((s, v) => s + paraCentavos(v), 0));
}

/** Divide um total em N parcelas iguais; os centavos que sobram vão para a ÚLTIMA (R4). */
export function dividirEmParcelas(total: number, qtd: number): number[] {
  const centavos = paraCentavos(total);
  const base = Math.floor(centavos / qtd);
  const valores = Array.from({ length: qtd }, () => base);
  valores[qtd - 1] += centavos - base * qtd;
  return valores.map(deCentavos);
}

/** Reparte um valor pelos percentuais; a diferença de arredondamento fica com o último. */
export function distribuirPorPercentual(total: number, percentuais: number[]): number[] {
  if (!percentuais.length) return [];
  const centavos = paraCentavos(total);
  const partes = percentuais.map((p) => Math.round(centavos * p));
  const soma = partes.reduce((s, v) => s + v, 0);
  partes[partes.length - 1] += centavos - soma;
  return partes.map(deCentavos);
}

/** Iguais dentro de uma tolerância em reais. */
export const quaseIgual = (a: number, b: number, tolerancia = 0.005) => Math.abs(a - b) <= tolerancia + 1e-9;

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNumero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "R$ 1.234,56" */
export const formatarMoeda = (valor: number) => fmtMoeda.format(valor).replace(/ /g, ' ');
/** "1.234,56" (sem R$) */
export const formatarNumero = (valor: number) => fmtNumero.format(valor);

/** Texto digitado ("1.234,56", "1234.56", "12,5") → número, ou null se inválido. */
export function lerValor(texto: string): number | null {
  const limpo = texto.trim().replace(/\s|R\$/g, '');
  if (!limpo) return null;
  let normalizado = limpo;
  if (limpo.includes(',')) normalizado = limpo.replace(/\./g, '').replace(',', '.');
  const n = Number(normalizado);
  return Number.isFinite(n) ? arred(n) : null;
}
