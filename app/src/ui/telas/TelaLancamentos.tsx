// Lançamentos: lista de contas com filtros (título, mês, categoria, meio, pessoa).
import { useState } from 'preact/hooks';
import { filtrarContas, resumirConta, type FiltroContas } from '../../dominio/lancamentos';
import { paraEscolha } from '../../dominio/cadastros';
import { formatarMoeda } from '../../dominio/dinheiro';
import { formatarMesCurto, mesAtual } from '../../dominio/meses';
import { useEntidade } from '../../dados/ganchos';
import { useEstado } from '../estado';
import { useContas, useNomes } from '../dados';
import { Filtros, filtrosIguais, SeletorCadastro, SeletorMes } from '../componentes/Campos';
import { IconeLista } from '../icones';

/** Filtros guardados enquanto o app está aberto (ao voltar para a tela, continuam). */
const PADRAO: FiltroContas = { titulo: '', mes: mesAtual(), categoria_id: '', meio_pagamento_id: '', pessoa_id: '' };
let filtroSalvo = PADRAO;

export function TelaLancamentos() {
  const { abrirPainel } = useEstado();
  const contas = useContas();
  const nomes = useNomes();
  const categorias = paraEscolha(useEntidade('categorias'));
  const meios = paraEscolha(useEntidade('meios_pagamento').filter((m) => m.tipo !== 'Pronto Pagamento'));
  const pessoas = paraEscolha(useEntidade('pessoas'));
  const [f, setF] = useState<FiltroContas>(filtroSalvo);
  const mudar = (parcial: Partial<FiltroContas>) => {
    filtroSalvo = { ...f, ...parcial };
    setF(filtroSalvo);
  };

  const lista = filtrarContas(contas.lancamentos, contas.parcelas, contas.rateios, f)
    .map((l) => ({ l, r: resumirConta(contas.parcelas.get(l.id) ?? [], contas.rateios.get(l.id) ?? []) }))
    .sort((a, b) => b.l.data.localeCompare(a.l.data) || a.l.descricao.localeCompare(b.l.descricao, 'pt-BR'));

  const totalSaldo = lista.reduce((s, x) => s + x.r.saldoDevedor, 0);

  return (
    <>
      <header class="cabecalho">
        <h1>Lançamentos</h1>
        <span class="sub">
          {lista.length} conta{lista.length === 1 ? '' : 's'} · saldo devedor {formatarMoeda(totalSaldo)}
        </span>
      </header>
      <div class="conteudo">
        <Filtros
          ativosExtras={[f.categoria_id, f.meio_pagamento_id, f.pessoa_id].filter(Boolean).length}
          aoLimpar={filtrosIguais(f, PADRAO) ? undefined : () => mudar(PADRAO)}
          principais={
            <>
              <label class="filtro filtro-busca">
                <span>Título</span>
                <input class="campo" type="search" placeholder="Buscar pela descrição" value={f.titulo} onInput={(e) => mudar({ titulo: e.currentTarget.value })} />
              </label>
              <div class="filtro filtro-mes">
                <span>Mês</span>
                <SeletorMes valor={f.mes} aoMudar={(mes) => mudar({ mes })} permitirTodos />
              </div>
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
              <label class="filtro extra">
                <span>Pessoa</span>
                <SeletorCadastro valor={f.pessoa_id} aoMudar={(pessoa_id) => mudar({ pessoa_id })} opcoes={pessoas} vazio="Todas" />
              </label>
            </>
          }
        />

        {lista.length === 0 ? (
          <div class="vazio">
            <IconeLista />
            <strong>Nenhuma conta com esses filtros</strong>
            {contas.lancamentos.length ? 'Experimente "Todos os meses".' : 'Toque no + para lançar a primeira conta.'}
          </div>
        ) : (
          <ul class="lista">
            {lista.map(({ l, r }) => {
              const pessoasRateio = (contas.rateios.get(l.id) ?? []).map((rt) => nomes.pessoa(rt.pessoa_id)).join(', ');
              return (
                <li key={l.id}>
                  <button class="linha-reg" onClick={() => abrirPainel({ tipo: 'conta', id: l.id })}>
                    <span class="linha-reg-texto">
                      <strong>
                        {l.descricao} {l.recorrente && <span class="selo primario">Recorrente</span>}
                      </strong>
                      <small>
                        {nomes.categoria(l.categoria_id)} · {nomes.meio(l.meio_pagamento_id)} · {pessoasRateio}
                      </small>
                      <small>
                        {r.pagas}/{r.qtdParcelas} pagas
                        {r.proxima && ` · próxima: Nº${r.proxima.numero} em ${formatarMesCurto(r.proxima.mes_vencimento)} (${formatarMoeda(r.proxima.valor)})`}
                      </small>
                    </span>
                    <span class="linha-reg-valor">
                      <strong>{formatarMoeda(r.saldoDevedor)}</strong>
                      <small>de {formatarMoeda(r.valorTotal)}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
