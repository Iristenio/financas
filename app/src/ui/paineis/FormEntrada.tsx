// Entrada de dinheiro na carteira (C2) — só Admin.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Entrada } from '../../dominio/tipos';
import { ID_ENTRADA_SALDO_INICIAL, novaEntrada, validarEntrada } from '../../dominio/carteira';
import { paraEscolha } from '../../dominio/cadastros';
import { hojeISO } from '../../dominio/datas';
import { buscar, novoId } from '../../dados/repositorio';
import { useEntidade } from '../../dados/ganchos';
import { excluirRegistro, salvarRegistro } from '../acoes/registros';
import { useEstado } from '../estado';
import { CampoValor, SeletorCadastro } from '../componentes/Campos';

export function FormEntrada({ id }: { id?: string }) {
  const { fecharPainel, avisar, perguntar, abrirPainel } = useEstado();
  const [e, setE] = useState<Entrada | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const foco = useRef<HTMLDivElement>(null);
  const novo = !id;
  const todasFontes = useEntidade('fontes');

  useEffect(() => {
    (async () => {
      const existente = id ? await buscar('entradas', id) : undefined;
      setE(existente ?? novaEntrada(novoId(), { data: hojeISO() }));
      if (!existente) setTimeout(() => foco.current?.querySelector('input')?.focus(), 80);
    })();
  }, [id]);

  if (!e) return null;
  const saldoInicial = e.id === ID_ENTRADA_SALDO_INICIAL;
  const fontes = paraEscolha(todasFontes.filter((f) => saldoInicial || f.id !== 'fonte-saldo-inicial'), e.fonte_id);
  const mudar = (parcial: Partial<Entrada>) => setE({ ...e, ...parcial });

  async function salvar(ev: Event) {
    ev.preventDefault();
    const final = { ...e!, descricao: e!.descricao.trim() };
    const problemas = validarEntrada(final);
    setErros(problemas);
    if (problemas.length) return;
    const desfazer = await salvarRegistro('entradas', final);
    fecharPainel();
    avisar({ texto: novo ? 'Entrada registrada' : 'Entrada salva', desfazer });
  }

  async function excluir() {
    const r = await perguntar('Excluir esta entrada?', [{ valor: 'sim', rotulo: 'Excluir', estilo: 'perigo' }]);
    if (!r) return;
    const desfazer = await excluirRegistro('entradas', e!);
    fecharPainel();
    avisar({ texto: 'Entrada excluída', desfazer });
  }

  return (
    <form class="formulario" onSubmit={salvar}>
      <div class="campo-rotulo valor-grande" ref={foco}>
        <span>Valor</span>
        <CampoValor valor={e.valor || null} aoMudar={(v) => mudar({ valor: v ?? 0 })} />
      </div>
      <label class="campo-rotulo">
        <span>De onde veio</span>
        <SeletorCadastro valor={e.fonte_id} aoMudar={(fonte_id) => mudar({ fonte_id })} opcoes={fontes} vazio="Escolha…" />
      </label>
      {!saldoInicial && (
        <button type="button" class="link link-esquerda" onClick={() => abrirPainel({ tipo: 'fonte' })}>
          + Cadastrar outra fonte
        </button>
      )}
      <label class="campo-rotulo">
        <span>Descrição (opcional)</span>
        <input class="campo" value={e.descricao} placeholder="Ex.: salário de setembro, Malurde pagou o fogão" onInput={(x) => mudar({ descricao: x.currentTarget.value })} />
      </label>
      <label class="campo-rotulo">
        <span>Data</span>
        <input class="campo" type="date" value={e.data} disabled={saldoInicial} onInput={(x) => mudar({ data: x.currentTarget.value })} />
      </label>
      {saldoInicial && <p class="dica">A data do saldo inicial é a data de início da carteira (muda em "Alterar início").</p>}
      {erros.length > 0 && (
        <ul class="erros" role="alert">
          {erros.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
      <div class="acoes-form">
        <button type="submit" class="botao primario">
          {novo ? 'Registrar entrada' : 'Salvar'}
        </button>
        {!novo && !saldoInicial && (
          <button type="button" class="botao perigo" onClick={excluir}>
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
