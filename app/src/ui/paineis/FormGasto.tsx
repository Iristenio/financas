// Gasto do dia a dia (dinheiro, Pix, débito na hora) — só Admin.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GastoRotineiro } from '../../dominio/tipos';
import { novoGasto, validarGasto } from '../../dominio/gastos';
import { paraEscolha } from '../../dominio/cadastros';
import { hojeISO } from '../../dominio/datas';
import { buscar, novoId } from '../../dados/repositorio';
import { useEntidade } from '../../dados/ganchos';
import { excluirRegistro, salvarRegistro } from '../acoes/registros';
import { useEstado } from '../estado';
import { usePerfil } from '../perfil';
import { CampoValor, SeletorCadastro } from '../componentes/Campos';

export function FormGasto({ id }: { id?: string }) {
  const { fecharPainel, avisar, perguntar } = useEstado();
  const { pessoa } = usePerfil();
  const todosMeios = useEntidade('meios_pagamento');
  const todasPessoas = useEntidade('pessoas');
  const todasCategorias = useEntidade('categorias');
  const [g, setG] = useState<GastoRotineiro | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const foco = useRef<HTMLDivElement>(null);
  const novo = !id;

  useEffect(() => {
    (async () => {
      const existente = id ? await buscar('gastos_rotineiros', id) : undefined;
      setG(existente ?? novoGasto(novoId(), { data: hojeISO(), pessoa_id: pessoa?.id ?? '' }));
      if (!existente) setTimeout(() => foco.current?.querySelector('input')?.focus(), 80);
    })();
  }, [id]);

  // Pessoa do aparelho carregou depois de abrir o formulário? Preenche se ainda estiver vazio.
  useEffect(() => {
    if (g && !g.pessoa_id && pessoa && !id) setG({ ...g, pessoa_id: pessoa.id });
  }, [pessoa?.id, !!g]);

  if (!g) return null;
  const categorias = paraEscolha(todasCategorias, g.categoria_id);
  const meios = paraEscolha(todosMeios.filter((m) => m.tipo === 'Pronto Pagamento'), g.meio_pagamento_id);
  const membros = paraEscolha(todasPessoas.filter((p) => p.tipo === 'Membro do Domicílio'), g.pessoa_id);
  const mudar = (parcial: Partial<GastoRotineiro>) => setG({ ...g, ...parcial });

  async function salvar(e: Event) {
    e.preventDefault();
    const final = { ...g!, descricao: g!.descricao.trim() };
    const problemas = validarGasto(final, todosMeios, todasPessoas);
    setErros(problemas);
    if (problemas.length) return;
    const desfazer = await salvarRegistro('gastos_rotineiros', final);
    fecharPainel();
    avisar({ texto: novo ? 'Gasto lançado' : 'Gasto salvo', desfazer });
  }

  async function excluir() {
    const r = await perguntar('Excluir este gasto?', [{ valor: 'sim', rotulo: 'Excluir', estilo: 'perigo' }]);
    if (!r) return;
    const desfazer = await excluirRegistro('gastos_rotineiros', g!);
    fecharPainel();
    avisar({ texto: 'Gasto excluído', desfazer });
  }

  return (
    <form class="formulario" onSubmit={salvar}>
      <div class="campo-rotulo valor-grande" ref={foco}>
        <span>Valor</span>
        <CampoValor valor={g.valor || null} aoMudar={(v) => mudar({ valor: v ?? 0 })} />
      </div>
      <label class="campo-rotulo">
        <span>Categoria</span>
        <SeletorCadastro valor={g.categoria_id} aoMudar={(categoria_id) => mudar({ categoria_id })} opcoes={categorias} vazio="Escolha…" />
      </label>
      <div class="grade-2">
        <label class="campo-rotulo">
          <span>Meio de pagamento</span>
          <SeletorCadastro valor={g.meio_pagamento_id} aoMudar={(meio_pagamento_id) => mudar({ meio_pagamento_id })} opcoes={meios} vazio="Escolha…" />
        </label>
        <label class="campo-rotulo">
          <span>Quem gastou</span>
          <SeletorCadastro valor={g.pessoa_id} aoMudar={(pessoa_id) => mudar({ pessoa_id })} opcoes={membros} vazio="Escolha…" />
        </label>
      </div>
      <label class="campo-rotulo">
        <span>Descrição (opcional)</span>
        <input class="campo" value={g.descricao} placeholder="Ex.: mercado do mês" onInput={(e) => mudar({ descricao: e.currentTarget.value })} />
      </label>
      <label class="campo-rotulo">
        <span>Data</span>
        <input class="campo" type="date" value={g.data} onInput={(e) => mudar({ data: e.currentTarget.value })} />
      </label>
      {erros.length > 0 && (
        <ul class="erros" role="alert">
          {erros.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
      <div class="acoes-form">
        <button type="submit" class="botao primario">
          {novo ? 'Lançar gasto' : 'Salvar'}
        </button>
        {!novo && (
          <button type="button" class="botao perigo" onClick={excluir}>
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
