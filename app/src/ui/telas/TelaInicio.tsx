// Início — resumo do mês: a pagar, pago, próximos vencimentos e renovações pendentes.
import type { ComponentChildren } from 'preact';
import { APP } from '../../app.config';
import { contasParaRenovar } from '../../dominio/lancamentos';
import { formatarMoeda, somar } from '../../dominio/dinheiro';
import { formatarMesCurto, formatarMesLongo, mesAtual, somarMeses } from '../../dominio/meses';
import { useEntidade } from '../../dados/ganchos';
import { useEstado } from '../estado';
import { useContas, useNomes } from '../dados';
import { irPara } from '../rotas';
import { usePerfil } from '../perfil';
import { IconeEtiqueta, IconePagar, IconeRepetir } from '../icones';

const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export function TelaInicio({ extrasAdmin }: { extrasAdmin?: ComponentChildren }) {
  const { abrirPainel } = useEstado();
  const { ehAdmin } = usePerfil();
  const contas = useContas();
  const nomes = useNomes();
  const categorias = useEntidade('categorias');
  const mes = mesAtual();
  const proximo = somarMeses(mes, 1);

  const doMes = contas.todasParcelas.filter((p) => p.mes_vencimento === mes);
  const aPagar = doMes.filter((p) => p.status === 'Aberto');
  const pagoNoMes = doMes.filter((p) => p.status === 'Pago');
  const abertas = contas.todasParcelas.filter((p) => p.status === 'Aberto');
  const proximas = abertas
    .filter((p) => p.mes_vencimento <= proximo)
    .sort((a, b) => a.mes_vencimento.localeCompare(b.mes_vencimento) || b.valor - a.valor)
    .slice(0, 8);
  const renovar = contasParaRenovar(contas.lancamentos, contas.parcelas);
  const semCadastros = categorias.filter((c) => !c.excluido).length === 0;

  return (
    <>
      <header class="cabecalho">
        <h1>{APP.nome}</h1>
        <span class="sub">{fmtDataLonga.format(new Date())}</span>
      </header>
      <div class="conteudo">
        <div class="totais">
          <button class="total destaque botao-total" onClick={() => irPara('pagar')}>
            <span>A pagar em {formatarMesLongo(mes).split(' de ')[0].toLowerCase()}</span>
            <strong class="num">{formatarMoeda(somar(aPagar.map((p) => p.valor)))}</strong>
          </button>
          <div class="total">
            <span>Pago em {formatarMesLongo(mes).split(' de ')[0].toLowerCase()}</span>
            <strong class="num">{formatarMoeda(somar(pagoNoMes.map((p) => p.valor)))}</strong>
          </div>
          <button class="total botao-total" onClick={() => irPara('lancamentos')}>
            <span>Saldo devedor total</span>
            <strong class="num">{formatarMoeda(somar(abertas.map((p) => p.valor)))}</strong>
          </button>
        </div>

        {ehAdmin && extrasAdmin}

        <div class="colunas inicio">
          <section class="cartao">
            <h2>
              <IconePagar /> Próximos vencimentos
            </h2>
            {proximas.length === 0 ? (
              <p class="dica">Nada em aberto neste mês nem no próximo.</p>
            ) : (
              <ul class="lista compacta">
                {proximas.map((p) => {
                  const l = contas.porId.get(p.lancamento_id)!;
                  return (
                    <li key={p.id}>
                      <button class="linha-info linha-botao" onClick={() => abrirPainel({ tipo: 'conta', id: l.id })}>
                        <span>
                          <strong>{l.descricao}</strong>
                          <small>
                            {' '}
                            · {formatarMesCurto(p.mes_vencimento)} · {nomes.meio(l.meio_pagamento_id)}
                          </small>
                        </span>
                        <strong class="num">{formatarMoeda(p.valor)}</strong>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button class="link" onClick={() => irPara('pagar')}>
              Pagar parcelas →
            </button>
          </section>

          {renovar.length > 0 && (
            <section class="cartao">
              <h2>
                <IconeRepetir /> Renovações pendentes
              </h2>
              <ul class="lista compacta">
                {renovar.map(({ lancamento: l, abertas: n }) => (
                  <li key={l.id} class="linha-info">
                    <span>{l.descricao}</span>
                    <small>{n === 0 ? 'nenhuma em aberto' : `${n} em aberto`}</small>
                  </li>
                ))}
              </ul>
              <button class="link" onClick={() => irPara('recorrentes')}>
                Renovar →
              </button>
            </section>
          )}

          {semCadastros && (
            <section class="cartao">
              <h2>
                <IconeEtiqueta /> Primeiros passos
              </h2>
              <p class="dica">Comece pelos cadastros: categorias, meios de pagamento e pessoas. Depois, lance as contas no botão +.</p>
              <button class="link" onClick={() => irPara('cadastros')}>
                Ir para Cadastros →
              </button>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
