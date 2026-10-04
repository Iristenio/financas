// Campos reutilizáveis: valor em reais, mês/ano e escolha de cadastro.
import type preact from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { formatarNumero, lerValor } from '../../dominio/dinheiro';
import { NOMES_MESES } from '../../dominio/meses';

/**
 * Valor em reais digitado como texto ("1.234,56" ou "1234.56"). Chama aoMudar com o número (ou null)
 * a cada tecla; ao sair do campo, reescreve no formato brasileiro.
 */
export function CampoValor(props: { valor: number | null; aoMudar: (v: number | null) => void; placeholder?: string; desabilitado?: boolean; id?: string }) {
  const [texto, setTexto] = useState(props.valor === null ? '' : formatarNumero(props.valor));
  const [focado, setFocado] = useState(false);

  // Valor mudou por fora (ex.: calculado) e o campo não está sendo editado → mostra o novo
  useEffect(() => {
    if (!focado) setTexto(props.valor === null ? '' : formatarNumero(props.valor));
  }, [props.valor, focado]);

  return (
    <input
      id={props.id}
      class="campo valor"
      inputMode="decimal"
      placeholder={props.placeholder ?? '0,00'}
      value={texto}
      disabled={props.desabilitado}
      onFocus={() => setFocado(true)}
      onBlur={() => {
        setFocado(false);
        const v = lerValor(texto);
        setTexto(v === null ? '' : formatarNumero(v));
      }}
      onInput={(e) => {
        const t = e.currentTarget.value;
        setTexto(t);
        props.aoMudar(lerValor(t));
      }}
    />
  );
}

const anoAtual = new Date().getFullYear();

/** Mês e ano em dois seletores. Valor "AAAA-MM"; com permitirTodos, "" = todos os meses. */
export function SeletorMes(props: { valor: string; aoMudar: (v: string) => void; permitirTodos?: boolean; anos?: [number, number] }) {
  const [inicio, fim] = props.anos ?? [anoAtual - 3, anoAtual + 8];
  const [ano, mes] = props.valor ? props.valor.split('-') : ['', ''];
  const [anoEscolhido, setAnoEscolhido] = useState(ano || String(anoAtual));
  const anoFinal = ano || anoEscolhido;
  const anos = Array.from({ length: fim - inicio + 1 }, (_, i) => String(inicio + i));
  if (!anos.includes(anoFinal)) anos.push(anoFinal);

  return (
    <div class="linha">
      <select class="campo" aria-label="Mês" value={mes} onChange={(e) => props.aoMudar(e.currentTarget.value ? `${anoFinal}-${e.currentTarget.value}` : '')}>
        {props.permitirTodos && <option value="">Todos os meses</option>}
        {NOMES_MESES.map((nome, i) => (
          <option key={nome} value={String(i + 1).padStart(2, '0')}>
            {nome}
          </option>
        ))}
      </select>
      <select
        class="campo"
        aria-label="Ano"
        value={anoFinal}
        onChange={(e) => {
          setAnoEscolhido(e.currentTarget.value);
          if (mes) props.aoMudar(`${e.currentTarget.value}-${mes}`);
        }}
      >
        {anos.sort().map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Seletor de um cadastro (lista já filtrada e ordenada). */
export function SeletorCadastro(props: { valor: string; aoMudar: (v: string) => void; opcoes: { id: string; nome: string }[]; vazio?: string; rotulo?: string }) {
  return (
    <select class="campo" aria-label={props.rotulo} value={props.valor} onChange={(e) => props.aoMudar(e.currentTarget.value)}>
      {props.vazio !== undefined && <option value="">{props.vazio}</option>}
      {props.opcoes.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nome}
        </option>
      ))}
    </select>
  );
}

/** Os filtros estão iguais ao padrão da tela? (aí não há o que limpar) */
export const filtrosIguais = <T extends object>(a: T, b: T) => (Object.keys(b) as (keyof T)[]).every((k) => a[k] === b[k]);

/**
 * Área de filtros: no PC mostra tudo; no celular, os "extras" ficam atrás do botão "Mais filtros".
 * aoLimpar: quando informado (algum filtro diferente do padrão), mostra o botão "Limpar filtros".
 */
export function Filtros(props: { principais: preact.ComponentChildren; extras: preact.ComponentChildren; ativosExtras: number; aoLimpar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div class={`filtros${aberto ? ' abertos' : ''}`}>
      {props.principais}
      <button type="button" class="botao pequeno mais-filtros" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {aberto ? 'Menos filtros' : `Mais filtros${props.ativosExtras ? ` (${props.ativosExtras})` : ''}`}
      </button>
      {props.extras}
      {props.aoLimpar && (
        <button type="button" class="botao pequeno limpar-filtros" onClick={props.aoLimpar}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
