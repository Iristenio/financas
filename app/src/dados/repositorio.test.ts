import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, fecharBanco, NOME_BANCO } from './db';
import { gravar, listarTodos, salvar } from './repositorio';
import { novaCategoria } from '../dominio/cadastros';

beforeEach(async () => {
  await fecharBanco();
  await new Promise<void>((ok) => {
    const req = indexedDB.deleteDatabase(NOME_BANCO);
    req.onsuccess = req.onerror = req.onblocked = () => ok();
  });
});

const fila = async () => (await abrirBanco()).getAll('fila_sync');

describe('repositório local', () => {
  it('grava e coloca na fila como "criar"', async () => {
    await salvar('categorias', novaCategoria('a', 'Primeiro'));
    const itens = await fila();
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ entidade: 'categorias', registro_id: 'a', operacao: 'criar' });
  });

  it('compacta alterações seguidas e mantém "criar" enquanto não sincronizar', async () => {
    const i = novaCategoria('a', 'v1');
    await salvar('categorias', i);
    await salvar('categorias', { ...i, nome: 'v2' });
    await gravar([{ entidade: 'categorias', registro: { ...i, nome: 'v3', excluido: true }, operacao: 'excluir' }]);
    const itens = await fila();
    expect(itens).toHaveLength(1);
    expect(itens[0].operacao).toBe('criar');
    expect((itens[0].payload as unknown as { nome: string }).nome).toBe('v3');
  });

  it('preserva criado_em, atualiza atualizado_em e devolve a versão anterior (para Desfazer)', async () => {
    const i = novaCategoria('a', 'v1', new Date('2026-01-01T10:00:00Z'));
    await salvar('categorias', i);
    const anterior = await salvar('categorias', { ...i, nome: 'v2', criado_em: 'lixo' });
    expect(anterior?.nome).toBe('v1');
    const [salvo] = await listarTodos('categorias');
    expect(salvo.criado_em).toBe(i.criado_em);
    expect(salvo.atualizado_em).not.toBe(i.atualizado_em);
  });
});
