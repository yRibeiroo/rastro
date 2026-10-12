/**
 * Tema manual. Sem chamada, o app segue o sistema (prefers-color-scheme).
 * Grava data-tema (lido pelos tokens) e data-theme (lido pelo thinking-orbs com theme="auto").
 * O script inline do layout (SCRIPT_ANTES_DA_PINTURA) reaplica a escolha antes da primeira pintura.
 */
export type Tema = "claro" | "escuro" | "sistema";

export const CHAVE_TEMA = "rastro:tema";
export const CHAVE_ABERTURA = "rastro:abertura-vista";

export function definirTema(tema: Tema) {
  const html = document.documentElement;
  if (tema === "sistema") {
    delete html.dataset.tema;
    html.removeAttribute("data-theme");
  } else {
    html.dataset.tema = tema;
    html.dataset.theme = tema === "escuro" ? "dark" : "light";
  }
  try {
    if (tema === "sistema") localStorage.removeItem(CHAVE_TEMA);
    else localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // armazenamento bloqueado: o tema vale só para esta página
  }
}

/**
 * Roda no <head> antes da pintura: restaura o tema e decide se a abertura toca.
 * Na primeira visita da sessão grava a marca já aqui, então recarregar no meio não repete a abertura.
 */
export const SCRIPT_ANTES_DA_PINTURA = `(function(){var h=document.documentElement;try{var t=localStorage.getItem("${CHAVE_TEMA}");if(t==="claro"||t==="escuro"){h.dataset.tema=t;h.dataset.theme=t==="escuro"?"dark":"light"}}catch(e){}try{if(sessionStorage.getItem("${CHAVE_ABERTURA}")){h.dataset.aberturaVista=""}else{sessionStorage.setItem("${CHAVE_ABERTURA}","1")}}catch(e){h.dataset.aberturaVista=""}})();`;
