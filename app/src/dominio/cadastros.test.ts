import { describe, expect, it } from 'vitest';
import {
  novaCategoria,
  novaPessoa,
  novoMeio,
  normalizarPessoa,
  ordenarPorNome,
  paraEscolha,
  usosCategoria,
  usosPessoa,
  validarMeio,
  validarNome,
  validarPessoa,
} from './cadastros';
import type { GastoRotineiro, Lancamento, Rateio } from './tipos';

describe('cadastros', () => {
  it('R16 — nome obrigatório e sem repetir (ignora maiúsculas e excluídos)', () => {
    const lista = [novaCategoria('a', 'Moradia'), { ...novaCategoria('b', 'Lazer'), excluido: true }];
    expect(validarNome(' ', lista, 'x', 'uma categoria')).toEqual(['Informe o nome.']);
    expect(validarNome(' moradia ', lista, 'x', 'uma categoria')).toHaveLength(1);
    expect(validarNome('Moradia', lista, 'a', 'uma categoria')).toHaveLength(0); // editando a própria
    expect(validarNome('Lazer', lista, 'x', 'uma categoria')).toHaveLength(0); // a outra foi excluída
  });

  it('R18 — ordem alfabética em português', () => {
    const nomes = ordenarPorNome([novaCategoria('1', 'Saúde'), novaCategoria('2', 'alimentação'), novaCategoria('3', 'Educação')]).map((c) => c.nome);
    expect(nomes).toEqual(['alimentação', 'Educação', 'Saúde']);
  });

  it('para escolha: só ativos e não excluídos, mantendo o já selecionado', () => {
    const lista = [novaCategoria('a', 'A'), { ...novaCategoria('b', 'B'), ativo: false }, { ...novaCategoria('c', 'C'), excluido: true }];
    expect(paraEscolha(lista).map((c) => c.id)).toEqual(['a']);
    expect(paraEscolha(lista, 'b').map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('meio de pagamento: dias entre 1 e 31', () => {
    expect(validarMeio(novoMeio('m', { nome: 'Nubank', dia_fechamento: 32 }), [])).toHaveLength(1);
    expect(validarMeio(novoMeio('m', { nome: 'Nubank', dia_fechamento: 3, dia_vencimento: 10 }), [])).toHaveLength(0);
  });

  it('pessoa: membro precisa de papel; terceiro fica sem papel', () => {
    expect(validarPessoa(novaPessoa('p', { nome: 'Paulo', papel: null }), [])).toHaveLength(1);
    const terceiro = normalizarPessoa(novaPessoa('t', { nome: ' Malurde ', tipo: 'Terceiro Devedor', papel: 'Admin' }));
    expect(terceiro).toMatchObject({ nome: 'Malurde', papel: null });
  });

  it('R17 — contagem de uso ignora registros excluídos', () => {
    const lanc = (id: string, cat: string, excluido = false) => ({ id, categoria_id: cat, excluido }) as Lancamento;
    const b = {
      lancamentos: [lanc('1', 'c1'), lanc('2', 'c1', true)],
      rateios: [{ pessoa_id: 'p1', excluido: false } as Rateio],
      gastos: [{ categoria_id: 'c1', pessoa_id: 'p1', excluido: false } as GastoRotineiro],
      entradas: [],
    };
    expect(usosCategoria('c1', b)).toBe(2);
    expect(usosPessoa('p1', b)).toBe(2);
    expect(usosCategoria('c2', b)).toBe(0);
  });
});
