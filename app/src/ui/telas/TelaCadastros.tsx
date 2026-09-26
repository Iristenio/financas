// Cadastros: categorias, meios de pagamento e pessoas (R16–R18).
import { useState } from 'preact/hooks';
import { ordenarPorNome, usosCategoria, usosMeio, usosPessoa, vivos } from '../../dominio/cadastros';
import { useEntidade } from '../../dados/ganchos';
import { useEstado } from '../estado';
import { useBaseUso } from '../paineis/FormCadastros';
import { IconeEtiqueta } from '../icones';

export type AbaCadastro = 'categorias' | 'meios' | 'pessoas';

/** Aba aberta por último (o botão "+" usa para saber o que criar). */
let abaAtual: AbaCadastro = 'categorias';
export const lerAbaCadastro = () => abaAtual;

const plural = (n: number) => (n === 0 ? 'sem uso' : n === 1 ? 'usado 1 vez' : `usado ${n} vezes`);

export function TelaCadastros() {
  const { abrirPainel } = useEstado();
  const [aba, setAba] = useState<AbaCadastro>(abaAtual);
  const categorias = ordenarPorNome(vivos(useEntidade('categorias')));
  const meios = ordenarPorNome(vivos(useEntidade('meios_pagamento')));
  const pessoas = ordenarPorNome(vivos(useEntidade('pessoas')));
  const uso = useBaseUso();

  const mudarAba = (a: AbaCadastro) => {
    abaAtual = a;
    setAba(a);
  };

  const linhas =
    aba === 'categorias'
      ? categorias.map((c) => ({ id: c.id, nome: c.nome, info: plural(usosCategoria(c.id, uso)), ativo: c.ativo, abrir: () => abrirPainel({ tipo: 'categoria', id: c.id }) }))
      : aba === 'meios'
        ? meios.map((m) => ({
            id: m.id,
            nome: m.nome,
            info: [m.tipo, m.dia_vencimento ? `vence dia ${m.dia_vencimento}` : '', plural(usosMeio(m.id, uso))].filter(Boolean).join(' · '),
            ativo: m.ativo,
            abrir: () => abrirPainel({ tipo: 'meio', id: m.id }),
          }))
        : pessoas.map((p) => ({
            id: p.id,
            nome: p.nome,
            info: [p.tipo, p.papel ?? '', plural(usosPessoa(p.id, uso))].filter(Boolean).join(' · '),
            ativo: p.ativo,
            abrir: () => abrirPainel({ tipo: 'pessoa', id: p.id }),
          }));

  return (
    <>
      <header class="cabecalho">
        <h1>Cadastros</h1>
      </header>
      <div class="conteudo">
        <div class="segmentado abas" role="tablist">
          {(
            [
              ['categorias', 'Categorias'],
              ['meios', 'Meios de pagamento'],
              ['pessoas', 'Pessoas'],
            ] as const
          ).map(([valor, rotulo]) => (
            <button key={valor} role="tab" aria-checked={aba === valor} onClick={() => mudarAba(valor)}>
              {rotulo}
            </button>
          ))}
        </div>

        {linhas.length === 0 ? (
          <div class="vazio">
            <IconeEtiqueta />
            <strong>Nada cadastrado ainda</strong>
            Toque no + para cadastrar.
          </div>
        ) : (
          <ul class="lista">
            {linhas.map((l) => (
              <li key={l.id}>
                <button class={`linha-reg${l.ativo ? '' : ' inativo'}`} onClick={l.abrir}>
                  <span class="linha-reg-texto">
                    <strong>
                      {l.nome} {!l.ativo && <span class="selo">Inativo</span>}
                    </strong>
                    <small>{l.info}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
