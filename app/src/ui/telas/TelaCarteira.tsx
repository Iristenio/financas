// Carteira (C1–C9): saldo disponível, entradas e saídas do mês, fontes — só Admin.
import type preact from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { Entidade } from '../../dominio/tipos';
import { ID_CARTEIRA } from '../../dominio/tipos';
import { iniciarCarteira, movimentosDaCarteira, resumirCarteira, type Movimento } from '../../dominio/carteira';
import { ordenarPorNome, vivos } from '../../dominio/cadastros';
import { formatarMoeda } from '../../dominio/dinheiro';
import { formatarData, formatarMesLongo, mesAtual } from '../../dominio/meses';
import { hojeISO } from '../../dominio/datas';
import type { Alteracao } from '../../dados/repositorio';
import { useEntidade } from '../../dados/ganchos';
import { gravarComDesfazer } from '../acoes/registros';
import { useEstado } from '../estado';
import { useContas, useNomes } from '../dados';
import { CampoValor, SeletorCadastro, SeletorMes } from '../componentes/Campos';
import { gastosDoMes } from '../../dominio/gastos';
import { somar } from '../../dominio/dinheiro';
import { irPara } from '../rotas';
import { IconeRecibo } from '../icones';
import { IconeCarteira } from '../icones';

let mesSalvo = mesAtual();
let fonteSalva = '';

/** Movimentos e saldo, para a tela e para o Início. */
export function useCarteira() {
  const config = useEntidade('carteira_config').find((c) => c.id === ID_CARTEIRA);
  const entradas = useEntidade('entradas');
  const gastos = useEntidade('gastos_rotineiros');
  const contas = useContas();
  const movimentos = useMemo(
    () => movimentosDaCarteira({ config, entradas, gastos, parcelas: contas.todasParcelas, lancamentos: contas.porId }),
    [config, entradas, gastos, contas],
  );
  return { config, movimentos };
}

function Iniciar() {
  const { avisar } = useEstado();
  const fontes = useEntidade('fontes');
  const [data, setData] = useState(hojeISO());
  const [saldo, setSaldo] = useState<number | null>(null);

  async function iniciar(e: Event) {
    e.preventDefault();
    const x = iniciarCarteira(data, saldo ?? 0, fontes);
    const desfazer = await gravarComDesfazer([
      { entidade: 'carteira_config', registro: x.config } as Alteracao,
      ...x.fontes.map((f) => ({ entidade: 'fontes' as Entidade, registro: f }) as Alteracao),
      { entidade: 'entradas', registro: x.entrada } as Alteracao,
    ]);
    avisar({ texto: 'Carteira iniciada', desfazer });
  }

  return (
    <section class="cartao carteira-inicio">
      <h2>
        <IconeCarteira /> Começar a carteira
      </h2>
      <form class="formulario" onSubmit={iniciar}>
        <p class="dica">
          Escolha a partir de quando a carteira conta e quanto dinheiro você tinha nesse dia. A partir daí, toda entrada soma e
          toda parcela paga (com data) e todo gasto do dia a dia diminui o saldo. Nada antes dessa data conta.
        </p>
        <div class="grade-2">
          <label class="campo-rotulo">
            <span>Data de início</span>
            <input class="campo" type="date" value={data} onInput={(e) => setData(e.currentTarget.value)} />
          </label>
          <div class="campo-rotulo">
            <span>Saldo nesse dia</span>
            <CampoValor valor={saldo} aoMudar={setSaldo} />
          </div>
        </div>
        <div class="linha">
          <button type="submit" class="botao primario" disabled={!data}>
            Começar
          </button>
        </div>
      </form>
    </section>
  );
}

/** Cartões do Início (só Admin): saldo da carteira e gastos do mês. */
export function ResumoAdmin() {
  const { config, movimentos } = useCarteira();
  const gastos = gastosDoMes(useEntidade('gastos_rotineiros'), mesAtual());
  const saldo = somar(movimentos.map((m) => m.valor));
  return (
    <div class="totais">
      <button class={`total botao-total${saldo < 0 ? ' saldo-negativo' : ''}`} onClick={() => irPara('carteira')}>
        <span>
          <IconeCarteira class="icone-inline" /> Carteira
        </span>
        <strong class="num">{config?.data_inicio ? formatarMoeda(saldo) : 'Começar →'}</strong>
      </button>
      <button class="total botao-total" onClick={() => irPara('gastos')}>
        <span>
          <IconeRecibo class="icone-inline" /> Gastos do mês ({gastos.length})
        </span>
        <strong class="num">{formatarMoeda(somar(gastos.map((g) => g.valor)))}</strong>
      </button>
    </div>
  );
}

function descrever(m: Movimento, nomes: ReturnType<typeof useNomes>, contas: ReturnType<typeof useContas>, fontes: Map<string, string>, gastos: Map<string, string>) {
  if (m.tipo === 'entrada') return { titulo: fontes.get(m.chave) ?? 'Entrada', detalhe: 'entrada' };
  if (m.tipo === 'parcela') {
    const l = contas.porId.get(m.ref);
    return { titulo: l ? `${l.descricao} (Nº${m.numero})` : 'Parcela', detalhe: l ? `parcela paga · ${nomes.meio(l.meio_pagamento_id)}` : 'parcela paga' };
  }
  return { titulo: gastos.get(m.ref) || nomes.categoria(m.chave), detalhe: `gasto · ${nomes.categoria(m.chave)}` };
}

/** Lista de movimentos com título e total (Entradas ou Saídas). */
function SecaoMovimentos(props: { titulo: string; movimentos: Movimento[]; vazio: string; linha: (m: Movimento) => preact.JSX.Element }) {
  const total = somar(props.movimentos.map((m) => Math.abs(m.valor)));
  return (
    <section class="secao-movimentos">
      <h2 class="secao-titulo">
        <span>{props.titulo}</span>
        {props.movimentos.length > 0 && <span class="num secao-total">{formatarMoeda(total)}</span>}
      </h2>
      {props.movimentos.length === 0 ? <p class="dica">{props.vazio}</p> : <ul class="lista compacta">{props.movimentos.map(props.linha)}</ul>}
    </section>
  );
}

export function TelaCarteira() {
  const { abrirPainel } = useEstado();
  const { config, movimentos } = useCarteira();
  const nomes = useNomes();
  const contas = useContas();
  const fontes = useEntidade('fontes');
  const gastos = useEntidade('gastos_rotineiros');
  const entradas = useEntidade('entradas');
  const [mes, setMes] = useState(mesSalvo);
  const [fonte, setFonte] = useState(fonteSalva);
  const nomeFonte = useMemo(() => new Map(fontes.map((f) => [f.id, f.nome])), [fontes]);
  const descGasto = useMemo(() => new Map(gastos.map((g) => [g.id, g.descricao])), [gastos]);
  const descEntrada = useMemo(() => new Map(entradas.map((e) => [e.id, e.descricao])), [entradas]);

  if (!config?.data_inicio) {
    return (
      <>
        <header class="cabecalho">
          <h1>Carteira</h1>
        </header>
        <div class="conteudo">
          <Iniciar />
        </div>
      </>
    );
  }

  const r = resumirCarteira(movimentos, mes);
  const entradasMes = r.movimentosMes.filter((m) => m.valor > 0 && (!fonte || m.chave === fonte));
  const saidasMes = r.movimentosMes.filter((m) => m.valor < 0);

  const linha = (m: Movimento) => {
    const d = descrever(m, nomes, contas, nomeFonte, descGasto);
    const abrir = () =>
      m.tipo === 'entrada' ? abrirPainel({ tipo: 'entrada', id: m.id }) : m.tipo === 'gasto' ? abrirPainel({ tipo: 'gasto', id: m.id }) : abrirPainel({ tipo: 'conta', id: m.ref });
    const extra = m.tipo === 'entrada' ? descEntrada.get(m.id) : '';
    return (
      <li key={m.id}>
        <button class="linha-info linha-botao" onClick={abrir}>
          <span>
            <strong>{d.titulo}</strong>
            <small>
              {' '}
              · {formatarData(m.data)} · {d.detalhe}
              {extra ? ` · ${extra}` : ''}
            </small>
          </span>
          <strong class={`num ${m.valor > 0 ? 'positivo' : 'negativo'}`}>
            {m.valor > 0 ? '+' : '−'} {formatarMoeda(Math.abs(m.valor))}
          </strong>
        </button>
      </li>
    );
  };

  return (
    <>
      <header class="cabecalho">
        <h1>Carteira</h1>
        <span class="sub">desde {formatarData(config.data_inicio)}</span>
      </header>
      <div class="conteudo">
        <div class="totais">
          <div class={`total destaque${r.saldo < 0 ? ' saldo-negativo' : ''}`}>
            <span>Saldo disponível</span>
            <strong class="num">{formatarMoeda(r.saldo)}</strong>
          </div>
          <div class="total">
            <span>Entrou em {formatarMesLongo(mes).split(' de ')[0].toLowerCase()}</span>
            <strong class="num positivo">{formatarMoeda(r.entradasMes)}</strong>
          </div>
          <div class="total">
            <span>Saiu em {formatarMesLongo(mes).split(' de ')[0].toLowerCase()}</span>
            <strong class="num negativo">{formatarMoeda(r.saidasMes)}</strong>
          </div>
        </div>

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
          <label class="filtro">
            <span>Fonte</span>
            <SeletorCadastro
              valor={fonte}
              aoMudar={(v) => {
                fonteSalva = v;
                setFonte(v);
              }}
              opcoes={ordenarPorNome(vivos(fontes))}
              vazio="Todas as fontes"
            />
          </label>
        </div>

        {r.porFonteMes.length > 0 && (
          <details class="bloco-dobra">
            <summary>Entradas por fonte</summary>
            <ul class="lista compacta">
              {r.porFonteMes.map((f) => (
                <li key={f.id} class="linha-info">
                  <span>{nomeFonte.get(f.id) ?? '—'}</span>
                  <strong class="num">{formatarMoeda(f.total)}</strong>
                </li>
              ))}
            </ul>
          </details>
        )}

        <details class="bloco-dobra">
          <summary>Fontes ({vivos(fontes).length})</summary>
          <ul class="lista compacta">
            {ordenarPorNome(vivos(fontes)).map((f) => (
              <li key={f.id}>
                <button class="linha-info linha-botao" onClick={() => abrirPainel({ tipo: 'fonte', id: f.id })}>
                  <span>
                    {f.nome} {!f.ativo && <span class="selo">Inativa</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button class="link" onClick={() => abrirPainel({ tipo: 'fonte' })}>
            + Nova fonte
          </button>
        </details>

        {r.movimentosMes.length === 0 ? (
          <>
            <h2 class="secao-titulo">Movimentos do mês</h2>
            <div class="vazio">
              <IconeCarteira />
              <strong>Nada neste mês</strong>
              Toque no + para registrar uma entrada.
            </div>
          </>
        ) : (
          <>
            <SecaoMovimentos titulo={fonte ? `Entradas · ${nomeFonte.get(fonte) ?? ''}` : 'Entradas'} movimentos={entradasMes} vazio="Nenhuma entrada neste mês." linha={linha} />
            {fonte ? (
              <p class="dica">As saídas não aparecem com o filtro de fonte: o dinheiro da carteira é um só, então as saídas não têm fonte.</p>
            ) : (
              <SecaoMovimentos titulo="Saídas" movimentos={saidasMes} vazio="Nenhuma saída neste mês." linha={linha} />
            )}
          </>
        )}
      </div>
    </>
  );
}
