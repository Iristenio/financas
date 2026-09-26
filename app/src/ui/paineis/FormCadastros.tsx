// Formulários dos cadastros (painel lateral): categoria, meio de pagamento, pessoa e fonte da carteira.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Categoria, Entidade, Fonte, MeioPagamento, Pessoa } from '../../dominio/tipos';
import { TIPOS_MEIO, TIPOS_PESSOA } from '../../dominio/tipos';
import {
  novaCategoria,
  novaFonte,
  novaPessoa,
  novoMeio,
  normalizarPessoa,
  usosCategoria,
  usosFonte,
  usosMeio,
  usosPessoa,
  validarMeio,
  validarNome,
  validarPessoa,
  type BaseUso,
} from '../../dominio/cadastros';
import { buscar, novoId, type MapaEntidades } from '../../dados/repositorio';
import { useEntidade } from '../../dados/ganchos';
import { excluirRegistro, salvarRegistro } from '../acoes/registros';
import { useEstado } from '../estado';

export function useBaseUso(): BaseUso {
  return {
    lancamentos: useEntidade('lancamentos'),
    rateios: useEntidade('rateios'),
    gastos: useEntidade('gastos_rotineiros'),
    entradas: useEntidade('entradas'),
  };
}

/** Carrega o registro (ou cria um novo) e cuida de salvar/excluir com "Desfazer". */
function useFormRegistro<E extends Exclude<Entidade, 'carteira_config'>>(
  entidade: E,
  id: string | undefined,
  criar: (id: string) => MapaEntidades[E],
  rotulo: { novo: string; salvo: string; excluido: string },
) {
  const { fecharPainel, avisar, perguntar } = useEstado();
  const [reg, setReg] = useState<MapaEntidades[E] | null>(null);
  const [erros, setErros] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const existente = id ? await buscar(entidade, id) : undefined;
      setReg(existente ?? criar(novoId()));
      setErros([]);
    })();
  }, [id]);

  const mudar = (parcial: Partial<MapaEntidades[E]>) => setReg((r) => (r ? { ...r, ...parcial } : r));

  async function salvar(final: MapaEntidades[E], problemas: string[]) {
    setErros(problemas);
    if (problemas.length) return;
    const desfazer = await salvarRegistro(entidade, final);
    fecharPainel();
    avisar({ texto: id ? rotulo.salvo : rotulo.novo, desfazer });
  }

  async function excluir() {
    if (!reg) return;
    const r = await perguntar(`Excluir "${(reg as { nome: string }).nome}"?`, [{ valor: 'sim', rotulo: 'Excluir', estilo: 'perigo' }]);
    if (!r) return;
    const desfazer = await excluirRegistro(entidade, reg);
    fecharPainel();
    avisar({ texto: rotulo.excluido, desfazer });
  }

  return { reg, mudar, erros, salvar, excluir, novo: !id };
}

function Erros({ erros }: { erros: string[] }) {
  if (!erros.length) return null;
  return (
    <ul class="erros" role="alert">
      {erros.map((x) => <li key={x}>{x}</li>)}
    </ul>
  );
}

function CampoAtivo({ ativo, aoMudar, rotulo }: { ativo: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <label class="interruptor">
      <input type="checkbox" checked={ativo} onChange={(e) => aoMudar(e.currentTarget.checked)} />
      <span>
        {rotulo}
        <br />
        <small>Inativos não aparecem para escolha nos formulários, mas continuam no histórico.</small>
      </span>
    </label>
  );
}

/** Rodapé com Salvar e Excluir (só quando nunca foi usado — R17). */
function Acoes({ novo, usos, aoExcluir, extra }: { novo: boolean; usos: number; aoExcluir: () => void; extra?: ComponentChildren }) {
  return (
    <>
      {!novo && usos > 0 && (
        <p class="dica">
          Usado em {usos} registro{usos > 1 ? 's' : ''} — não pode ser excluído. Para tirar das listas, desative.
        </p>
      )}
      {extra}
      <div class="acoes-form">
        <button type="submit" class="botao primario">{novo ? 'Cadastrar' : 'Salvar'}</button>
        {!novo && usos === 0 && (
          <button type="button" class="botao perigo" onClick={aoExcluir}>
            Excluir
          </button>
        )}
      </div>
    </>
  );
}

function useFoco(ativo: boolean) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ativo) setTimeout(() => ref.current?.focus(), 60);
  }, [ativo]);
  return ref;
}

/* ---------------- Categoria ---------------- */

export function FormCategoria({ id }: { id?: string }) {
  const lista = useEntidade('categorias');
  const uso = useBaseUso();
  const f = useFormRegistro('categorias', id, (novo) => novaCategoria(novo), { novo: 'Categoria cadastrada', salvo: 'Categoria salva', excluido: 'Categoria excluída' });
  const foco = useFoco(f.novo && !!f.reg);
  if (!f.reg) return null;
  const c = f.reg as Categoria;

  return (
    <form
      class="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        const final = { ...c, nome: c.nome.trim() };
        f.salvar(final, validarNome(final.nome, lista, c.id, 'uma categoria'));
      }}
    >
      <label class="campo-rotulo">
        <span>Nome</span>
        <input ref={foco} class="campo" value={c.nome} onInput={(e) => f.mudar({ nome: e.currentTarget.value })} />
      </label>
      {!f.novo && <CampoAtivo rotulo="Ativa" ativo={c.ativo} aoMudar={(ativo) => f.mudar({ ativo })} />}
      <Erros erros={f.erros} />
      <Acoes novo={f.novo} usos={usosCategoria(c.id, uso)} aoExcluir={f.excluir} />
    </form>
  );
}

/* ---------------- Meio de pagamento ---------------- */

const lerDia = (texto: string) => (texto.trim() === '' ? null : Number(texto));

export function FormMeio({ id }: { id?: string }) {
  const lista = useEntidade('meios_pagamento');
  const uso = useBaseUso();
  const f = useFormRegistro('meios_pagamento', id, (novo) => novoMeio(novo), { novo: 'Meio de pagamento cadastrado', salvo: 'Meio de pagamento salvo', excluido: 'Meio de pagamento excluído' });
  const foco = useFoco(f.novo && !!f.reg);
  if (!f.reg) return null;
  const m = f.reg as MeioPagamento;

  return (
    <form
      class="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        const final = { ...m, nome: m.nome.trim() };
        f.salvar(final, validarMeio(final, lista));
      }}
    >
      <label class="campo-rotulo">
        <span>Nome</span>
        <input ref={foco} class="campo" value={m.nome} placeholder="Ex.: Nubank, Débito em conta" onInput={(e) => f.mudar({ nome: e.currentTarget.value })} />
      </label>
      <fieldset>
        <legend>Tipo</legend>
        <div class="chips">
          {TIPOS_MEIO.map((t) => (
            <button key={t} type="button" class="chip" aria-pressed={m.tipo === t} onClick={() => f.mudar({ tipo: t })}>
              {t}
            </button>
          ))}
        </div>
        <p class="dica">
          {m.tipo === 'Pronto Pagamento'
            ? 'Dinheiro, Pix, débito na hora — usado nos Gastos do dia a dia.'
            : 'Usado nas contas de Lançamentos (compõe fatura ou conta fixa).'}
        </p>
      </fieldset>
      {m.tipo !== 'Pronto Pagamento' && (
        <div class="grade-2">
          <label class="campo-rotulo">
            <span>Dia de fechamento</span>
            <input class="campo" type="number" inputMode="numeric" min={1} max={31} value={m.dia_fechamento ?? ''} onInput={(e) => f.mudar({ dia_fechamento: lerDia(e.currentTarget.value) })} />
          </label>
          <label class="campo-rotulo">
            <span>Dia de vencimento</span>
            <input class="campo" type="number" inputMode="numeric" min={1} max={31} value={m.dia_vencimento ?? ''} onInput={(e) => f.mudar({ dia_vencimento: lerDia(e.currentTarget.value) })} />
          </label>
        </div>
      )}
      {!f.novo && <CampoAtivo rotulo="Ativo" ativo={m.ativo} aoMudar={(ativo) => f.mudar({ ativo })} />}
      <Erros erros={f.erros} />
      <Acoes novo={f.novo} usos={usosMeio(m.id, uso)} aoExcluir={f.excluir} />
    </form>
  );
}

/* ---------------- Pessoa ---------------- */

export function FormPessoa({ id }: { id?: string }) {
  const lista = useEntidade('pessoas');
  const uso = useBaseUso();
  const f = useFormRegistro('pessoas', id, (novo) => novaPessoa(novo), { novo: 'Pessoa cadastrada', salvo: 'Pessoa salva', excluido: 'Pessoa excluída' });
  const foco = useFoco(f.novo && !!f.reg);
  if (!f.reg) return null;
  const p = f.reg as Pessoa;

  return (
    <form
      class="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        const final = normalizarPessoa(p);
        f.salvar(final, validarPessoa(final, lista));
      }}
    >
      <label class="campo-rotulo">
        <span>Nome</span>
        <input ref={foco} class="campo" value={p.nome} onInput={(e) => f.mudar({ nome: e.currentTarget.value })} />
      </label>
      <fieldset>
        <legend>Tipo</legend>
        <div class="chips">
          {TIPOS_PESSOA.map((t) => (
            <button key={t} type="button" class="chip" aria-pressed={p.tipo === t} onClick={() => f.mudar({ tipo: t, papel: t === 'Membro do Domicílio' ? p.papel ?? 'Colaborador' : null })}>
              {t}
            </button>
          ))}
        </div>
        <p class="dica">
          {p.tipo === 'Membro do Domicílio'
            ? 'Mora na casa e usa o app.'
            : p.tipo === 'Terceiro Monitorado'
              ? 'Conta de outra pessoa que vocês acompanham (fora dos gastos da casa).'
              : 'Compra no cartão de vocês — a parte dela é dinheiro a receber.'}
        </p>
      </fieldset>
      {p.tipo === 'Membro do Domicílio' && (
        <fieldset>
          <legend>Papel no app</legend>
          <div class="segmentado" role="radiogroup">
            {(['Admin', 'Colaborador'] as const).map((papel) => (
              <button key={papel} type="button" role="radio" aria-checked={p.papel === papel} onClick={() => f.mudar({ papel })}>
                {papel}
              </button>
            ))}
          </div>
          <p class="dica">O Colaborador não vê Gastos nem Carteira.</p>
        </fieldset>
      )}
      {!f.novo && <CampoAtivo rotulo="Ativa" ativo={p.ativo} aoMudar={(ativo) => f.mudar({ ativo })} />}
      <Erros erros={f.erros} />
      <Acoes novo={f.novo} usos={usosPessoa(p.id, uso)} aoExcluir={f.excluir} />
    </form>
  );
}

/* ---------------- Fonte (Carteira) ---------------- */

export function FormFonte({ id }: { id?: string }) {
  const lista = useEntidade('fontes');
  const uso = useBaseUso();
  const f = useFormRegistro('fontes', id, (novo) => novaFonte(novo), { novo: 'Fonte cadastrada', salvo: 'Fonte salva', excluido: 'Fonte excluída' });
  const foco = useFoco(f.novo && !!f.reg);
  if (!f.reg) return null;
  const fonte = f.reg as Fonte;

  return (
    <form
      class="formulario"
      onSubmit={(e) => {
        e.preventDefault();
        const final = { ...fonte, nome: fonte.nome.trim() };
        f.salvar(final, validarNome(final.nome, lista, fonte.id, 'uma fonte'));
      }}
    >
      <label class="campo-rotulo">
        <span>Nome</span>
        <input ref={foco} class="campo" value={fonte.nome} placeholder="Ex.: Salário Paulo" onInput={(e) => f.mudar({ nome: e.currentTarget.value })} />
      </label>
      {!f.novo && <CampoAtivo rotulo="Ativa" ativo={fonte.ativo} aoMudar={(ativo) => f.mudar({ ativo })} />}
      <Erros erros={f.erros} />
      <Acoes novo={f.novo} usos={usosFonte(fonte.id, uso)} aoExcluir={f.excluir} />
    </form>
  );
}
