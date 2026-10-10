/** Teto "redondo" (1, 2, 2,5, 5 × 10^k) e as marcas do eixo, de 0 até o teto. */
export function escalaRedonda(maximo: number, marcas = 4): { teto: number; valores: number[] } {
  if (maximo <= 0) return { teto: 1, valores: [0] };
  const passoBruto = maximo / marcas;
  const potencia = 10 ** Math.floor(Math.log10(passoBruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= passoBruto)!;
  const teto = Math.ceil(maximo / passo) * passo;
  return { teto, valores: Array.from({ length: Math.round(teto / passo) + 1 }, (_, i) => i * passo) };
}
