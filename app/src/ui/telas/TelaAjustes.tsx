// Tela Ajustes: conexão com o Google, preferências e informações do aparelho.
import { useEffect, useState } from 'preact/hooks';
import type { Config } from '../../dominio/tipos';
import { salvarConfig } from '../../dados/repositorio';
import { useConfig, useEntidade } from '../../dados/ganchos';
import { paraEscolha } from '../../dominio/cadastros';
import { usePerfil } from '../perfil';
import { lerTema, salvarTema, type Tema } from '../tema';
import { importarDoAppAntigo, type ResultadoImportacao } from '../acoes/importar';
import { baixarTudo, conectar, desconectar, ErroApi, sincronizar } from '../../sync/motor';
import { APP } from '../../app.config';
import { descreverUltimaSync, ROTULO_STATUS, useSync } from '../../sync/ganchos';
import { useEstado } from '../estado';

export function TelaAjustes() {
  return (
    <>
      <header class="cabecalho">
        <h1>Ajustes</h1>
      </header>
      <div class="conteudo ajustes">
        <CartaoGoogle />
        <CartaoPreferencias />
        <CartaoAparencia />
        <CartaoImportar />
        <CartaoAparelho />
      </div>
    </>
  );
}

/* ---------------- Conexão com o Google ---------------- */

function CartaoGoogle() {
  const sync = useSync();
  const { avisar, perguntar } = useEstado();
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [, forcarRelogio] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forcarRelogio((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  async function aoConectar(e: Event) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    try {
      await conectar(codigo);
      setCodigo('');
      avisar({ texto: 'Conectado ao Google! Seus dados estão sendo enviados à planilha.' });
    } catch (x) {
      setErro(x instanceof ErroApi ? x.message : 'Não foi possível conectar.');
    } finally {
      setOcupado(false);
    }
  }

  async function aoDesconectar() {
    const r = await perguntar(
      'Desconectar deste aparelho?',
      [{ valor: 'sim', rotulo: 'Desconectar', estilo: 'perigo' }],
      'Os dados continuam aqui e na planilha. Alterações feitas depois ficarão só neste aparelho até conectar de novo.',
    );
    if (r) await desconectar();
  }

  async function aoBaixarTudo() {
    setOcupado(true);
    await baixarTudo();
    setOcupado(false);
    avisar({ texto: 'Dados da planilha conferidos' });
  }

  const conectado = sync.status !== 'desconectado';

  return (
    <section class="cartao">
      <h2>Sincronização com o Google</h2>
      {!conectado ? (
        <form class="formulario" onSubmit={aoConectar}>
          <p class="dica">
            Conecte o app à sua conta Google para guardar tudo numa planilha (backup) e sincronizar entre os seus
            aparelhos.
          </p>
          <textarea
            class="campo codigo"
            rows={3}
            placeholder="Cole aqui o código de conexão (começa com APP1:)"
            value={codigo}
            onInput={(e) => setCodigo(e.currentTarget.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellcheck={false}
          />
          {erro && <p class="erros" role="alert">{erro}</p>}
          <div class="linha">
            <button type="submit" class="botao primario" disabled={ocupado || !codigo.trim()}>
              {ocupado ? 'Conectando…' : 'Conectar'}
            </button>
          </div>
        </form>
      ) : (
        <div class="sync-painel">
          <div class={`sync-status ${sync.status}`}>
            <span class={`status-ponto ${sync.status}`} />
            <strong>{ROTULO_STATUS[sync.status]}</strong>
            <span>
              {sync.pendentes > 0 ? `${sync.pendentes} alteraç${sync.pendentes > 1 ? 'ões' : 'ão'} a enviar · ` : ''}
              última sincronização: {descreverUltimaSync(sync.ultimaSync)}
            </span>
          </div>
          {sync.erro && <p class="erros" role="alert">{sync.erro}</p>}
          <div class="linha">
            <button class="botao primario" disabled={sync.status === 'sincronizando'} onClick={() => sincronizar()}>
              Sincronizar agora
            </button>
            {sync.planilha && (
              <a class="botao" href={sync.planilha} target="_blank" rel="noopener noreferrer">
                Abrir planilha
              </a>
            )}
            <button class="botao" disabled={ocupado} onClick={aoBaixarTudo}>
              Baixar tudo da planilha
            </button>
            <button class="botao perigo" onClick={aoDesconectar}>
              Desconectar
            </button>
          </div>
          <p class="dica">
            A sincronização acontece sozinha: ao abrir o app, alguns segundos após cada alteração, quando a internet
            volta e a cada 5 minutos.
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------------- Quem usa este aparelho ---------------- */

function CartaoAparencia() {
  const [tema, setTema] = useState<Tema>(lerTema);
  const escolher = (t: Tema) => {
    setTema(t);
    salvarTema(t);
  };
  const opcoes: [Tema, string][] = [
    ['sistema', 'Sistema'],
    ['claro', 'Claro'],
    ['escuro', 'Escuro'],
  ];
  return (
    <section class="cartao">
      <h2>Aparência</h2>
      <div class="preferencias">
        <span>Tema</span>
        <div class="segmentado pequeno" role="radiogroup" aria-label="Tema">
          {opcoes.map(([valor, rotulo]) => (
            <button key={valor} type="button" role="radio" aria-checked={tema === valor} onClick={() => escolher(valor)}>
              {rotulo}
            </button>
          ))}
        </div>
      </div>
      <p class="dica">“Sistema” segue o modo claro/escuro do aparelho. A escolha vale só para este aparelho.</p>
    </section>
  );
}

function CartaoPreferencias() {
  const config = useConfig();
  const pessoas = paraEscolha(useEntidade('pessoas').filter((p) => p.tipo === 'Membro do Domicílio'), config.pessoa_id);
  const { papel } = usePerfil();
  const mudar = (parcial: Partial<Config>) => salvarConfig(parcial);

  return (
    <section class="cartao">
      <h2>Quem usa este aparelho</h2>
      <div class="preferencias">
        <label>
          <span>Pessoa</span>
          <select class="campo" disabled={!!config.papel_servidor} value={config.pessoa_id ?? ''} onChange={(e) => mudar({ pessoa_id: e.currentTarget.value || null })}>
            <option value="">(não escolhida — acesso completo)</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.papel})
              </option>
            ))}
          </select>
        </label>
      </div>
      {pessoas.length === 0 && (
        <p class="erros" role="status">
          Ainda não há pessoas neste aparelho. Use <strong>Importar do app antigo</strong> (logo abaixo) ou cadastre as pessoas
          em Cadastros → Pessoas (tipo Membro do Domicílio). Depois volte aqui e escolha quem usa o aparelho.
        </p>
      )}
      <p class="dica">
        Define o nome que já vem preenchido nos formulários e o acesso deste aparelho (agora: <strong>{papel}</strong>). O
        Colaborador não vê Gastos nem Carteira.{' '}
        {config.papel_servidor
          ? 'Como este aparelho está conectado à planilha, a pessoa vem do código de conexão e não pode ser trocada aqui.'
          : 'Quando a sincronização for ligada, isso passa a vir do código de conexão de cada pessoa.'}
      </p>
    </section>
  );
}

/* ---------------- Importar do app antigo ---------------- */

const ROTULOS_IMPORTACAO: Record<string, string> = {
  categorias: 'categorias',
  meios_pagamento: 'meios de pagamento',
  pessoas: 'pessoas',
  lancamentos: 'contas',
  rateios: 'linhas de rateio',
  parcelas: 'parcelas',
  gastos_rotineiros: 'gastos do dia a dia',
};

function CartaoImportar() {
  const { ehAdmin } = usePerfil();
  const { perguntar, avisar } = useEstado();
  const [token, setToken] = useState('');
  const [progresso, setProgresso] = useState<{ texto: string; fracao: number } | null>(null);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  if (!ehAdmin) return null;

  async function importar(e: Event) {
    e.preventDefault();
    const r = await perguntar(
      'Importar os dados do app antigo?',
      [{ valor: 'sim', rotulo: 'Importar', estilo: 'primario' }],
      'Os cadastros, contas, parcelas e gastos DESTE APARELHO serão substituídos pelos do app antigo. O app antigo não é alterado. A Carteira não é tocada.',
    );
    if (!r) return;
    setErro('');
    setResultado(null);
    try {
      const res = await importarDoAppAntigo(token, (texto, fracao) => setProgresso({ texto, fracao }));
      setResultado(res);
      setToken('');
      avisar({ texto: 'Dados do app antigo importados' });
    } catch (x) {
      setErro(`Não foi possível importar: ${x instanceof Error ? x.message : String(x)}`);
    } finally {
      setProgresso(null);
    }
  }

  return (
    <section class="cartao">
      <h2>Importar do app antigo</h2>
      <form class="formulario" onSubmit={importar}>
        <p class="dica">
          Copia para este aparelho os cadastros, contas, parcelas e gastos do app atual (Projeto Finanças). Só lê o app antigo —
          nada é alterado nele. Pode repetir quantas vezes quiser: cada importação substitui a anterior.
        </p>
        <p class="dica">
          Leva cerca de <strong>2 minutos</strong>. Mantenha o app aberto e a tela ligada até aparecer “Importado: …”.
        </p>
        <label class="campo-rotulo">
          <span>Token de acesso do app antigo (Admin)</span>
          <input class="campo" type="password" autoComplete="off" value={token} onInput={(e) => setToken(e.currentTarget.value)} />
        </label>
        {progresso && (
          <div class="progresso">
            <div class="progresso-barra" style={{ width: `${Math.round(progresso.fracao * 100)}%` }} />
            <span>{progresso.texto}</span>
          </div>
        )}
        {erro && <p class="erros" role="alert">{erro}</p>}
        {resultado && (
          <div class="dica">
            Importado:{' '}
            {Object.entries(resultado.contagens)
              .map(([k, n]) => `${n} ${ROTULOS_IMPORTACAO[k] ?? k}`)
              .join(' · ')}
            .
            {resultado.avisos.length > 0 && (
              <ul>
                {resultado.avisos.map((a) => <li key={a}>{a}</li>)}
              </ul>
            )}
          </div>
        )}
        <div class="linha">
          <button type="submit" class="botao primario" disabled={!token.trim() || !!progresso}>
            {progresso ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ---------------- Este aparelho ---------------- */

function CartaoAparelho() {
  const [persistente, setPersistente] = useState<boolean | null>(null);
  const [uso, setUso] = useState<string>('');

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistente).catch(() => setPersistente(null));
    navigator.storage
      ?.estimate?.()
      .then((e) => setUso(e.usage ? `${(e.usage / 1024 / 1024).toFixed(1)} MB` : ''))
      .catch(() => undefined);
  }, []);

  return (
    <section class="cartao">
      <h2>Este aparelho</h2>
      <ul class="info-lista">
        <li>
          <span>Proteção dos dados locais</span>
          <strong>
            {persistente === null ? '—' : persistente ? '✔ Ativa' : '⚠ Inativa (instale o app na tela inicial)'}
          </strong>
        </li>
        {uso && (
          <li>
            <span>Espaço usado</span>
            <strong>{uso}</strong>
          </li>
        )}
        <li>
          <span>Pensado para</span>
          <strong>{APP.dispositivos.join(', ')}</strong>
        </li>
        <li>
          <span>Versão do app</span>
          <strong>{__VERSAO__}</strong>
        </li>
      </ul>
    </section>
  );
}
