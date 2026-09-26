// Recorrentes (R11, R12): contas recorrentes com 2 ou menos parcelas em aberto, para renovar.
import { useState } from 'preact/hooks';
import { contasParaRenovar, renovarConta } from '../../dominio/lancamentos';
import { formatarMoeda } from '../../dominio/dinheiro';
import { formatarMesCurto } from '../../dominio/meses';
import type { Alteracao } from '../../dados/repositorio';
import { gravarComDesfazer } from '../acoes/registros';
import { useEstado } from '../estado';
import { useContas, useNomes } from '../dados';
import { IconeRepetir } from '../icones';

export function TelaRecorrentes() {
  const { avisar, abrirPainel } = useEstado();
  const contas = useContas();
  const nomes = useNomes();
  const [qtd, setQtd] = useState<Record<string, string>>({});
  const pendentes = contasParaRenovar(contas.lancamentos, contas.parcelas);
  const recorrentes = contas.lancamentos.filter((l) => l.recorrente).length;

  async function renovar(id: string, descricao: string) {
    const n = Math.max(1, Math.floor(Number(qtd[id] ?? 12) || 12));
    const novas = renovarConta(id, contas.parcelas.get(id) ?? [], n);
    const desfazer = await gravarComDesfazer(novas.map((p) => ({ entidade: 'parcelas', registro: p }) as Alteracao));
    avisar({ texto: `"${descricao}" renovada com ${n} parcela${n > 1 ? 's' : ''}`, desfazer });
  }

  return (
    <>
      <header class="cabecalho">
        <h1>Recorrentes</h1>
        <span class="sub">{recorrentes} conta{recorrentes === 1 ? '' : 's'} recorrente{recorrentes === 1 ? '' : 's'}</span>
      </header>
      <div class="conteudo">
        <p class="dica" style={{ marginBottom: '14px' }}>
          Contas recorrentes (assinaturas, contas fixas) com 2 parcelas ou menos em aberto — hora de gerar mais um lote. As novas
          parcelas continuam a numeração e os meses, com o valor da última.
        </p>
        {pendentes.length === 0 ? (
          <div class="vazio">
            <IconeRepetir />
            <strong>Nenhuma renovação pendente</strong>
          </div>
        ) : (
          <ul class="lista">
            {pendentes.map(({ lancamento: l, abertas }) => {
              const parcelas = contas.parcelas.get(l.id) ?? [];
              const ultima = parcelas[parcelas.length - 1];
              return (
                <li key={l.id} class="linha-reg sem-cursor">
                  <button class="linha-reg-texto botao-limpo" onClick={() => abrirPainel({ tipo: 'conta', id: l.id })}>
                    <strong>{l.descricao}</strong>
                    <small>
                      {nomes.categoria(l.categoria_id)} · {nomes.meio(l.meio_pagamento_id)}
                    </small>
                    <small>
                      {abertas === 0 ? 'Nenhuma parcela em aberto' : `${abertas} em aberto`}
                      {ultima && ` · última: Nº${ultima.numero} em ${formatarMesCurto(ultima.mes_vencimento)} (${formatarMoeda(ultima.valor)})`}
                    </small>
                  </button>
                  <div class="renovar">
                    <label class="campo-rotulo">
                      <span>Parcelas</span>
                      <input
                        class="campo campo-curto"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={qtd[l.id] ?? '12'}
                        onInput={(e) => setQtd({ ...qtd, [l.id]: e.currentTarget.value })}
                      />
                    </label>
                    <button class="botao primario" onClick={() => renovar(l.id, l.descricao)}>
                      Renovar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
