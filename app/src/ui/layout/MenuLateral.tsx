import { useEffect, useState } from 'preact/hooks';
import { irPara, MENU, telasPrincipaisCelular, type Tela } from '../rotas';
import { ROTULO_STATUS, useSync } from '../../sync/ganchos';
import { usePerfil } from '../perfil';
import { IconeMenuMais } from '../icones';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine);
    window.addEventListener('online', atualizar);
    window.addEventListener('offline', atualizar);
    return () => {
      window.removeEventListener('online', atualizar);
      window.removeEventListener('offline', atualizar);
    };
  }, []);
  return online;
}

/**
 * Menu: lateral no PC, com todas as telas; no celular, barra de baixo com as principais
 * e o botão "Mais" com as demais. Embaixo (PC), o estado da sincronização.
 */
export function MenuLateral({ atual }: { atual: Tela }) {
  const online = useOnline();
  const sync = useSync();
  const { ehAdmin } = usePerfil();
  const [maisAberto, setMaisAberto] = useState(false);
  const status = !online && sync.status !== 'desconectado' ? 'offline' : sync.status;

  const itens = MENU.filter((m) => ehAdmin || !m.soAdmin);
  const principais = telasPrincipaisCelular(ehAdmin);
  const extras = itens.filter((m) => !principais.includes(m.tela));
  const atualEmExtras = extras.some((m) => m.tela === atual);

  const ir = (tela: Tela) => {
    setMaisAberto(false);
    irPara(tela);
  };

  return (
    <>
      <nav class="menu" aria-label="Navegação principal">
        {itens.map(({ tela, rotulo, curto, Icone }) => (
          <button
            key={tela}
            class={`menu-item${principais.includes(tela) ? '' : ' so-largo'}`}
            aria-current={tela === atual ? 'page' : undefined}
            onClick={() => ir(tela)}
          >
            <Icone />
            <span class="rotulo-largo">{rotulo}</span>
            <span class="rotulo-curto">{curto ?? rotulo}</span>
          </button>
        ))}
        <button class="menu-item so-estreito" aria-current={atualEmExtras ? 'page' : undefined} aria-expanded={maisAberto} onClick={() => setMaisAberto(!maisAberto)}>
          <IconeMenuMais />
          <span>Mais</span>
        </button>
        <div class="menu-espaco" />
        <button class="status-sync" onClick={() => ir('config')} title={sync.erro ?? ROTULO_STATUS[status]}>
          <span class={`status-ponto ${status}`} />
          {ROTULO_STATUS[status]}
          {status === 'pendente' && <small>{sync.pendentes}</small>}
        </button>
      </nav>

      {maisAberto && (
        <div class="mais-veu" onClick={() => setMaisAberto(false)}>
          <div class="mais-folha" role="menu" onClick={(e) => e.stopPropagation()}>
            {extras.map(({ tela, rotulo, Icone }) => (
              <button key={tela} role="menuitem" class="mais-opcao" aria-current={tela === atual ? 'page' : undefined} onClick={() => ir(tela)}>
                <Icone />
                {rotulo}
              </button>
            ))}
            <div class="mais-status">
              <span class={`status-ponto ${status}`} />
              {ROTULO_STATUS[status]}
              {status === 'pendente' && ` · ${sync.pendentes} pendente(s)`}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
