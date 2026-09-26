// Quem está usando este aparelho e com qual papel.
// Até a sincronização por pessoa (etapa 6), a pessoa é escolhida em Ajustes; sem escolha, vale Admin.
import type { Papel, Pessoa } from '../dominio/tipos';
import { useConfig, useEntidade } from '../dados/ganchos';

export interface Perfil {
  pessoa: Pessoa | null;
  papel: Papel;
  ehAdmin: boolean;
}

export function usePerfil(): Perfil {
  const config = useConfig();
  const pessoas = useEntidade('pessoas');
  const pessoa = pessoas.find((p) => p.id === config.pessoa_id && !p.excluido) ?? null;
  const papel: Papel = pessoa?.papel ?? 'Admin';
  return { pessoa, papel, ehAdmin: papel === 'Admin' };
}
