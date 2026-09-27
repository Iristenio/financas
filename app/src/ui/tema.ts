// Tema da tela (claro, escuro ou o do sistema) — preferência de cada aparelho, não sincroniza.
// Fica no localStorage para ser aplicado antes de o app desenhar (script em index.html), sem piscar.
export type Tema = 'sistema' | 'claro' | 'escuro';

const CHAVE = 'financas-tema';

export function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === 'claro' || t === 'escuro' ? t : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function aplicarTema(tema: Tema) {
  const html = document.documentElement;
  if (tema === 'sistema') html.removeAttribute('data-tema');
  else html.setAttribute('data-tema', tema);
}

export function salvarTema(tema: Tema) {
  try {
    if (tema === 'sistema') localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, tema);
  } catch {
    /* sem armazenamento: vale só até fechar o app */
  }
  aplicarTema(tema);
}
