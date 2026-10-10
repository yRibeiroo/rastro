/**
 * Ícones de traço 1,75 em grade de 20 px. Desenhados aqui porque o projeto não tem biblioteca de
 * ícones (adicionar uma exige mexer no package.json). Sempre decorativos: o texto ao lado dá o nome.
 */
const TRACOS = {
  painel: "M3 16.5h14M5.5 13.5V9M10 13.5V5.5M14.5 13.5V8",
  extrato: "M5 3.5h10v13l-2-1.3-1.7 1.3L10 15.2l-1.3 1.3L7 15.2 5 16.5zM7.5 7.5h5M7.5 10.5h5",
  categorias: "M3.5 3.5h5v5h-5zM11.5 3.5h5v5h-5zM3.5 11.5h5v5h-5zM11.5 14h5M14 11.5v5",
  centros: "M3 15c3-1 4-8 7-8s4 5 7 4M3 5.5h3M14 15.5h3",
  conexoes: "M3 8l7-4.5L17 8M4.5 8.5v6M8 8.5v6M12 8.5v6M15.5 8.5v6M3 16.5h14",
  mais: "M4.5 10h.01M10 10h.01M15.5 10h.01",
  busca: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5l3.5 3.5",
  sincronizar: "M16 9a6 6 0 0 0-11-2.5M4 11a6 6 0 0 0 11 2.5M5 3v3.5h3.5M15 17v-3.5h-3.5",
  clipe: "M14.5 9.5l-4.8 4.8a3 3 0 0 1-4.2-4.2l5.5-5.5a2 2 0 0 1 2.8 2.8l-5.4 5.4a1 1 0 0 1-1.4-1.4l4.6-4.6",
  sair: "M8 4H4.5v12H8M12 6.5L15.5 10 12 13.5M15.5 10H8",
  filtro: "M3.5 5h13M6 10h8M8.5 15h3",
  voltar: "M12 4.5L6.5 10l5.5 5.5",
  adicionar: "M10 4.5v11M4.5 10h11",
  fechar: "M5 5l10 10M15 5L5 15",
  subir: "M10 15.5v-11M5.5 9L10 4.5 14.5 9",
  abrir: "M11 4h5v5M16 4l-7 7M14 12v4H4V6h4",
} as const;

export type NomeDoIcone = keyof typeof TRACOS;

export function Icone({ nome, className = "size-5" }: { nome: NomeDoIcone; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`shrink-0 ${className}`}>
      <path
        d={TRACOS[nome]}
        fill="none"
        stroke="currentColor"
        strokeWidth={nome === "mais" ? 3 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
