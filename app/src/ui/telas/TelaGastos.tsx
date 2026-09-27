// Gastos do dia a dia (antigo Lançar + Histórico) — só Admin.
import { useState } from 'preact/hooks';
import { gastosDoMes, totalPorCategoria } from '../../dominio/gastos';
import { formatarMoeda, somar } from '../../dominio/dinheiro';
import { formatarData, mesAtual } from '../../dominio/meses';
import { useEntidade } from '../../dados/ganchos';
import { useEstado } from '../estado';
import { useNomes } from '../dados';
import { SeletorMes } from '../componentes/Campos';
import { IconeRecibo } from '../icones';

let mesSalvo = mesAtual();

export function TelaGastos() {
  const { abrirPainel } = useEstado();
  const nomes = useNomes();
  const [mes, setMes] = useState(mesSalvo);
  const gastos = gastosDoMes(useEntidade('gastos_rotineiros'), mes);
  const total = somar(gastos.map((g) => g.valor));
  const porCategoria = totalPorCategoria(gastos);

  return (
    <>
      <header class="cabecalho">
        <h1>Gastos</h1>
        <span class="sub">dinheiro, Pix e débito na hora</span>
      </header>
      <div class="conteudo">
        <div class="filtros">
          <div class="filtro filtro-mes">
            <span>Mês</span>
            <SeletorMes
              valor={mes}
              aoMudar={(m) => {
                mesSalvo = m;
                setMes(m);
              }}
            />
          </div>
        </div>

        <div class="totais">
          <div class="total destaque">
            <span>Total do mês</span>
            <strong class="num">{formatarMoeda(total)}</strong>
          </div>
          <div class="total">
            <span>Lançamentos</span>
            <strong class="num">{gastos.length}</strong>
          </div>
        </div>

        {gastos.length === 0 ? (
          <div class="vazio">
            <IconeRecibo />
            <strong>Nenhum gasto neste mês</strong>
            Toque no + para lançar.
          </div>
        ) : (
          <>
            <details class="bloco-dobra">
              <summary>Por categoria</summary>
              <ul class="lista compacta">
                {porCategoria.map((c) => (
                  <li key={c.id} class="linha-info">
                    <span>{nomes.categoria(c.id)}</span>
                    <strong class="num">{formatarMoeda(c.total)}</strong>
                  </li>
                ))}
              </ul>
            </details>
            <h2 class="secao-titulo">Histórico</h2>
            <ul class="lista">
              {gastos.map((g) => (
                <li key={g.id}>
                  <button class="linha-reg" onClick={() => abrirPainel({ tipo: 'gasto', id: g.id })}>
                    <span class="linha-reg-texto">
                      <strong>{g.descricao || nomes.categoria(g.categoria_id)}</strong>
                      <small>
                        {formatarData(g.data)} · {g.descricao ? `${nomes.categoria(g.categoria_id)} · ` : ''}
                        {nomes.meio(g.meio_pagamento_id)} · {nomes.pessoa(g.pessoa_id)}
                      </small>
                    </span>
                    <span class="linha-reg-valor">
                      <strong>{formatarMoeda(g.valor)}</strong>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
