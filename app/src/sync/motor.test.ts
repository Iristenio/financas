// Testa o ciclo completo app ↔ backend usando o MESMO núcleo do Apps Script (backend/nucleo.js),
// com a planilha simulada em memória.
import 'fake-indexeddb/auto';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { abrirBanco, fecharBanco, NOME_BANCO } from '../dados/db';
import { buscar, lerConfig, listarTodos, listarFila, salvar, salvarInterno } from '../dados/repositorio';
import { novaCategoria, novoMeio } from '../dominio/cadastros';
import { baixarTudo, decodificarCodigo, lerEstadoSync, sincronizar } from './motor';

const require = createRequire(import.meta.url);
const nucleo = require('../../../backend/nucleo.js');

const TOKEN = 'segredo';
const TOKEN_COLAB = 'colab';
const USUARIOS: Record<string, { nome: string; pessoa_id: string; papel: string }> = {
  [TOKEN]: { nome: 'Iristenio', pessoa_id: 'pes-1', papel: 'Admin' },
  [TOKEN_COLAB]: { nome: 'Paulo', pessoa_id: 'pes-2', papel: 'Colaborador' },
};
let tabelas: Record<string, ReturnType<typeof nucleo.tabelaEmMemoria>>;
let relogio = 0;
const agoraServidor = () => new Date(Date.UTC(2026, 0, 1, 12, 0, relogio++)).toISOString();

function instalarServidor() {
  tabelas = Object.fromEntries(Object.keys(nucleo.ESQUEMA).map((e) => [e, nucleo.tabelaEmMemoria()]));
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const req = JSON.parse(String(init.body));
    const usuario = USUARIOS[req.token];
    const corpo = !usuario ? { ok: false, erro: 'Token inválido', codigo: 401 } : nucleo.processar(tabelas, req, agoraServidor(), usuario);
    return { ok: true, status: 200, json: async () => corpo } as Response;
  });
}

/** Simula outro aparelho enviando uma alteração direto ao servidor. */
function outroAparelhoEnvia(entidade: string, payload: { id: string }) {
  nucleo.processar(tabelas, { acao: 'sincronizar', operacoes: [{ id: 'x' + payload.id, entidade, registro_id: payload.id, operacao: 'alterar', payload }] }, agoraServidor());
}

beforeEach(async () => {
  await fecharBanco();
  await new Promise<void>((ok) => {
    const req = indexedDB.deleteDatabase(NOME_BANCO);
    req.onsuccess = req.onerror = req.onblocked = () => ok();
  });
  instalarServidor();
  await salvarInterno('_conexao', { url: 'https://exemplo/exec', token: TOKEN });
});

const item = (id: string, nome: string, atualizado = '2026-01-01T10:00:00.000Z') =>
  ({ ...novaCategoria(id, nome), atualizado_em: atualizado, criado_em: atualizado });

describe('código de conexão', () => {
  it('decodifica o formato APP1', () => {
    const b64 = btoa(JSON.stringify({ u: 'https://script.google.com/macros/s/x/exec', t: 'abc' })).replace(/\+/g, '-').replace(/\//g, '_');
    expect(decodificarCodigo(`  APP1:${b64} `)).toEqual({ url: 'https://script.google.com/macros/s/x/exec', token: 'abc' });
    expect(decodificarCodigo('qualquer coisa')).toBeNull();
  });
});

describe('núcleo do backend', () => {
  it('linha ↔ registro preserva tipos', () => {
    const reg = { ...novoMeio('a', { nome: 'Nubank', dia_fechamento: null, dia_vencimento: 10 }), criado_em: 'c', atualizado_em: 'a' };
    expect(nucleo.linhaParaRegistro('meios_pagamento', nucleo.registroParaLinha('meios_pagamento', reg, 'T'))).toEqual(reg);
  });
  it('versão antiga não sobrescreve a mais nova', () => {
    outroAparelhoEnvia('categorias', item('a', 'nova', '2026-01-01T12:00:00.000Z'));
    outroAparelhoEnvia('categorias', item('a', 'velha', '2026-01-01T09:00:00.000Z'));
    expect(tabelas.categorias.linhas()[0][1]).toBe('nova');
  });
});

describe('sincronização', () => {
  it('envia a fila local e a esvazia', async () => {
    await salvar('categorias', item('i1', 'Primeiro'));
    await sincronizar();
    expect(await listarFila()).toHaveLength(0);
    expect(tabelas.categorias.linhas().map((l: string[]) => l[1])).toEqual(['Primeiro']);
    expect(lerEstadoSync().status).toBe('sincronizado');
  });

  it('recebe o que outro aparelho enviou, sem devolver à fila', async () => {
    outroAparelhoEnvia('categorias', item('i9', 'Do celular'));
    await sincronizar();
    expect((await buscar('categorias', 'i9'))?.nome).toBe('Do celular');
    expect(await listarFila()).toHaveLength(0);
  });

  it('token inválido vira erro e mantém a fila', async () => {
    await salvarInterno('_conexao', { url: 'https://exemplo/exec', token: 'errado' });
    await salvar('categorias', item('i1', 'x'));
    await sincronizar();
    expect(lerEstadoSync().status).toBe('erro');
    expect(await listarFila()).toHaveLength(1);
  });

  it('envia em lotes', async () => {
    for (let n = 0; n < 120; n++) await salvar('categorias', item(`i${n}`, `item ${n}`));
    await sincronizar();
    expect(await listarFila()).toHaveLength(0);
    expect(tabelas.categorias.linhas()).toHaveLength(120);
  });

  it('"baixar tudo" restaura um aparelho vazio', async () => {
    outroAparelhoEnvia('categorias', item('i1', 'a'));
    await sincronizar();
    await (await abrirBanco()).clear('categorias');
    await baixarTudo();
    expect((await buscar('categorias', 'i1'))?.nome).toBe('a');
  });
});

describe('permissões por pessoa (P1, P2)', () => {
  const gasto = (id: string) => ({ id, data: '2026-01-05', categoria_id: 'c', meio_pagamento_id: 'm', pessoa_id: 'pes-1', descricao: '', valor: 10, excluido: false, criado_em: 'x', atualizado_em: '2026-01-01T10:00:00.000Z' });

  it('o Admin recebe tudo e o aparelho assume a pessoa do código', async () => {
    outroAparelhoEnvia('gastos_rotineiros', gasto('g1'));
    await sincronizar();
    expect(await buscar('gastos_rotineiros', 'g1')).toBeTruthy();
    expect(await lerConfig()).toMatchObject({ pessoa_id: 'pes-1', papel_servidor: 'Admin' });
  });

  it('o Colaborador não recebe nem grava dados só do Admin, e a fila não trava', async () => {
    outroAparelhoEnvia('gastos_rotineiros', gasto('g1'));
    await salvarInterno('_conexao', { url: 'https://exemplo/exec', token: TOKEN_COLAB });
    await salvar('gastos_rotineiros', gasto('g2') as never);
    await salvar('categorias', item('c1', 'Mercado'));
    await sincronizar();

    expect(await lerConfig()).toMatchObject({ pessoa_id: 'pes-2', papel_servidor: 'Colaborador' });
    expect(await listarTodos('gastos_rotineiros')).toEqual([]); // nem o g1 do servidor, nem o g2 local
    expect(tabelas.gastos_rotineiros.linhas().map((l: string[]) => l[0])).toEqual(['g1']); // g2 recusado
    expect(tabelas.categorias.linhas().map((l: string[]) => l[0])).toEqual(['c1']);
    expect(await listarFila()).toEqual([]);
    expect(lerEstadoSync().status).toBe('sincronizado');
  });
});
