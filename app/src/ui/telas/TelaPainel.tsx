// Painel: evolução das dívidas em 24 meses (12 para trás, o atual e 11 à frente), com filtros.
import { useMemo, useState } from 'preact/hooks';
import { filtrarParcelas, mesesDaJanela, montarPainel, type FiltroPainel, type Recorrentes } from '../../dominio/painel';
import { paraEscolha } from '../../dominio/cadastros';
import { formatarMoeda, somar } from '../../dominio/dinheiro';
import { formatarMesLongo, mesAtual, somarMeses } from '../../dominio/meses';
import { useEntidade } from '../../dados/ganchos';
import { useEstado } from '../estado';
import { useContas } from '../dados';
import { Filtros, filtrosIguais, SeletorCadastro } from '../componentes/Campos';
import { GraficoBarras, GraficoLinha } from '../componentes/Graficos';

const PADRAO: FiltroPainel = { pessoa_id: '', meio_pagamento_id: '', categoria_id: '', recorrentes: 'incluir' };
let filtroSalvo = PADRAO;

/** "Outubro de 2026" → "outubro/2026" (para frases). */
const nomeMes = (m: string) => formatarMesLongo(m).replace(' de ', '/').toLowerCase();

export function TelaPainel() {
  const { abrirPainel } = useEstado();
  const contas = useContas();
  const categorias = paraEscolha(useEntidade('categorias'));
  const meios = paraEscolha(useEntidade('meios_pagamento').filter((m) => m.tipo !== 'Pronto Pagamento'));
  const pessoas = paraEscolha(useEntidade('pessoas'));
  const [f, setF] = useState<FiltroPainel>(filtroSalvo);
  const atual = mesAtual();
  const [selecionado, setSelecionado] = useState(12);
  const [tabela, setTabela] = useState(false);
  const mudar = (parcial: Partial<FiltroPainel>) => {
    filtroSalvo = { ...f, ...parcial };
    setF(filtroSalvo);
  };

  const r = useMemo(() => montarPainel(filtrarParcelas(contas.porId, contas.todasParcelas, contas.rateios, f), atual), [contas, f, atual]);
  const meses = mesesDaJanela(atual);
  const iAtual = 12;
  const m = r.meses[selecionado];
  const proximos = r.meses.slice(iAtual);
  const mediaProximos = proximos.length ? somar(proximos.map((x) => x.pago + x.aberto)) / proximos.length : 0;

  // Fins de dívida agrupados por mês
  const fins = new Map<string, typeof r.fins>();
  for (const x of r.fins) fins.set(x.mes, [...(fins.get(x.mes) ?? []), x]);

  const comum = { meses, atual: iAtual, selecionado, aoSelecionar: setSelecionado };

  return (
    <>
      <header class="cabecalho">
        <h1>Painel</h1>
        <span class="sub">evolução das dívidas · 12 meses para trás e 12 à frente</span>
      </header>
      <div class="conteudo painel-dividas">
        <Filtros
          ativosExtras={[f.meio_pagamento_id, f.categoria_id].filter(Boolean).length}
          aoLimpar={filtrosIguais(f, PADRAO) ? undefined : () => mudar(PADRAO)}
          principais={
            <>
              <label class="filtro">
                <span>Pessoa</span>
                <SeletorCadastro valor={f.pessoa_id} aoMudar={(pessoa_id) => mudar({ pessoa_id })} opcoes={pessoas} vazio="Todas" />
              </label>
              <label class="filtro">
                <span>Recorrentes</span>
                <select class="campo" value={f.recorrentes} onChange={(e) => mudar({ recorrentes: e.currentTarget.value as Recorrentes })}>
                  <option value="incluir">Incluir</option>
                  <option value="excluir">Excluir</option>
                </select>
              </label>
            </>
          }
          extras={
            <>
              <label class="filtro extra">
                <span>Meio de pagamento</span>
                <SeletorCadastro valor={f.meio_pagamento_id} aoMudar={(meio_pagamento_id) => mudar({ meio_pagamento_id })} opcoes={meios} vazio="Todos" />
              </label>
              <label class="filtro extra">
                <span>Categoria</span>
                <SeletorCadastro valor={f.categoria_id} aoMudar={(categoria_id) => mudar({ categoria_id })} opcoes={categorias} vazio="Todas" />
              </label>
            </>
          }
        />

        <div class="totais">
          <div class="total destaque">
            <span>Saldo devedor hoje</span>
            <strong>{formatarMoeda(r.saldoHoje)}</strong>
          </div>
          <div class="total">
            <span>Vence neste mês</span>
            <strong>{formatarMoeda(r.meses[iAtual].pago + r.meses[iAtual].aberto)}</strong>
          </div>
          <div class="total">
            <span>Média dos próximos 12 meses</span>
            <strong>{formatarMoeda(mediaProximos)}</strong>
          </div>
        </div>

        <section class="cartao grafico-cartao">
          <div class="grafico-topo">
            <h2>Valor devido por mês</h2>
            <div class="legenda">
              <span>
                <i class="chave serie-pago" /> Pago
              </span>
              <span>
                <i class="chave serie-aberto" /> Em aberto
              </span>
            </div>
          </div>
          <p class="grafico-leitura">
            <strong>{nomeMes(m.mes)}</strong> · total {formatarMoeda(m.pago + m.aberto)} · pago {formatarMoeda(m.pago)} · em aberto{' '}
            {formatarMoeda(m.aberto)}
            {m.mes < atual && m.aberto > 0 && <span class="selo perigo">atrasado</span>}
          </p>
          <GraficoBarras {...comum} rotulo="Valor devido por mês, pago e em aberto" pago={r.meses.map((x) => x.pago)} aberto={r.meses.map((x) => x.aberto)} />
        </section>

        <section class="cartao grafico-cartao">
          <div class="grafico-topo">
            <h2>Saldo devedor no fim do mês</h2>
          </div>
          <p class="grafico-leitura">
            <strong>{nomeMes(m.mes)}</strong> · {formatarMoeda(m.saldo)}
            {m.mes >= atual && <span class="dica"> (previsto: cada parcela paga no seu mês)</span>}
          </p>
          <GraficoLinha {...comum} rotulo="Saldo devedor no fim de cada mês" valores={r.meses.map((x) => x.saldo)} />
        </section>

        <div class="linha">
          <button class="botao pequeno" onClick={() => setTabela(!tabela)} aria-expanded={tabela}>
            {tabela ? 'Esconder tabela' : 'Ver em tabela'}
          </button>
        </div>
        {tabela && (
          <div class="tabela-rolagem">
            <table class="tabela-painel">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Pago</th>
                  <th>Em aberto</th>
                  <th>Total</th>
                  <th>Saldo no fim</th>
                </tr>
              </thead>
              <tbody>
                {r.meses.map((x, i) => (
                  <tr key={x.mes} class={i === iAtual ? 'atual' : ''}>
                    <td>{nomeMes(x.mes)}</td>
                    <td class="num">{formatarMoeda(x.pago)}</td>
                    <td class="num">{formatarMoeda(x.aberto)}</td>
                    <td class="num">{formatarMoeda(x.pago + x.aberto)}</td>
                    <td class="num">{formatarMoeda(x.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 class="secao-titulo">Quando as dívidas acabam</h2>
        {fins.size === 0 ? (
          <p class="dica">Nenhuma conta (não recorrente) termina nos próximos 12 meses com esses filtros.</p>
        ) : (
          <ul class="lista compacta fins-dividas">
            {[...fins.entries()].map(([mes, lista]) => (
              <li key={mes} class="fim-mes">
                <div class="linha-info">
                  <strong>Última parcela em {nomeMes(mes)}</strong>
                  <span class="num">
                    −{formatarMoeda(somar(lista.map((x) => x.alivio)))}/mês a partir de {nomeMes(somarMeses(mes, 1))}
                  </span>
                </div>
                <ul class="lista compacta">
                  {lista.map((x) => (
                    <li key={x.lancamento.id}>
                      <button class="linha-info linha-botao" onClick={() => abrirPainel({ tipo: 'conta', id: x.lancamento.id })}>
                        <span>{x.lancamento.descricao}</span>
                        <span class="num">{formatarMoeda(x.alivio)}/mês</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
