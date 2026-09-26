// Detalhe de uma conta (painel lateral) e suas ações: editar (R6), ajustar valor (R7),
// antecipar (R8), excluir (R9) e pagar (R10). Toda ação oferece "Desfazer".
import { useState } from 'preact/hooks';
import type { Parcela } from '../../dominio/tipos';
import { formatarMoeda } from '../../dominio/dinheiro';
import { formatarData, formatarMesCurto } from '../../dominio/meses';
import { hojeISO } from '../../dominio/datas';
import { paraEscolha } from '../../dominio/cadastros';
import {
  ajustarValor,
  anteciparParcelas,
  editarConta,
  excluirConta,
  pagarParcelas,
  resumirConta,
  validarRateio,
  type ModoAjuste,
  type ModoRestante,
} from '../../dominio/lancamentos';
import type { Alteracao } from '../../dados/repositorio';
import { useEntidade } from '../../dados/ganchos';
import { gravarComDesfazer } from '../acoes/registros';
import { useEstado, type ModoConta } from '../estado';
import { useContas, useNomes } from '../dados';
import { CampoValor, SeletorCadastro } from '../componentes/Campos';
import { EditorRateio, novaLinha, rateioBate, type LinhaEdicao } from '../componentes/EditorRateio';

const alt = (entidade: Alteracao['entidade'], registro: unknown) => ({ entidade, registro }) as Alteracao;

export function DetalheConta({ id, modo = 'ver' }: { id: string; modo?: ModoConta }) {
  const contas = useContas();
  const lanc = contas.porId.get(id);
  if (!lanc) return <p class="dica">Esta conta não existe mais (foi excluída).</p>;
  switch (modo) {
    case 'editar':
      return <EditarConta id={id} />;
    case 'ajustar':
      return <AjustarValor id={id} />;
    case 'antecipar':
      return <Antecipar id={id} />;
    default:
      return <VerConta id={id} />;
  }
}

/* ---------------- Ver ---------------- */

function VerConta({ id }: { id: string }) {
  const { abrirPainel, fecharPainel, avisar, perguntar } = useEstado();
  const contas = useContas();
  const nomes = useNomes();
  const lanc = contas.porId.get(id)!;
  const parcelas = contas.parcelas.get(id) ?? [];
  const rateios = contas.rateios.get(id) ?? [];
  const r = resumirConta(parcelas, rateios);
  const abertas = parcelas.filter((p) => p.status === 'Aberto');

  async function pagar(p: Parcela) {
    const desfazer = await gravarComDesfazer(pagarParcelas([p], hojeISO()).map((x) => alt('parcelas', x)));
    avisar({ texto: `Parcela ${p.numero} paga hoje`, desfazer });
  }

  async function excluir() {
    const temPagas = r.pagas > 0;
    const escolha = await perguntar(
      `Excluir "${lanc.descricao}"?`,
      [
        ...(temPagas && abertas.length ? [{ valor: 'abertas' as const, rotulo: 'Só as parcelas abertas' }] : []),
        { valor: 'tudo' as const, rotulo: 'Excluir tudo', estilo: 'perigo' as const },
      ],
      temPagas && abertas.length ? '"Só as abertas" mantém o histórico das parcelas já pagas.' : undefined,
    );
    if (!escolha) return;
    const x = excluirConta(lanc, parcelas, rateios, escolha);
    const desfazer = await gravarComDesfazer([
      ...(x.lancamento ? [{ ...alt('lancamentos', x.lancamento), operacao: 'excluir' as const }] : []),
      ...x.parcelas.map((p) => ({ ...alt('parcelas', p), operacao: 'excluir' as const })),
      ...x.rateios.map((rt) => ({ ...alt('rateios', rt), operacao: 'excluir' as const })),
    ]);
    if (x.lancamento) fecharPainel();
    avisar({ texto: x.lancamento ? 'Conta excluída' : 'Parcelas abertas excluídas', desfazer });
  }

  return (
    <div class="detalhe-conta">
      <div class="detalhe-topo">
        <h3>{lanc.descricao}</h3>
        <p class="dica">
          {nomes.categoria(lanc.categoria_id)} · {nomes.meio(lanc.meio_pagamento_id)} · compra em {formatarData(lanc.data)}
          {lanc.recorrente && (
            <>
              {' '}
              <span class="selo primario">Recorrente</span>
            </>
          )}
        </p>
        {lanc.observacao && <p class="dica">Obs.: {lanc.observacao}</p>}
      </div>

      <div class="totais compactos">
        <div class="total">
          <span>Valor total</span>
          <strong class="num">{formatarMoeda(r.valorTotal)}</strong>
        </div>
        <div class="total">
          <span>
            Pago ({r.pagas}/{r.qtdParcelas})
          </span>
          <strong class="num">{formatarMoeda(r.valorPago)}</strong>
        </div>
        <div class="total destaque">
          <span>Saldo devedor</span>
          <strong class="num">{formatarMoeda(r.saldoDevedor)}</strong>
        </div>
      </div>

      <h4 class="secao-titulo">Por pessoa</h4>
      <ul class="lista compacta">
        {r.porPessoa.map((p) => (
          <li key={p.pessoa_id} class="linha-info">
            <span>
              <strong>{nomes.pessoa(p.pessoa_id)}</strong>
              <small> · {Math.round(p.percentual * 1000) / 10}%</small>
            </span>
            <span class="num">
              {formatarMoeda(p.total)} · pago {formatarMoeda(p.pago)} · <strong>deve {formatarMoeda(p.saldo)}</strong>
            </span>
          </li>
        ))}
      </ul>

      <h4 class="secao-titulo">Parcelas</h4>
      <ul class="lista compacta">
        {parcelas.map((p) => (
          <li key={p.id} class="linha-info">
            <span class="num">
              <strong>
                Nº{p.numero}/{r.qtdParcelas}
              </strong>{' '}
              · {formatarMesCurto(p.mes_vencimento)} · {formatarMoeda(p.valor)}
            </span>
            {p.status === 'Pago' ? (
              <span class="selo sucesso">Pago {p.data_pagamento ? `em ${formatarData(p.data_pagamento)}` : '(sem data)'}</span>
            ) : (
              <button class="botao pequeno" onClick={() => pagar(p)}>
                Pagar hoje
              </button>
            )}
          </li>
        ))}
      </ul>

      <div class="acoes-form acoes-detalhe">
        <button class="botao" onClick={() => abrirPainel({ tipo: 'conta', id, modo: 'editar' })}>
          Editar
        </button>
        <button class="botao" onClick={() => abrirPainel({ tipo: 'conta', id, modo: 'ajustar' })}>
          Ajustar
        </button>
        {abertas.length > 0 && (
          <button class="botao" onClick={() => abrirPainel({ tipo: 'conta', id, modo: 'antecipar' })}>
            Antecipar
          </button>
        )}
        <button class="botao perigo" onClick={excluir}>
          Excluir
        </button>
      </div>
    </div>
  );
}

function Voltar({ id }: { id: string }) {
  const { abrirPainel } = useEstado();
  return (
    <button type="button" class="botao" onClick={() => abrirPainel({ tipo: 'conta', id })}>
      Voltar
    </button>
  );
}

function Erros({ erros }: { erros: string[] }) {
  if (!erros.length) return null;
  return (
    <ul class="erros" role="alert">
      {erros.map((x) => <li key={x}>{x}</li>)}
    </ul>
  );
}

/* ---------------- Editar (R6) ---------------- */

function EditarConta({ id }: { id: string }) {
  const { abrirPainel, avisar } = useEstado();
  const contas = useContas();
  const lanc = contas.porId.get(id)!;
  const parcelas = contas.parcelas.get(id) ?? [];
  const rateios = contas.rateios.get(id) ?? [];
  const r = resumirConta(parcelas, rateios);
  const categorias = paraEscolha(useEntidade('categorias'), lanc.categoria_id);
  const meios = paraEscolha(useEntidade('meios_pagamento').filter((m) => m.tipo !== 'Pronto Pagamento'), lanc.meio_pagamento_id);
  const pessoas = paraEscolha(useEntidade('pessoas'));

  const [categoria, setCategoria] = useState(lanc.categoria_id);
  const [meio, setMeio] = useState(lanc.meio_pagamento_id);
  const [descricao, setDescricao] = useState(lanc.descricao);
  const [observacao, setObservacao] = useState(lanc.observacao);
  const [linhas, setLinhas] = useState<LinhaEdicao[]>(() =>
    r.porPessoa.map((p) => novaLinha(p.pessoa_id, r.qtdParcelas ? Math.round((p.total / r.qtdParcelas) * 100) / 100 : 0)),
  );
  const [erros, setErros] = useState<string[]>([]);

  async function salvar(e: Event) {
    e.preventDefault();
    const rateio = linhas.map((l) => ({ pessoa_id: l.pessoa_id, valorParcela: l.valor ?? 0 }));
    const problemas = [...(descricao.trim() ? [] : ['Informe a descrição.']), ...validarRateio(rateio, r.valorTotal, r.qtdParcelas)];
    setErros(problemas);
    if (problemas.length) return;
    const x = editarConta(lanc, rateios, { categoria_id: categoria, meio_pagamento_id: meio, descricao, observacao, rateio }, r.qtdParcelas);
    const desfazer = await gravarComDesfazer([alt('lancamentos', x.lancamento), ...x.rateios.map((rt) => alt('rateios', rt))]);
    abrirPainel({ tipo: 'conta', id });
    avisar({ texto: 'Conta salva', desfazer });
  }

  return (
    <form class="formulario" onSubmit={salvar}>
      <p class="dica">
        Editando <strong>{lanc.descricao}</strong>. Valor e parcelas mudam por "Ajustar valor" ou "Antecipar".
      </p>
      <div class="grade-2">
        <label class="campo-rotulo">
          <span>Categoria</span>
          <SeletorCadastro valor={categoria} aoMudar={setCategoria} opcoes={categorias} />
        </label>
        <label class="campo-rotulo">
          <span>Meio de pagamento</span>
          <SeletorCadastro valor={meio} aoMudar={setMeio} opcoes={meios} />
        </label>
      </div>
      <label class="campo-rotulo">
        <span>Descrição</span>
        <input class="campo" value={descricao} onInput={(e) => setDescricao(e.currentTarget.value)} />
      </label>
      <label class="campo-rotulo">
        <span>Observação</span>
        <input class="campo" value={observacao} onInput={(e) => setObservacao(e.currentTarget.value)} />
      </label>
      <EditorRateio linhas={linhas} aoMudar={setLinhas} pessoas={pessoas} valorTotal={r.valorTotal} qtdParcelas={r.qtdParcelas} />
      <Erros erros={erros} />
      <div class="acoes-form">
        <button type="submit" class="botao primario" disabled={!rateioBate(linhas, r.valorTotal, r.qtdParcelas)}>
          Salvar
        </button>
        <Voltar id={id} />
      </div>
    </form>
  );
}

/* ---------------- Ajustar valor (R7) ---------------- */

function AjustarValor({ id }: { id: string }) {
  const { abrirPainel, avisar } = useEstado();
  const contas = useContas();
  const parcelas = contas.parcelas.get(id) ?? [];
  const abertas = parcelas.filter((p) => p.status === 'Aberto');
  const [numero, setNumero] = useState(String(abertas[0]?.numero ?? ''));
  const [valor, setValor] = useState<number | null>(null);
  const [modo, setModo] = useState<ModoAjuste>(abertas.length ? 'apenasEsta' : 'todas');
  const [erros, setErros] = useState<string[]>([]);

  const alvo = valor ? ajustarValor(parcelas, Number(numero), valor, modo) : [];

  async function salvar(e: Event) {
    e.preventDefault();
    const problemas = [...(valor && valor > 0 ? [] : ['Informe o novo valor.']), ...(valor && !alvo.length ? ['Nenhuma parcela para ajustar.'] : [])];
    setErros(problemas);
    if (problemas.length) return;
    const desfazer = await gravarComDesfazer(alvo.map((p) => alt('parcelas', p)));
    abrirPainel({ tipo: 'conta', id });
    avisar({ texto: `${alvo.length} parcela${alvo.length > 1 ? 's' : ''} ajustada${alvo.length > 1 ? 's' : ''}`, desfazer });
  }

  const opcoes: [ModoAjuste, string, string][] = [
    ['apenasEsta', 'Só nesta parcela', 'Ex.: conta que variou em um mês'],
    ['emDiante', 'Nesta e nas seguintes', 'Ex.: reajuste permanente (só parcelas abertas)'],
    ['todas', 'Em todas, inclusive as pagas', 'Ex.: valor lançado errado desde o início'],
  ];

  return (
    <form class="formulario" onSubmit={salvar}>
      <fieldset>
        <legend>Aplicar</legend>
        <div class="opcoes-lista">
          {opcoes.map(([v, rotulo, dica]) => (
            <label key={v} class={`opcao${modo === v ? ' marcada' : ''}`}>
              <input type="radio" name="modo" checked={modo === v} disabled={v !== 'todas' && !abertas.length} onChange={() => setModo(v)} />
              <span>
                <strong>{rotulo}</strong>
                <small>{dica}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {modo !== 'todas' && (
        <label class="campo-rotulo">
          <span>{modo === 'apenasEsta' ? 'Parcela' : 'A partir da parcela'}</span>
          <select class="campo" value={numero} onChange={(e) => setNumero(e.currentTarget.value)}>
            {abertas.map((p) => (
              <option key={p.id} value={p.numero}>
                Nº{p.numero} · {formatarMesCurto(p.mes_vencimento)} · {formatarMoeda(p.valor)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label class="campo-rotulo">
        <span>Novo valor da parcela</span>
        <CampoValor valor={valor} aoMudar={setValor} />
      </label>
      {alvo.length > 0 && <p class="dica">Vai alterar {alvo.length} parcela{alvo.length > 1 ? 's' : ''}.</p>}
      <Erros erros={erros} />
      <div class="acoes-form">
        <button type="submit" class="botao primario">
          Aplicar ajuste
        </button>
        <Voltar id={id} />
      </div>
    </form>
  );
}

/* ---------------- Antecipar (R8) ---------------- */

function Antecipar({ id }: { id: string }) {
  const { abrirPainel, avisar } = useEstado();
  const contas = useContas();
  const lanc = contas.porId.get(id)!;
  const parcelas = contas.parcelas.get(id) ?? [];
  const abertas = parcelas.filter((p) => p.status === 'Aberto');
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [data, setData] = useState(hojeISO());
  const [modo, setModo] = useState<ModoRestante>('manter');
  const [observacao, setObservacao] = useState('');
  const [erros, setErros] = useState<string[]>([]);

  const alternar = (pid: string) => setEscolhidas((l) => (l.includes(pid) ? l.filter((x) => x !== pid) : [...l, pid]));

  async function salvar(e: Event) {
    e.preventDefault();
    const problemas = [...(escolhidas.length ? [] : ['Escolha ao menos uma parcela.']), ...(data ? [] : ['Informe a data do pagamento.'])];
    setErros(problemas);
    if (problemas.length) return;
    const mudadas = anteciparParcelas(parcelas, escolhidas, data, modo);
    const desfazer = await gravarComDesfazer([
      ...mudadas.map((p) => alt('parcelas', p)),
      ...(observacao.trim() ? [alt('lancamentos', { ...lanc, observacao: observacao.trim() })] : []),
    ]);
    abrirPainel({ tipo: 'conta', id });
    avisar({ texto: `${escolhidas.length} parcela${escolhidas.length > 1 ? 's' : ''} antecipada${escolhidas.length > 1 ? 's' : ''}`, desfazer });
  }

  return (
    <form class="formulario" onSubmit={salvar}>
      <fieldset>
        <legend>Parcelas a antecipar</legend>
        <div class="opcoes-lista">
          {abertas.map((p) => (
            <label key={p.id} class={`opcao${escolhidas.includes(p.id) ? ' marcada' : ''}`}>
              <input type="checkbox" checked={escolhidas.includes(p.id)} onChange={() => alternar(p.id)} />
              <span class="num">
                Nº{p.numero} · {formatarMesCurto(p.mes_vencimento)} · {formatarMoeda(p.valor)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label class="campo-rotulo">
        <span>Data do pagamento</span>
        <input class="campo" type="date" value={data} onInput={(e) => setData(e.currentTarget.value)} />
      </label>
      <fieldset>
        <legend>As parcelas que ficam em aberto</legend>
        <div class="segmentado pequeno" role="radiogroup">
          <button type="button" role="radio" aria-checked={modo === 'manter'} onClick={() => setModo('manter')}>
            Manter as datas
          </button>
          <button type="button" role="radio" aria-checked={modo === 'comprimir'} onClick={() => setModo('comprimir')}>
            Comprimir
          </button>
        </div>
        <p class="dica">{modo === 'manter' ? 'Continuam vencendo nos meses originais.' : 'Passam a vencer em meses seguidos a partir do mês seguinte ao pagamento, sem buraco.'}</p>
      </fieldset>
      <label class="campo-rotulo">
        <span>Observação (opcional)</span>
        <input class="campo" value={observacao} placeholder="Ex.: paguei adiantado com o 13º" onInput={(e) => setObservacao(e.currentTarget.value)} />
      </label>
      <Erros erros={erros} />
      <div class="acoes-form">
        <button type="submit" class="botao primario">
          Antecipar {escolhidas.length ? `(${escolhidas.length})` : ''}
        </button>
        <Voltar id={id} />
      </div>
    </form>
  );
}
