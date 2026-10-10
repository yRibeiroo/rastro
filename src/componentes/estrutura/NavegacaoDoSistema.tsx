"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { botao } from "@/componentes/formulario/classes";
import { LogoRastro } from "@/identidade-visual/LogoRastro";
import { Icone, type NomeDoIcone } from "./Icone";
import { SeletorDeTema } from "./SeletorDeTema";

type Item = { href: string; rotulo: string; curto: string; icone: NomeDoIcone };

const ITENS: Item[] = [
  { href: "/painel", rotulo: "Painel", curto: "Painel", icone: "painel" },
  { href: "/extrato", rotulo: "Extrato", curto: "Extrato", icone: "extrato" },
  { href: "/categorias", rotulo: "Categorias", curto: "Categorias", icone: "categorias" },
  { href: "/centros-de-custo", rotulo: "Centros de custo", curto: "Centros", icone: "centros" },
  { href: "/conexoes-bancarias", rotulo: "Conexões bancárias", curto: "Conexões", icone: "conexoes" },
];
const NA_BARRA = ITENS.slice(0, 4);
const ID_MAIS = "menu-mais";

const ativo = (caminho: string | null, href: string) => caminho !== null && (caminho === href || caminho.startsWith(`${href}/`));

type Props = {
  /** Indicador da conexão (Server Component já resolvido no layout). */
  status: ReactNode;
  /** Server Action de saída. */
  sair: () => Promise<void>;
  /** Caminho atual (null no shell estático, antes de saber a URL). */
  caminho: string | null;
};

function BotaoSair({ sair, className }: { sair: Props["sair"]; className: string }) {
  return (
    <form action={sair}>
      <button type="submit" className={className}>
        <Icone nome="sair" />
        Sair
      </button>
    </form>
  );
}

/** Lê a URL (dado de requisição): o layout coloca este componente dentro de um <Suspense>. */
export function NavegacaoComCaminho(props: Omit<Props, "caminho">) {
  return <NavegacaoDoSistema {...props} caminho={usePathname()} />;
}

export function NavegacaoDoSistema({ status, sair, caminho }: Props) {
  const fecharMais = () => document.getElementById(ID_MAIS)?.hidePopover();

  return (
    <>
      {/* Desktop: trilho lateral. O item ativo ganha uma trilha vertical à esquerda. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-borda bg-superficie px-3 py-5 lg:flex">
        <Link href="/painel" className="flex items-center gap-2.5 rounded-m px-2 py-1">
          <LogoRastro tamanho={32} title="" />
          <span className="font-titulo text-lg font-bold tracking-tight">Rastro</span>
        </Link>
        <nav aria-label="Principal" className="flex-1">
          <ul className="grid gap-1">
            {ITENS.map((i) => {
              const atual = ativo(caminho, i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={atual ? "page" : undefined}
                    className={`relative flex h-10 items-center gap-3 rounded-m px-3 text-sm transition-colors duration-[180ms] ${
                      atual ? "bg-primaria-suave font-semibold text-texto" : "text-texto-suave hover:bg-superficie-2 hover:text-texto"
                    }`}
                  >
                    {atual && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primaria" />}
                    <Icone nome={i.icone} />
                    {i.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="grid gap-4 border-t border-borda pt-4">
          {status}
          <SeletorDeTema />
          <BotaoSair sair={sair} className={`${botao.fantasma} w-full justify-start`} />
        </div>
      </aside>

      {/* Celular: barra superior com a marca e a situação do banco. */}
      <header className="flex items-center justify-between gap-3 border-b border-borda bg-superficie px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        <Link href="/painel" className="flex h-14 items-center gap-2">
          <LogoRastro tamanho={28} title="" />
          <span className="font-titulo text-base font-bold tracking-tight">Rastro</span>
        </Link>
        <div className="min-w-0">{status}</div>
      </header>

      {/* Celular: barra inferior com 4 destinos + "Mais" (popover nativo: Esc e toque fora fecham). */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {NA_BARRA.map((i) => {
            const atual = ativo(caminho, i.href);
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={atual ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors duration-[180ms] ${
                    atual ? "font-semibold text-primaria-texto" : "text-texto-suave"
                  }`}
                >
                  <Icone nome={i.icone} />
                  {i.curto}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              popoverTarget={ID_MAIS}
              className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] ${
                ativo(caminho, "/conexoes-bancarias") ? "font-semibold text-primaria-texto" : "text-texto-suave"
              }`}
            >
              <Icone nome="mais" />
              Mais
            </button>
          </li>
        </ul>
      </nav>
      <div
        id={ID_MAIS}
        popover="auto"
        aria-label="Mais opções"
        className="folha fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-g border border-borda bg-superficie p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-texto shadow-3 backdrop:bg-[rgb(7_19_21/0.4)] lg:hidden"
      >
        <div className="grid gap-4">
          <Link
            href="/conexoes-bancarias"
            onClick={fecharMais}
            aria-current={ativo(caminho, "/conexoes-bancarias") ? "page" : undefined}
            className="flex h-12 items-center gap-3 rounded-m px-3 hover:bg-superficie-2 aria-[current=page]:bg-primaria-suave aria-[current=page]:font-semibold"
          >
            <Icone nome="conexoes" />
            Conexões bancárias
          </Link>
          <SeletorDeTema />
          <BotaoSair sair={sair} className={`${botao.secundario} w-full`} />
          <button type="button" popoverTarget={ID_MAIS} popoverTargetAction="hide" className={`${botao.fantasma} w-full`}>
            Fechar
          </button>
        </div>
      </div>
    </>
  );
}
