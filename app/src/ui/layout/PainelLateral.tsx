import type { ComponentChildren } from 'preact';
import { useEffect, useErrorBoundary } from 'preact/hooks';
import { IconeFechar } from '../icones';

interface Props {
  titulo: string;
  aoFechar: () => void;
  children: ComponentChildren;
}

/** Se o conteúdo do painel falhar ao desenhar, mostra um aviso em vez de travar o app inteiro. */
function ProtecaoErro({ children }: { children: ComponentChildren }) {
  const [erro, tentarDeNovo] = useErrorBoundary((e) => console.error('Erro no painel:', e));
  if (erro)
    return (
      <div class="formulario">
        <p class="erros" role="alert">Não foi possível mostrar isto agora.</p>
        <div class="linha">
          <button type="button" class="botao" onClick={tentarDeNovo}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  return <>{children}</>;
}

/** Painel que abre pela direita, sem esconder a área principal (em paisagem). */
export function PainelLateral({ titulo, aoFechar, children }: Props) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  return (
    <aside class="painel" aria-label={titulo}>
      <div class="painel-topo">
        <h2>{titulo}</h2>
        <button class="botao-icone" onClick={aoFechar} aria-label="Fechar">
          <IconeFechar />
        </button>
      </div>
      <div class="painel-corpo">
        <ProtecaoErro key={titulo}>{children}</ProtecaoErro>
      </div>
    </aside>
  );
}
