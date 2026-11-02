/**
 * Movimento do Rastro: curvas, durações e a microinteração-assinatura "deixar rastro".
 *
 * Curvas (as mesmas existem em CSS como --curva-* em tokens.css):
 *   saida        entrar/sair da tela (padrão de UI)
 *   entradaSaida algo que já está na tela e se move
 *   gaveta       folhas e gavetas (estilo iOS)
 * Nunca use ease-in em UI. Interface fica abaixo de 300 ms; só a abertura e o rastro passam disso.
 *
 * Uso com motion:  <motion.div transition={{ duration: DURACAO.padrao, ease: CURVA.saida }} />
 * Uso em CSS:      transition: transform var(--duracao-padrao) var(--curva-saida);
 */

export const CURVA = {
  saida: [0.23, 1, 0.32, 1],
  entradaSaida: [0.77, 0, 0.175, 1],
  gaveta: [0.32, 0.72, 0, 1],
} as const;

/** Em segundos (motion usa segundos). */
export const DURACAO = {
  toque: 0.14,
  rapido: 0.18,
  padrao: 0.24,
  gaveta: 0.4,
  rastro: 0.7,
  abertura: 2.4,
} as const;

const css = (c: readonly number[]) => `cubic-bezier(${c.join(",")})`;

/**
 * Caminho SVG de uma trilha entre dois pontos, curvando para cima como a trajetória da logo.
 * Serve tanto para o rastro animado quanto para uma linha-trilha de fundo estática, por ex.:
 *   <svg className="absolute inset-0 -z-10" aria-hidden>
 *     <path d={caminhoDaTrilha(0, 320, 1200, 40)} stroke="var(--cor-rastro-fraco)" fill="none" strokeWidth={2} />
 *   </svg>
 */
export function caminhoDaTrilha(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const curva = Math.min(120, Math.hypot(x2 - x1, y2 - y1) * 0.35);
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - curva;
  return `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
}

const reduzido = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Microinteração-assinatura: o valor "viaja" até a categoria deixando um rastro de luz,
 * que se apaga da cauda para a ponta; a categoria responde com um toque sutil.
 * Use quando uma transação é (re)categorizada: deixarRastro(linhaDaTransacao, chipDaCategoria).
 *
 * - Só transform/opacity/stroke-dashoffset, via WAAPI (sem dependência, fora do ciclo do React).
 * - prefers-reduced-motion: sem trilha, apenas um realce de opacidade no destino.
 * - Decorativa: anuncie a mudança em texto (aria-live) separadamente.
 */
export async function deixarRastro(
  origem: Element,
  destino: Element,
): Promise<void> {
  if (typeof document === "undefined") return;

  if (reduzido()) {
    await destino.animate([{ opacity: 0.55 }, { opacity: 1 }], {
      duration: 200,
      easing: "ease",
    }).finished;
    return;
  }

  const a = origem.getBoundingClientRect();
  const b = destino.getBoundingClientRect();
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60;overflow:visible";
  const trilha = document.createElementNS(NS, "path");
  trilha.setAttribute(
    "d",
    caminhoDaTrilha(
      a.left + a.width / 2,
      a.top + a.height / 2,
      b.left + b.width / 2,
      b.top + b.height / 2,
    ),
  );
  trilha.setAttribute("pathLength", "1");
  trilha.setAttribute("fill", "none");
  trilha.setAttribute("stroke", "var(--cor-rastro)");
  trilha.setAttribute("stroke-width", "3");
  trilha.setAttribute("stroke-linecap", "round");
  trilha.setAttribute("stroke-dasharray", "1 1");
  svg.appendChild(trilha);
  document.body.appendChild(svg);

  const ms = DURACAO.rastro * 1000;
  try {
    // A ponta corre até o destino (0–60%) e a cauda a alcança (40–100%): o rastro se dissolve.
    const desenho = trilha.animate(
      [
        { strokeDashoffset: 1, strokeDasharray: "1 1", opacity: 1, offset: 0 },
        {
          strokeDashoffset: 0,
          strokeDasharray: "1 1",
          opacity: 1,
          offset: 0.6,
        },
        { strokeDashoffset: -1, strokeDasharray: "1 1", opacity: 0, offset: 1 },
      ],
      { duration: ms, easing: css(CURVA.entradaSaida), fill: "forwards" },
    );
    const toque = destino.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.04)" },
        { transform: "scale(1)" },
      ],
      { duration: 260, delay: ms * 0.55, easing: css(CURVA.saida) },
    );
    await Promise.all([desenho.finished, toque.finished]);
  } finally {
    svg.remove();
  }
}
