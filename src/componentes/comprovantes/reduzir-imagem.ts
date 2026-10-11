// RNF-24/RNF-25: antes do envio, a foto do comprovante é reduzida no navegador e reencodada
// via canvas, o que também descarta o EXIF (inclusive GPS). PDF segue como está.

export const LADO_MAXIMO = 2576;
export const QUALIDADE_JPEG = 0.85;
/** Se o JPEG ainda passar do limite, a qualidade cai em degraus antes de desistir. */
const QUALIDADES = [QUALIDADE_JPEG, 0.75, 0.65, 0.55, 0.45];

/** Dimensões finais mantendo a proporção, com o lado maior ≤ máximo (nunca amplia). */
export function dimensoesReduzidas(largura: number, altura: number, maximo = LADO_MAXIMO): { largura: number; altura: number } {
  const escala = Math.min(1, maximo / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

/** Imagem → JPEG reduzido sem metadados, tentando caber em `limite` bytes. Outros tipos (PDF) voltam intactos. */
export async function reduzirImagem(arquivo: File, limite = Infinity): Promise<File> {
  if (!arquivo.type.startsWith("image/")) return arquivo;
  // imageOrientation "from-image": aplica a rotação do EXIF antes de descartá-lo.
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  try {
    const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("canvas indisponível");
    contexto.drawImage(bitmap, 0, 0, largura, altura);
    let blob: Blob | null = null;
    for (const qualidade of QUALIDADES) {
      blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", qualidade));
      if (!blob) throw new Error("falha ao gerar JPEG");
      if (blob.size <= limite) break;
    }
    if (!blob) throw new Error("falha ao gerar JPEG");
    const nome = arquivo.name.replace(/\.[^.]+$/, "") || "comprovante";
    return new File([blob], `${nome}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
