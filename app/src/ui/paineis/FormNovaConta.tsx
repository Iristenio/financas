// Nova conta (lançamento parcelado, retroativo, com rateio) — R1–R5.
import { useEffect, useState } from 'preact/hooks';
import { arred } from '../../dominio/dinheiro';
import { gerarConta, validarConta, type DadosConta } from '../../dominio/lancamentos';
import { paraEscolha } from '../../dominio/cadastros';
import { hojeISO } from '../../dominio/datas';
import { mesAtual } from '../../dominio/meses';
import { novoId, type Alteracao } from '../../dados/repositorio';
import { useEntidade } from '../../dados/ganchos';
import { gravarComDesfazer } from '../acoes/registros';
import { useEstado } from '../estado';
import { usePerfil } from '../perfil';
import { CampoValor, SeletorCadastro, SeletorMes } from '../componentes/Campos';
import { EditorRateio, novaLinha, rateioBate, type LinhaEdicao } from '../componentes/EditorRateio';

type ModoValor = 'total' | 'parcela';

export function FormNovaConta() {
  const { fecharPainel, avisar, abrirPainel } = useEstado();
  const { pessoa } = usePerfil();
  const categorias = paraEscolha(useEntidade('categorias'));
  const todosMeios = useEntidade('meios_pagamento');
  const meios = paraEscolha(todosMeios.filter((m) => m.tipo !== 'Pronto Pagamento'));
  const pessoas = paraEscolha(useEntidade('pessoas'));

  const [categoria, setCategoria] = useState('');
  const [meio, setMeio] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modo, setModo] = useState<ModoValor>('total');
  const [total, setTotal] = useState<number | null>(null);
  const [parcela, setParcela] = useState<number | null>(null);
  const [qtd, setQtd] = useState('1');
  const [data, setData] = useState(hojeISO());
  const [numeroAtual, setNumeroAtual] = useState('1');
  const [mes, setMes] = useState(mesAtual());
  const [recorrente, setRecorrente] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState<LinhaEdicao[]>(() => [novaLinha(pessoa?.id ?? '')]);
  const [erros, setErros] = useState<string[]>([]);

  const qtdNum = Math.max(1, Math.floor(Number(qtd) || 1));
  const valorTotal = modo === 'total' ? total ?? 0 : arred((parcela ?? 0) * qtdNum);
  const valorParcela = modo === 'parcela' ? parcela ?? 0 : qtdNum ? arred((total ?? 0) / qtdNum) : 0;

  // Pessoa do aparelho carregou depois? Preenche a 1ª linha se ainda estiver vazia.
  useEffect(() => {
    if (pessoa && linhas.length === 1 && !linhas[0].pessoa_id) setLinhas([{ ...linhas[0], pessoa_id: pessoa.id }]);
  }, [pessoa?.id]);

  // Com uma pessoa só, o valor dela acompanha o valor da parcela.
  useEffect(() => {
    if (linhas.length === 1 && linhas[0].valor !== valorParcela) setLinhas([{ ...linhas[0], valor: valorParcela || null }]);
  }, [valorParcela, linhas.length]);

  const dados = (): DadosConta => ({
    data,
    categoria_id: categoria,
    meio_pagamento_id: meio,
    descricao,
    observacao,
    recorrente,
    valorTotal,
    qtdParcelas: qtdNum,
    mesParcelaAtual: mes,
    numeroParcelaAtual: Math.floor(Number(numeroAtual) || 0),
    rateio: linhas.map((l) => ({ pessoa_id: l.pessoa_id, valorParcela: l.valor ?? 0 })),
  });

  async function salvar(e: Event) {
    e.preventDefault();
    const d = dados();
    const problemas = validarConta(d, todosMeios);
    setErros(problemas);
    if (problemas.length) return;
    const id = novoId();
    const conta = gerarConta(id, d);
    const alteracoes: Alteracao[] = [
      { entidade: 'lancamentos', registro: conta.lancamento },
      ...conta.rateios.map((r) => ({ entidade: 'rateios', registro: r }) as Alteracao),
      ...conta.parcelas.map((p) => ({ entidade: 'parcelas', registro: p }) as Alteracao),
    ];
    const desfazer = await gravarComDesfazer(alteracoes);
    fecharPainel();
    avisar({ texto: `Conta "${conta.lancamento.descricao}" lançada`, desfazer });
    // mantém a conta à vista para conferência no PC
    if (window.matchMedia('(min-width: 900px)').matches) abrirPainel({ tipo: 'conta', id });
  }

  const bate = rateioBate(linhas, valorTotal, qtdNum);

  return (
    <form class="formulario" onSubmit={salvar}>
      <div class="grade-2">
        <label class="campo-rotulo">
          <span>Categoria</span>
          <SeletorCadastro valor={categoria} aoMudar={setCategoria} opcoes={categorias} vazio="Escolha…" />
        </label>
        <label class="campo-rotulo">
          <span>Meio de pagamento</span>
          <SeletorCadastro valor={meio} aoMudar={setMeio} opcoes={meios} vazio="Escolha…" />
        </label>
      </div>

      <label class="campo-rotulo">
        <span>Descrição</span>
        <input class="campo" value={descricao} placeholder="Ex.: Geladeira" onInput={(e) => setDescricao(e.currentTarget.value)} />
      </label>

      <fieldset>
        <legend>Valor</legend>
        <div class="segmentado pequeno" role="radiogroup">
          <button
            type="button"
            role="radio"
            aria-checked={modo === 'total'}
            onClick={() => {
              setTotal(valorTotal || null);
              setModo('total');
            }}
          >
            Informar o total
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={modo === 'parcela'}
            onClick={() => {
              setParcela(valorParcela || null);
              setModo('parcela');
            }}
          >
            Informar a parcela
          </button>
        </div>
        <div class="grade-2">
          <label class="campo-rotulo">
            <span>Valor total</span>
            <CampoValor valor={modo === 'total' ? total : valorTotal || null} aoMudar={setTotal} desabilitado={modo !== 'total'} />
          </label>
          <label class="campo-rotulo">
            <span>Valor da parcela</span>
            <CampoValor valor={modo === 'parcela' ? parcela : valorParcela || null} aoMudar={setParcela} desabilitado={modo !== 'parcela'} />
          </label>
        </div>
      </fieldset>

      <div class="grade-2">
        <label class="campo-rotulo">
          <span>Qtd. parcelas</span>
          <input class="campo" type="number" inputMode="numeric" min={1} value={qtd} onInput={(e) => setQtd(e.currentTarget.value)} />
        </label>
        <label class="campo-rotulo">
          <span>Data da compra</span>
          <input class="campo" type="date" value={data} onInput={(e) => setData(e.currentTarget.value)} />
        </label>
      </div>

      <div class="grade-2">
        <label class="campo-rotulo">
          <span>Nº da parcela atual</span>
          <input class="campo" type="number" inputMode="numeric" min={1} max={qtdNum} value={numeroAtual} onInput={(e) => setNumeroAtual(e.currentTarget.value)} />
        </label>
        <div class="campo-rotulo">
          <span>Mês da parcela atual</span>
          <SeletorMes valor={mes} aoMudar={setMes} />
        </div>
      </div>
      <p class="dica">Se a compra já vem sendo paga, informe o número e o mês da parcela de agora — as anteriores entram como pagas.</p>

      <label class="interruptor">
        <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.currentTarget.checked)} />
        <span>
          Conta recorrente
          <br />
          <small>Assinatura ou conta fixa sem fim definido (pede renovação quando faltam 2 parcelas).</small>
        </span>
      </label>

      <label class="campo-rotulo">
        <span>Observação (opcional)</span>
        <input class="campo" value={observacao} onInput={(e) => setObservacao(e.currentTarget.value)} />
      </label>

      <EditorRateio linhas={linhas} aoMudar={setLinhas} pessoas={pessoas} valorTotal={valorTotal} qtdParcelas={qtdNum} />

      {erros.length > 0 && (
        <ul class="erros" role="alert">
          {erros.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}

      <div class="acoes-form">
        <button type="submit" class="botao primario" disabled={!bate}>
          Lançar conta
        </button>
      </div>
    </form>
  );
}
