// Meses no formato "AAAA-MM" (vencimento de parcelas, filtros).

export const NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function mesDe(data: Date | string): string {
  if (typeof data === 'string') return data.slice(0, 7);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

export const mesAtual = (agora = new Date()) => mesDe(agora);

export function somarMeses(mes: string, qtd: number): string {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + qtd;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Diferença em meses (b − a). */
export function diferencaMeses(a: string, b: string): number {
  const [aa, am] = a.split('-').map(Number);
  const [ba, bm] = b.split('-').map(Number);
  return ba * 12 + bm - (aa * 12 + am);
}

/** "2026-09" → "set/2026" */
export function formatarMesCurto(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return `${CURTOS[m - 1]}/${a}`;
}

/** "2026-09" → "Setembro de 2026" */
export function formatarMesLongo(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return `${NOMES_MESES[m - 1]} de ${a}`;
}

/** "2026-09-15" → "15/09/2026" */
export function formatarData(data: string | null): string {
  if (!data) return '(data não registrada)';
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}
