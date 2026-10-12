// Chave de acesso de NF-e/NFC-e (44 dígitos) — ADR 0016. Puro: serve no servidor e no navegador.

/** true se tem 44 dígitos e o dígito verificador (módulo 11, pesos 2..9 da direita) confere. */
export function chaveDeAcessoValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave)) return false;
  let soma = 0;
  for (let i = 42, peso = 2; i >= 0; i--, peso = peso === 9 ? 2 : peso + 1)
    soma += Number(chave[i]) * peso;
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv === Number(chave[43]);
}

/**
 * Chave a partir do conteúdo do QR code da NFC-e: URL da SEFAZ com `p=CHAVE|2|1|...`
 * (ou `chNFe=CHAVE`, versão 1) ou a chave pura (espaços permitidos). null se não for válida.
 */
export function extrairChaveDeAcessoDoQr(conteudo: string): string | null {
  if (typeof conteudo !== "string") return null;
  const texto = conteudo.trim();
  let candidato = texto.replace(/\s+/g, "");
  try {
    const url = new URL(texto);
    const p = url.searchParams.get("p") ?? url.searchParams.get("chNFe");
    // Primeiros 44 dígitos do parâmetro (ADR 0016).
    if (p) candidato = p.split("|")[0].trim().slice(0, 44);
  } catch {
    // não é URL: segue como chave pura
  }
  return chaveDeAcessoValida(candidato) ? candidato : null;
}
