// Entidades do app (ver ESPECIFICACAO.md, §1).
// Datas: "AAAA-MM-DD"; meses: "AAAA-MM"; carimbos de data-hora: ISO completo; valores em reais (2 casas).
//
// ► Para criar uma entidade nova, siga o roteiro em ARQUITETURA.md ("Adicionar uma entidade").

export type Id = string;

/** Campos que TODA entidade sincronizada precisa ter. */
export interface Registro {
  id: Id;
  criado_em: string;
  atualizado_em: string;
}

/** Nada é apagado de verdade: registros excluídos ficam com excluido = true (D3). */
export interface Excluivel {
  excluido: boolean;
}

/* ---------------- Cadastros ---------------- */

export interface Categoria extends Registro, Excluivel {
  nome: string;
  ativo: boolean;
}

export const TIPOS_MEIO = ['Pronto Pagamento', 'Cartão de Crédito', 'Débito Automático'] as const;
export type TipoMeio = (typeof TIPOS_MEIO)[number];

export interface MeioPagamento extends Registro, Excluivel {
  nome: string;
  tipo: TipoMeio;
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  ativo: boolean;
}

export const TIPOS_PESSOA = ['Membro do Domicílio', 'Terceiro Monitorado', 'Terceiro Devedor'] as const;
export type TipoPessoa = (typeof TIPOS_PESSOA)[number];
export type Papel = 'Admin' | 'Colaborador';

export interface Pessoa extends Registro, Excluivel {
  nome: string;
  tipo: TipoPessoa;
  /** Só para Membro do Domicílio; vazio para terceiros. */
  papel: Papel | null;
  ativo: boolean;
}

/* ---------------- Contas (lançamentos parcelados) ---------------- */

export interface Lancamento extends Registro, Excluivel {
  data: string; // data da compra
  categoria_id: Id;
  meio_pagamento_id: Id;
  descricao: string;
  observacao: string;
  recorrente: boolean;
}

export interface Rateio extends Registro, Excluivel {
  lancamento_id: Id;
  pessoa_id: Id;
  percentual: number; // 0–1
}

export type StatusParcela = 'Aberto' | 'Pago';

export interface Parcela extends Registro, Excluivel {
  lancamento_id: Id;
  numero: number;
  mes_vencimento: string; // AAAA-MM
  valor: number;
  status: StatusParcela;
  data_pagamento: string | null; // AAAA-MM-DD (null: paga sem data registrada)
}

/* ---------------- Só do Admin ---------------- */

export interface GastoRotineiro extends Registro, Excluivel {
  data: string;
  categoria_id: Id;
  meio_pagamento_id: Id;
  pessoa_id: Id;
  descricao: string;
  valor: number;
}

export interface Fonte extends Registro, Excluivel {
  nome: string;
  ativo: boolean;
}

export interface Entrada extends Registro, Excluivel {
  data: string;
  fonte_id: Id;
  valor: number;
  descricao: string;
}

/** Registro único (id = ID_CARTEIRA). */
export interface CarteiraConfig extends Registro {
  data_inicio: string | null;
}
export const ID_CARTEIRA = 'carteira';

/** Nomes das entidades sincronizadas (cada uma vira uma loja local e uma aba na planilha). */
export const ENTIDADES = [
  'categorias',
  'meios_pagamento',
  'pessoas',
  'lancamentos',
  'rateios',
  'parcelas',
  'gastos_rotineiros',
  'fontes',
  'entradas',
  'carteira_config',
] as const;
export type Entidade = (typeof ENTIDADES)[number];

/** Entidades que só o Admin vê e grava (P2). */
export const ENTIDADES_ADMIN: readonly Entidade[] = ['gastos_rotineiros', 'fontes', 'entradas', 'carteira_config'];

/* ---------------- Infraestrutura ---------------- */

export interface ItemFila {
  id: Id;
  entidade: Entidade;
  registro_id: Id;
  operacao: 'criar' | 'alterar' | 'excluir';
  payload: Registro;
  tentativas: number;
  ultimo_erro: string | null;
  criado_em: string;
}

/** Preferências (valem por aparelho). */
export interface Config {
  /** Quem usa este aparelho (define o papel e a pessoa padrão nos formulários). */
  pessoa_id: Id | null;
}

export const CONFIG_PADRAO: Config = {
  pessoa_id: null,
};
