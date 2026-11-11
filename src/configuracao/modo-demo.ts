// Demo pública (MODO_DEMO=1): dados fictícios, sem login e somente leitura.
// Sem "server-only" e lido direto do ambiente: o proxy também importa daqui.
export const modoDemo = (): boolean => process.env.MODO_DEMO === "1";

export const MENSAGEM_DA_DEMO =
  "Esta é uma demonstração com dados fictícios: nada pode ser alterado.";
