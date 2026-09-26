// Importação dos dados do app antigo (projetoFinancas) — SOMENTE LEITURA do app antigo.
// Usa a API atual dele (GET) com o token do Admin; nada é alterado lá.
import { converterDadosAntigos, type DadosAntigos, type RateioAntigo } from '../../dominio/importacao';
import type { Entidade } from '../../dominio/tipos';
import { gravar, limparEntidades, type Alteracao } from '../../dados/repositorio';

/** Endereço da API do app antigo (implantação de produção). */
export const URL_APP_ANTIGO = 'https://script.google.com/macros/s/AKfycbwB3fd12EsBaAnI7d3YYJt79xNrM24dwqg35jL4SnxEnDhmwQudj7B36b5qh5xYU6XP/exec';

/** Entidades trazidas do app antigo (a Carteira só existe no app novo e não é tocada). */
export const ENTIDADES_IMPORTADAS: readonly Entidade[] = ['categorias', 'meios_pagamento', 'pessoas', 'lancamentos', 'rateios', 'parcelas', 'gastos_rotineiros'];

async function lerApi<T>(token: string, recurso: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams({ token, recurso, ...params });
  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const r = await fetch(`${URL_APP_ANTIGO}?${q}`, { credentials: 'omit' });
      const json = await r.json();
      if (!json.ok) throw new Error(json.erro || 'erro no app antigo');
      return json.dados as T;
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e);
      if (/token|acesso/i.test(ultimoErro)) break;
      await new Promise((ok) => setTimeout(ok, 1200 * tentativa));
    }
  }
  throw new Error(ultimoErro);
}

export type Progresso = (texto: string, fracao: number) => void;

/** Baixa tudo do app antigo. O rateio vem do detalhe de cada lançamento (várias chamadas). */
export async function baixarDadosAntigos(token: string, progresso: Progresso): Promise<DadosAntigos> {
  progresso('Conferindo o token…', 0);
  const eu = await lerApi<{ papel: string }>(token, 'quem-sou-eu');
  if (eu.papel !== 'Admin') throw new Error('Use o token do Admin do app antigo.');

  progresso('Baixando cadastros…', 0.05);
  const [categorias, meios, pessoas] = await Promise.all([
    lerApi<DadosAntigos['categorias']>(token, 'categorias-cadastro'),
    lerApi<DadosAntigos['meios']>(token, 'meios-pagamento-cadastro'),
    lerApi<DadosAntigos['pessoas']>(token, 'pessoas-cadastro'),
  ]);
  progresso('Baixando lançamentos, parcelas e gastos…', 0.15);
  const [lancamentos, parcelas, gastos] = await Promise.all([
    lerApi<DadosAntigos['lancamentos']>(token, 'lancamentos'),
    lerApi<DadosAntigos['parcelas']>(token, 'parcelas'),
    lerApi<DadosAntigos['gastos']>(token, 'gastos-rotineiros'),
  ]);

  const rateios: Record<number, RateioAntigo[]> = {};
  let feitos = 0;
  const fila = [...lancamentos];
  const trabalhador = async () => {
    for (let l = fila.shift(); l; l = fila.shift()) {
      const det = await lerApi<{ rateio: RateioAntigo[] }>(token, 'lancamentos', { id: String(l.id) });
      rateios[l.id] = det.rateio.map((r) => ({ pessoaId: r.pessoaId, percentual: r.percentual }));
      feitos++;
      progresso(`Baixando rateios (${feitos} de ${lancamentos.length})…`, 0.2 + 0.7 * (feitos / lancamentos.length));
    }
  };
  await Promise.all(Array.from({ length: 5 }, trabalhador));

  return { categorias, meios, pessoas, lancamentos, parcelas, rateios, gastos };
}

export interface ResultadoImportacao {
  contagens: Record<string, number>;
  avisos: string[];
}

/** Substitui neste aparelho as entidades importadas pelos dados do app antigo. */
export async function importarDoAppAntigo(token: string, progresso: Progresso): Promise<ResultadoImportacao> {
  const antigos = await baixarDadosAntigos(token.trim(), progresso);
  progresso('Gravando neste aparelho…', 0.93);
  const c = converterDadosAntigos(antigos);
  await limparEntidades(ENTIDADES_IMPORTADAS);
  const contagens: Record<string, number> = {};
  for (const entidade of ENTIDADES_IMPORTADAS) {
    const registros = c[entidade as keyof typeof c] as unknown[];
    contagens[entidade] = registros.length;
    await gravar(registros.map((registro) => ({ entidade, registro }) as Alteracao));
  }
  progresso('Pronto', 1);
  return { contagens, avisos: c.avisos };
}
