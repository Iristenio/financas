// Rateio entre pessoas: uma linha por pessoa com o valor da parcela dela (R5).
import type { Pessoa } from '../../dominio/tipos';
import { arred, formatarMoeda, quaseIgual, somar } from '../../dominio/dinheiro';
import { toleranciaRateio } from '../../dominio/lancamentos';
import { CampoValor } from './Campos';
import { IconeFechar, IconeMais } from '../icones';

export interface LinhaEdicao {
  chave: number;
  pessoa_id: string;
  valor: number | null;
}

let proximaChave = 1;
export const novaLinha = (pessoa_id = '', valor: number | null = null): LinhaEdicao => ({ chave: proximaChave++, pessoa_id, valor });

export function somaRateio(linhas: LinhaEdicao[], qtdParcelas: number): number {
  return somar(linhas.map((l) => arred((l.valor ?? 0) * qtdParcelas)));
}

export function rateioBate(linhas: LinhaEdicao[], valorTotal: number, qtdParcelas: number): boolean {
  return valorTotal > 0 && quaseIgual(somaRateio(linhas, qtdParcelas), valorTotal, toleranciaRateio(qtdParcelas));
}

const rotuloPessoa = (p: Pessoa) => (p.tipo === 'Membro do Domicílio' ? p.nome : `${p.nome} (${p.tipo === 'Terceiro Devedor' ? 'terceiro' : 'monitorado'})`);

export function EditorRateio(props: {
  linhas: LinhaEdicao[];
  aoMudar: (linhas: LinhaEdicao[]) => void;
  pessoas: Pessoa[];
  valorTotal: number;
  qtdParcelas: number;
}) {
  const { linhas, aoMudar, pessoas, valorTotal, qtdParcelas } = props;
  const soma = somaRateio(linhas, qtdParcelas);
  const bate = rateioBate(linhas, valorTotal, qtdParcelas);
  const mudarLinha = (chave: number, parcial: Partial<LinhaEdicao>) => aoMudar(linhas.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)));

  function dividirIgualmente() {
    if (!(valorTotal > 0) || !qtdParcelas) return;
    const parcela = valorTotal / qtdParcelas;
    const n = linhas.length;
    const base = Math.floor((parcela / n) * 100) / 100;
    const ultimo = arred(parcela - base * (n - 1));
    aoMudar(linhas.map((l, i) => ({ ...l, valor: i === n - 1 ? ultimo : base })));
  }

  return (
    <fieldset class="rateio">
      <legend>Rateio entre pessoas</legend>
      {linhas.map((l) => (
        <div key={l.chave} class="rateio-linha">
          <select class="campo" aria-label="Pessoa" value={l.pessoa_id} onChange={(e) => mudarLinha(l.chave, { pessoa_id: e.currentTarget.value })}>
            <option value="">Escolha…</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {rotuloPessoa(p)}
              </option>
            ))}
          </select>
          <div class="rateio-valores">
            <label class="campo-rotulo">
              <span>Por parcela</span>
              <CampoValor valor={l.valor} aoMudar={(v) => mudarLinha(l.chave, { valor: v })} />
            </label>
            <div class="rateio-total">
              <span>Total</span>
              <strong class="num">{formatarMoeda(arred((l.valor ?? 0) * qtdParcelas))}</strong>
            </div>
            <button type="button" class="botao-icone" aria-label="Remover pessoa" disabled={linhas.length === 1} onClick={() => aoMudar(linhas.filter((x) => x.chave !== l.chave))}>
              <IconeFechar />
            </button>
          </div>
        </div>
      ))}
      <div class="linha">
        <button type="button" class="botao" onClick={() => aoMudar([...linhas.map((l) => ({ ...l, valor: null })), novaLinha()])}>
          <IconeMais /> Adicionar pessoa
        </button>
        <button type="button" class="botao" onClick={dividirIgualmente}>
          Dividir igualmente
        </button>
      </div>
      <p class={`rateio-soma ${bate ? 'positivo' : 'negativo'}`}>
        Soma do rateio: <strong class="num">{formatarMoeda(soma)}</strong> de <strong class="num">{formatarMoeda(valorTotal || 0)}</strong>
        {bate ? ' ✔' : ''}
      </p>
    </fieldset>
  );
}
