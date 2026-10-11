import { useId, type SVGProps } from "react";

/**
 * Logo do Rastro: "R" geométrico cuja perna vira uma trajetória ascendente sobre três barras.
 * Paths vindos de documentos/design/LogoVetorizada.zip, posicionados contra a arte original.
 * Ordem das peças = ordem do desenho na abertura (barras crescendo → trajetória → R).
 */
export const LOGO_VIEWBOX = "0 0 1032 843";
export const LOGO_PROPORCAO = 843 / 1032;

export const PECAS_LOGO = [
  {
    nome: "barra-1",
    transform: "translate(11.5 708)",
    d: "M94.979 0.16367C99.6663 -0.400945 110.045 0.236213 110.974 6.26147C114.158 28.7493 112.429 53.2456 112.652 76.0802C112.777 88.9051 114.488 120.015 108.956 129.662C102.508 133.921 33.8493 132.058 20.964 131.977C16.3767 132.017 10.6826 132.679 6.51551 130.533C4.13673 129.307 2.7259 127.694 1.93781 125.137C-0.651506 116.732 -0.23204 66.151 0.816593 55.0361C1.18361 51.1484 1.93458 46.2605 3.90198 42.8244C8.67487 34.5084 81.3782 3.76914 94.979 0.16367Z",
  },
  {
    nome: "barra-2",
    transform: "translate(161 632)",
    d: "M100.849 0.00212086C117.701 -0.177749 116.533 11.1097 116.589 23.8644C116.615 29.713 116.602 35.6794 116.605 41.5264L116.606 94.9438L116.579 157.31C116.585 166.545 118.009 199.615 113.377 205.189C105.346 210.238 84.6465 208.649 74.8708 208.625C55.267 208.488 35.6624 208.464 16.0578 208.544C-4.00334 208.085 0.3735 191.428 0.46465 176.16L0.636475 137.871L0.455 85.9584C0.420315 76.7551 -0.219371 67.1244 0.726818 57.9857C1.19225 53.493 2.45302 48.5405 5.12381 44.8221C12.1109 35.0914 87.2463 2.16137 100.849 0.00212086Z",
  },
  {
    nome: "barra-3",
    transform: "translate(316.5 541)",
    d: "M102.288 0.12912C114.592 -0.79201 121.439 3.06432 121.3 16.582C121.14 32.1888 121.115 47.7722 121.135 63.3797L121.142 184.356L121.178 252.126C121.188 263.846 121.412 275.751 120.971 287.326C120.661 295.456 115.612 298.392 108.387 298.868C98.2182 299.529 87.2519 299.279 77.0995 299.271L18.4132 299.191C-4.75837 299.086 0.520309 283.744 0.510629 265.394L0.520279 211.183L0.492856 111.778C0.48721 95.0458 -0.292025 77.8952 0.583987 61.2068C0.808233 56.9488 1.96496 53.015 4.14854 49.3483C11.6737 36.7105 84.7005 4.82349 102.288 0.12912Z",
  },
  {
    nome: "trajetoria",
    transform: "translate(0 305)",
    d: "M553.49 3.35462C559.363 5.2606 564.824 1.56318 574.285 4.80165C577.31 2.41252 578.141 0.636402 581.335 0C587.135 3.499 585.353 14.9873 581.852 18.934L582.15 19.6147C575.471 22.7855 562.726 27.3943 555.225 30.4376C537.664 37.5372 520.241 44.9531 502.954 52.681C447.537 77.8653 394.359 107.7 343.985 141.865C240.792 211.313 150.999 300.335 38.4913 356.05C25.7117 362.379 13.1523 369.111 0 374.67C2.40782 335.958 20.7049 297.502 42.5196 266.039C141.454 123.349 388.489 33.1558 553.49 3.35462Z",
  },
  {
    nome: "trajetoria-ponta",
    transform: "translate(553.49 295.36)",
    d: "M0 12.9967C34.7178 4.12979 77.0262 1.93502 112.688 0C83.076 8.20225 56.3923 20.4076 28.66 29.2568L28.3615 28.576C31.8623 24.6294 33.645 13.1411 27.8453 9.64205C24.651 10.2785 23.8201 12.0546 20.7952 14.4437C11.3333 11.2052 5.87234 14.9026 0 12.9967Z",
  },
  {
    nome: "r",
    transform: "translate(17 1)",
    d: "M593.14 0.742817C704.553 -0.310594 821.952 -8.23537 914.086 66.5834C962.324 105.931 995.226 160.955 1007.07 222.069C1036.89 369.692 961.638 521.224 807.118 553.098C797.632 555.053 787.984 555.873 778.361 556.852C782.733 563.163 791.88 573.674 797.051 579.949L833.931 624.427L950.482 766.056L988.442 812.209C995.767 821.065 1005.63 832.269 1012.02 841.262C951.902 842.238 889.936 841.48 829.615 841.512L755.339 841.545C746.571 841.545 706.183 842.972 699.899 838.399C693.744 833.922 679.306 813.185 674.062 806.006L643.055 763.571L576.185 671.939C566.448 658.567 555.712 644.587 546.387 631.117C517.421 589.972 485.309 549.411 455.763 508.623C451.313 502.479 447.259 495.648 449.005 487.876C451.947 474.774 469.203 456.065 478.504 445.648C491.326 431.292 511.952 410.605 529.004 401.853C542.169 395.092 560.237 396.088 574.733 396.078L633.811 395.948C666.335 395.82 695.39 398.532 723.155 378.06C788.751 329.7 772.545 221.108 690.26 202.496C674.708 198.978 657.526 200.106 641.587 200.132L584.009 200.267L290.969 201.337L214.248 201.597C200.366 201.664 184.394 202.344 170.705 200.751C164.647 200.046 160.15 197.868 155.931 193.506C146.166 183.409 136.614 171.679 127.471 160.955L74.3066 98.5802L26.2106 42.0678C21.274 36.3088 -1.04819 13.3418 0.0383511 7.5908C5.71871 2.36649 30.6617 4.19424 38.7676 4.18295L83.8878 3.82158L215.624 2.7593L593.14 0.742817Z",
  },
] as const;

type PropsLogo = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Largura em px; a altura segue a proporção. Padrão 40. */
  tamanho?: number;
  /** Texto acessível. Passe "" para logo decorativa (aria-hidden). Padrão "Rastro". */
  title?: string;
  /** "preenchida" (padrão) ou "tracada": só contornos, com pathLength=1 para animar stroke-dashoffset. */
  variante?: "preenchida" | "tracada";
  /** Espessura do traço na variante "tracada", em unidades do viewBox (1032 de largura). */
  espessura?: number;
};

export function LogoRastro({
  tamanho = 40,
  title = "Rastro",
  variante = "preenchida",
  espessura = 8,
  ...resto
}: PropsLogo) {
  const id = useId();
  const gradiente = `${id}-gradiente`;
  const titulo = `${id}-titulo`;
  const tracada = variante === "tracada";
  const decorativa = title === "";

  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      width={tamanho}
      height={Math.round(tamanho * LOGO_PROPORCAO)}
      role={decorativa ? undefined : "img"}
      aria-hidden={decorativa || undefined}
      aria-labelledby={decorativa ? undefined : titulo}
      focusable="false"
      {...resto}
    >
      {!decorativa && <title id={titulo}>{title}</title>}
      <defs>
        <linearGradient
          id={gradiente}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="843"
          x2="1032"
          y2="0"
        >
          <stop offset="0" stopColor="#008f6c" />
          <stop offset="0.55" stopColor="#00d1a0" />
          <stop offset="1" stopColor="#4ee6b7" />
        </linearGradient>
      </defs>
      <g
        fill={tracada ? "none" : `url(#${gradiente})`}
        stroke={tracada ? `url(#${gradiente})` : undefined}
        strokeWidth={tracada ? espessura : undefined}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {PECAS_LOGO.map((p) => (
          <path
            key={p.nome}
            data-peca={p.nome}
            transform={p.transform}
            d={p.d}
            pathLength={tracada ? 1 : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
