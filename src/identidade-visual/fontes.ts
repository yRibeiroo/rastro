import { Inter, Montserrat } from "next/font/google";

/** Títulos e destaques (brand board). Variável: --fonte-titulo → classe Tailwind `font-titulo`. */
export const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--fonte-titulo",
});

/** Textos e interface (brand board). Variável: --fonte-texto → `font-sans` (padrão do body). */
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--fonte-texto",
});

/** Coloque no <html>: expõe as duas variáveis CSS. Algarismos tabulares: classe `.valor-monetario` (tokens.css). */
export const classesDeFonte = `${montserrat.variable} ${inter.variable}`;
