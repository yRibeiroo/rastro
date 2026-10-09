import type { Metadata, Viewport } from "next";
import { AberturaAnimada } from "@/identidade-visual/AberturaAnimada";
import { classesDeFonte } from "@/identidade-visual/fontes";
import { SCRIPT_ANTES_DA_PINTURA } from "@/identidade-visual/tema";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rastro", template: "%s · Rastro" },
  description: "Rastro: saiba para onde vai cada real.",
  applicationName: "Rastro",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#071315" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // O script do <head> grava data-tema/data-abertura-vista no <html> antes da hidratação.
    <html lang="pt-BR" className={`${classesDeFonte} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_ANTES_DA_PINTURA }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AberturaAnimada>{children}</AberturaAnimada>
      </body>
    </html>
  );
}
