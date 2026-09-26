// Navegação por "#/tela" — funciona offline e no GitHub Pages sem configuração extra.
//
// ► Nova tela: acrescente em TELAS e em MENU (e o componente em App.tsx).
import type { ComponentType, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  IconeCarteira,
  IconeConfig,
  IconeEtiqueta,
  IconeGrafico,
  IconeHoje,
  IconeLista,
  IconePagar,
  IconeRecibo,
  IconeRepetir,
} from './icones';

export const TELAS = ['inicio', 'lancamentos', 'pagar', 'monitoramento', 'recorrentes', 'gastos', 'carteira', 'cadastros', 'config'] as const;
export type Tela = (typeof TELAS)[number];

export interface ItemMenu {
  tela: Tela;
  rotulo: string;
  /** Rótulo na barra de baixo do celular (espaço menor). */
  curto?: string;
  Icone: ComponentType<JSX.SVGAttributes<SVGSVGElement>>;
  /** Só o Admin vê (P2). */
  soAdmin?: boolean;
}

/** Itens do menu (lateral no PC, rodapé no celular). "config" fica sempre por último. */
export const MENU: ItemMenu[] = [
  { tela: 'inicio', rotulo: 'Início', Icone: IconeHoje },
  { tela: 'lancamentos', rotulo: 'Lançamentos', curto: 'Contas', Icone: IconeLista },
  { tela: 'pagar', rotulo: 'Pagar parcelas', curto: 'Pagar', Icone: IconePagar },
  { tela: 'monitoramento', rotulo: 'Monitoramento', curto: 'Monitorar', Icone: IconeGrafico },
  { tela: 'recorrentes', rotulo: 'Recorrentes', Icone: IconeRepetir },
  { tela: 'gastos', rotulo: 'Gastos', Icone: IconeRecibo, soAdmin: true },
  { tela: 'carteira', rotulo: 'Carteira', Icone: IconeCarteira, soAdmin: true },
  { tela: 'cadastros', rotulo: 'Cadastros', Icone: IconeEtiqueta },
  { tela: 'config', rotulo: 'Ajustes', Icone: IconeConfig },
];

/** Telas na barra de baixo do celular (as demais ficam em "Mais"). */
export function telasPrincipaisCelular(ehAdmin: boolean): Tela[] {
  return ['inicio', 'lancamentos', 'pagar', ehAdmin ? 'gastos' : 'monitoramento'];
}

export const telaPermitida = (tela: Tela, ehAdmin: boolean) => ehAdmin || !MENU.find((m) => m.tela === tela)?.soAdmin;

function lerTela(): Tela {
  const nome = location.hash.replace(/^#\/?/, '') as Tela;
  return TELAS.includes(nome) ? nome : TELAS[0];
}

export function irPara(tela: Tela) {
  location.hash = `/${tela}`;
}

export function useTela(): Tela {
  const [tela, setTela] = useState<Tela>(lerTela);
  useEffect(() => {
    const aoMudar = () => setTela(lerTela());
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);
  return tela;
}
