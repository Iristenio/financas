// Monitoramento (R15): quanto cada pessoa deve, por categoria e meio de pagamento, parcela a parcela.
import { useState } from 'preact/hooks';
import { monitorar, type FiltroMonitor, type StatusFiltro } from '../../dominio/monitoramento';
import { paraEscolha } from '../../dominio/cadastros';
import { formatarMoeda } from '../../dominio/dinheiro';
import { formatarMesCurto, mesAtual } from '../../dominio/meses';
import { useEntidade } from '../../dados/ganchos';
import { useEstado } from '../estado';
import { useContas, useNomes } from '../dados';
import { Filtros, filtrosIguais, SeletorCadastro, SeletorMes } from '../componentes/Campos';
import { IconeGrafico } from '../icones';

const PADRAO: FiltroMonitor = { mes: mesAtual(), categoria_id: '', meio_pagamento_id: '', pessoa_id: '', status: 'Aberto' };
let filtroSalvo = PADRAO;

function Resumo({ titulo, itens, nome }: { titulo: string; itens: { id: string; total: number }[]; nome: (id: string) => string }) {
  return (
    <details class="bloco-dobra">
      <summary>{titulo}</summary>
      <ul class="lista compacta">
        {itens.map((x) => (
          <li key={x.id} class="linha-info">
            <span>{nome(x.id)}</span>
            <strong class="num">{formatarMoeda(x.total)}</strong>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function TelaMonitoramento() {
  const { abrirPainel } = useEstado();
  const contas = useContas();
  const nomes = useNomes();
  const categorias = paraEscolha(useEntidade('categorias'));
  const meios = paraEscolha(useEntidade('meios_pagamento').filter((m) => m.tipo !== 'Pronto Pagamento'));
  const pessoas = paraEscolha(useEntidade('pessoas'));
  const [f, setF] = useState<FiltroMonitor>(filtroSalvo);
  const mudar = (parcial: Partial<FiltroMonitor>) => {
    filtroSalvo = { ...f, ...parcial };
    setF(filtroSalvo);
  };

  const r = monitorar(contas.porId, contas.todasParcelas, contas.rateios, f);
  const rotuloStatus = f.status === 'Aberto' ? 'em aberto' : f.status === 'Pago' ? 'pagas' : 'no total';

  return (
    <>
      <header class="cabecalho">
        <h1>Monitoramento</h1>
      </header>
      <div class="conteudo">
        <Filtros
          ativosExtras={[f.categoria_id, f.meio_pagamento_id].filter(Boolean).length}
          aoLimpar={filtrosIguais(f, PADRAO) ? undefined : () => mudar(PADRAO)}
          principais={
            <>
              <div class="filtro filtro-mes">
                <span>Mês</span>
                <SeletorMes valor={f.mes} aoMudar={(mes) => mudar({ mes })} permitirTodos />
              </div>
              <label class="filtro">
                <span>Status</span>
                <select class="campo" value={f.status} onChange={(e) => mudar({ status: e.currentTarget.value as StatusFiltro })}>
                  <option value="Aberto">Em aberto</option>
                  <option value="Pago">Pagas</option>
                  <option value="Todos">Todas</option>
                </select>
              </label>
              <label class="filtro">
                <span>Pessoa</span>
                <SeletorCadastro valor={f.pessoa_id} aoMudar={(pessoa_id) => mudar({ pessoa_id })} opcoes={pessoas} vazio="Todas" />
              </label>
            </>
          }
          extras={
            <>
              <label class="filtro extra">
                <span>Categoria</span>
                <SeletorCadastro valor={f.categoria_id} aoMudar={(categoria_id) => mudar({ categoria_id })} opcoes={categorias} vazio="Todas" />
              </label>
              <label class="filtro extra">
                <span>Meio de pagamento</span>
                <SeletorCadastro valor={f.meio_pagamento_id} aoMudar={(meio_pagamento_id) => mudar({ meio_pagamento_id })} opcoes={meios} vazio="Todos" />
              </label>
            </>
          }
        />

        <div class="totais">
          <div class="total destaque">
            <span>Total {rotuloStatus}</span>
            <strong class="num">{formatarMoeda(r.total)}</strong>
          </div>
          <div class="total">
            <span>Parcelas</span>
            <strong class="num">{r.linhas.length}</strong>
          </div>
        </div>

        {r.linhas.length === 0 ? (
          <div class="vazio">
            <IconeGrafico />
            <strong>Nada com esses filtros</strong>
          </div>
        ) : (
          <>
            <h2 class="secao-titulo">Por pessoa</h2>
            <ul class="lista compacta">
              {r.porPessoa.map((p) => (
                <li key={p.pessoa_id} class="linha-info grande">
                  <span>{nomes.pessoa(p.pessoa_id)}</span>
                  <strong class="num">{formatarMoeda(p.total)}</strong>
                </li>
              ))}
            </ul>

            <Resumo titulo="Por categoria" itens={r.porCategoria} nome={nomes.categoria} />
            <Resumo titulo="Por meio de pagamento" itens={r.porMeio} nome={nomes.meio} />

            <details class="bloco-dobra">
              <summary>Parcela a parcela ({r.linhas.length})</summary>
              <ul class="lista compacta">
                {r.linhas.map(({ parcela, lancamento, devedores }) => (
                  <li key={parcela.id}>
                    <button class="linha-info linha-botao" onClick={() => abrirPainel({ tipo: 'conta', id: lancamento.id })}>
                      <span>
                        <strong>{lancamento.descricao}</strong>
                        <small>
                          {' '}
                          · Nº{parcela.numero} · {formatarMesCurto(parcela.mes_vencimento)} · {parcela.status === 'Pago' ? 'paga' : 'aberta'}
                        </small>
                        <br />
                        <small>{devedores.map((d) => `${nomes.pessoa(d.pessoa_id)}: ${formatarMoeda(d.valor)}`).join(' · ')}</small>
                      </span>
                      <strong class="num">{formatarMoeda(parcela.valor)}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </>
  );
}
