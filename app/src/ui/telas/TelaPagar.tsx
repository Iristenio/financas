// Pagar parcelas: parcelas em aberto agrupadas por conta, com seleção em lote (R10).
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Id, Parcela } from '../../dominio/tipos';
import { contemTexto, pagarParcelas } from '../../dominio/lancamentos';
import { paraEscolha } from '../../dominio/cadastros';
import { formatarMoeda, somar } from '../../dominio/dinheiro';
import { formatarMesCurto, mesAtual } from '../../dominio/meses';
import { hojeISO } from '../../dominio/datas';
import type { Alteracao } from '../../dados/repositorio';
import { useEntidade } from '../../dados/ganchos';
import { gravarComDesfazer } from '../acoes/registros';
import { useEstado } from '../estado';
import { useContas, useNomes } from '../dados';
import { Filtros, filtrosIguais, SeletorCadastro, SeletorMes } from '../componentes/Campos';
import { IconePagar } from '../icones';

interface FiltroPagar {
  titulo: string;
  mes: string;
  meio_pagamento_id: string;
  categoria_id: string;
  pessoa_id: string;
}

const PADRAO: FiltroPagar = { titulo: '', mes: mesAtual(), meio_pagamento_id: '', categoria_id: '', pessoa_id: '' };
let filtroSalvo = PADRAO;

function CaixaGrupo({ marcadas, total, aoMudar }: { marcadas: number; total: number; aoMudar: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = marcadas > 0 && marcadas < total;
  }, [marcadas, total]);
  return <input ref={ref} type="checkbox" aria-label="Selecionar a conta inteira" checked={marcadas === total} onChange={(e) => aoMudar(e.currentTarget.checked)} />;
}

export function TelaPagar() {
  const { avisar, abrirPainel } = useEstado();
  const contas = useContas();
  const nomes = useNomes();
  const categorias = paraEscolha(useEntidade('categorias'));
  const meios = paraEscolha(useEntidade('meios_pagamento').filter((m) => m.tipo !== 'Pronto Pagamento'));
  const pessoas = paraEscolha(useEntidade('pessoas'));
  const [f, setF] = useState<FiltroPagar>(filtroSalvo);
  const [selecionadas, setSelecionadas] = useState<Set<Id>>(new Set());
  const [data, setData] = useState(hojeISO());
  const mudar = (parcial: Partial<FiltroPagar>) => {
    filtroSalvo = { ...f, ...parcial };
    setF(filtroSalvo);
    setSelecionadas(new Set());
  };

  // Grupos: uma conta com suas parcelas em aberto que passam no filtro
  const grupos = contas.lancamentos
    .filter((l) => contemTexto(l.descricao, f.titulo))
    .filter((l) => (!f.meio_pagamento_id || l.meio_pagamento_id === f.meio_pagamento_id) && (!f.categoria_id || l.categoria_id === f.categoria_id))
    .filter((l) => !f.pessoa_id || (contas.rateios.get(l.id) ?? []).some((r) => r.pessoa_id === f.pessoa_id))
    .map((l) => {
      const todas = contas.parcelas.get(l.id) ?? [];
      const abertas = todas.filter((p) => p.status === 'Aberto' && (!f.mes || p.mes_vencimento === f.mes));
      return { l, abertas, qtd: todas.length };
    })
    .filter((g) => g.abertas.length > 0)
    .sort((a, b) => a.abertas[0].mes_vencimento.localeCompare(b.abertas[0].mes_vencimento) || a.l.descricao.localeCompare(b.l.descricao, 'pt-BR'));

  const todasVisiveis: Parcela[] = grupos.flatMap((g) => g.abertas);
  const escolhidas = todasVisiveis.filter((p) => selecionadas.has(p.id));
  const totalEscolhido = somar(escolhidas.map((p) => p.valor));
  const totalAberto = somar(todasVisiveis.map((p) => p.valor));

  const alternar = (ids: Id[], marcar: boolean) =>
    setSelecionadas((s) => {
      const n = new Set(s);
      ids.forEach((id) => (marcar ? n.add(id) : n.delete(id)));
      return n;
    });

  async function pagar() {
    if (!escolhidas.length || !data) return;
    const pagas = pagarParcelas(escolhidas, data);
    const desfazer = await gravarComDesfazer(pagas.map((p) => ({ entidade: 'parcelas', registro: p }) as Alteracao));
    setSelecionadas(new Set());
    avisar({ texto: `${pagas.length} parcela${pagas.length > 1 ? 's pagas' : ' paga'} (${formatarMoeda(somar(pagas.map((p) => p.valor)))})`, desfazer });
  }

  const tudoMarcado = todasVisiveis.length > 0 && escolhidas.length === todasVisiveis.length;

  return (
    <>
      <header class="cabecalho">
        <h1>Pagar parcelas</h1>
        <span class="sub">
          {todasVisiveis.length} em aberto · {formatarMoeda(totalAberto)}
        </span>
      </header>
      <div class="conteudo com-barra">
        <Filtros
          ativosExtras={[f.categoria_id, f.pessoa_id].filter(Boolean).length}
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
              <label class="filtro">
                <span>Meio de pagamento</span>
                <SeletorCadastro valor={f.meio_pagamento_id} aoMudar={(meio_pagamento_id) => mudar({ meio_pagamento_id })} opcoes={meios} vazio="Todos" />
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
                <span>Pessoa</span>
                <SeletorCadastro valor={f.pessoa_id} aoMudar={(pessoa_id) => mudar({ pessoa_id })} opcoes={pessoas} vazio="Todas" />
              </label>
            </>
          }
        />

        {grupos.length === 0 ? (
          <div class="vazio">
            <IconePagar />
            <strong>Nenhuma parcela em aberto</strong>
            {f.mes ? 'Neste mês e com esses filtros está tudo pago.' : 'Com esses filtros está tudo pago.'}
          </div>
        ) : (
          <>
            <div class="linha selecionar-todas">
              <button class="botao pequeno" onClick={() => alternar(todasVisiveis.map((p) => p.id), !tudoMarcado)}>
                {tudoMarcado ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>
            </div>
            <ul class="lista grupos-pagar">
              {grupos.map(({ l, abertas, qtd }) => {
                const marcadas = abertas.filter((p) => selecionadas.has(p.id)).length;
                return (
                  <li key={l.id} class="grupo-pagar">
                    <div class="grupo-topo">
                      <label class="grupo-check">
                        <CaixaGrupo marcadas={marcadas} total={abertas.length} aoMudar={(v) => alternar(abertas.map((p) => p.id), v)} />
                        <span class="linha-reg-texto">
                          <strong>{l.descricao}</strong>
                          <small>
                            {nomes.categoria(l.categoria_id)} · {nomes.meio(l.meio_pagamento_id)}
                          </small>
                        </span>
                      </label>
                      <button class="botao-texto num" onClick={() => abrirPainel({ tipo: 'conta', id: l.id })} title="Ver a conta">
                        {formatarMoeda(somar(abertas.map((p) => p.valor)))}
                      </button>
                    </div>
                    <div class="grupo-parcelas">
                      {abertas.map((p) => (
                        <label key={p.id} class={`opcao${selecionadas.has(p.id) ? ' marcada' : ''}`}>
                          <input type="checkbox" checked={selecionadas.has(p.id)} onChange={(e) => alternar([p.id], e.currentTarget.checked)} />
                          <span class="num">
                            Nº{p.numero}/{qtd} · {formatarMesCurto(p.mes_vencimento)} · {formatarMoeda(p.valor)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {escolhidas.length > 0 && (
        <div class="barra-pagar">
          <div class="barra-pagar-total">
            <span>
              {escolhidas.length} selecionada{escolhidas.length > 1 ? 's' : ''}
            </span>
            <strong class="num">{formatarMoeda(totalEscolhido)}</strong>
          </div>
          <label class="barra-pagar-data">
            <span>Pago em</span>
            <input class="campo" type="date" value={data} onInput={(e) => setData(e.currentTarget.value)} />
          </label>
          <button class="botao primario" disabled={!data} onClick={pagar}>
            Pagar
          </button>
        </div>
      )}
    </>
  );
}
