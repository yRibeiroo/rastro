import type { Metadata } from "next";
import { Suspense } from "react";
import { FormularioDeEntrada } from "@/componentes/entrada/FormularioDeEntrada";
import { LinhaTrilha } from "@/componentes/estrutura/CabecalhoDaPagina";
import { enviarLinkMagico } from "@/regras-de-negocio/interface-web/acoes";
import { LogoRastro } from "@/identidade-visual/LogoRastro";
import { caminhoDaTrilha } from "@/identidade-visual/rastro-movimento";

export const metadata: Metadata = { title: "Entrar" };

const AVISOS: Record<string, string> = {
  link_expirado: "Este link expirou ou já foi usado. Peça um novo.",
};

// Lê ?estado (desenvolvimento) e ?erro (callback do link) dentro do Suspense: o resto é shell estático.
async function Formulario({ searchParams }: Pick<PageProps<"/entrar">, "searchParams">) {
  const { estado, erro } = await searchParams;
  // ?estado= só em desenvolvimento, para revisar os estados da tela.
  const forcar =
    process.env.NODE_ENV !== "production" && (estado === "carregando" || estado === "erro" || estado === "enviado") ? estado : null;
  return <FormularioDeEntrada enviar={enviarLinkMagico} forcar={forcar} avisoInicial={typeof erro === "string" ? (AVISOS[erro] ?? null) : null} />;
}

export default function Entrar({ searchParams }: PageProps<"/entrar">) {
  return (
    <main id="conteudo" className="grid min-h-dvh flex-1 lg:grid-cols-[5fr_7fr]">
      <section className="relative isolate flex flex-col justify-center gap-10 px-6 py-12 sm:px-12 lg:px-16">
        <LinhaTrilha className="h-56" />
        <div className="grid gap-6">
          <LogoRastro tamanho={56} title="Rastro" />
          <h1 className="max-w-[14ch] text-4xl leading-[1.1] font-bold md:text-5xl">Saiba para onde vai cada real.</h1>
        </div>
        <div className="w-full max-w-md">
          <Suspense fallback={<FormularioDeEntrada enviar={enviarLinkMagico} />}>
            <Formulario searchParams={searchParams} />
          </Suspense>
        </div>
      </section>

      {/* Lado da marca (≥ 1024 px): grafite da arte com trilhas que sobem para a direita. */}
      <div aria-hidden="true" className="relative hidden overflow-hidden bg-[#071315] lg:grid lg:place-items-center">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice">
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={caminhoDaTrilha(-40, 760 + i * 40, 860, 140 + i * 70)}
              fill="none"
              stroke={i === 2 ? "rgb(78 230 183 / 0.5)" : "rgb(78 230 183 / 0.14)"}
              strokeWidth={i === 2 ? 2 : 1.25}
            />
          ))}
        </svg>
        <LogoRastro tamanho={180} title="" className="relative" />
      </div>
    </main>
  );
}
