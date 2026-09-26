// Ações genéricas: gravam localmente e devolvem a função "Desfazer".
import type { Entidade } from '../../dominio/tipos';
import { gravar, type Alteracao, type MapaEntidades } from '../../dados/repositorio';

export type Desfazer = () => Promise<void>;

/**
 * Grava vários registros de uma vez (uma transação). "Desfazer" devolve cada um à versão anterior;
 * os que não existiam antes ficam marcados como excluídos.
 */
export async function gravarComDesfazer(alteracoes: Alteracao[]): Promise<Desfazer> {
  const anteriores = await gravar(alteracoes);
  return async () => {
    await gravar(
      alteracoes.map((a, i) => {
        const anterior = anteriores[i];
        const registro = anterior ?? { ...a.registro, excluido: true };
        return { entidade: a.entidade, registro, operacao: anterior ? undefined : 'excluir' } as Alteracao;
      }),
    );
  };
}

export function salvarRegistro<E extends Entidade>(entidade: E, registro: MapaEntidades[E]): Promise<Desfazer> {
  return gravarComDesfazer([{ entidade, registro } as Alteracao]);
}

/** Exclusão lógica: o registro continua salvo, com excluido = true. */
export function excluirRegistro<E extends Entidade>(entidade: E, registro: MapaEntidades[E]): Promise<Desfazer> {
  return gravarComDesfazer([{ entidade, registro: { ...registro, excluido: true }, operacao: 'excluir' } as Alteracao]);
}
