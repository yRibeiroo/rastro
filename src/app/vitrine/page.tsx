import type { Metadata } from "next";
import { Carregando } from "@/identidade-visual/Carregando";
import {
  CONTEXTOS,
  type ContextoCarregando,
} from "@/identidade-visual/contextos-carregando";
import { LogoRastro } from "@/identidade-visual/LogoRastro";
import { caminhoDaTrilha } from "@/identidade-visual/rastro-movimento";
import {
  BotaoSincronizar,
  DemoRastro,
  RepetirAbertura,
  SeletorDeTema,
} from "./Demonstracoes";

export const metadata: Metadata = { title: "Vitrine da identidade visual" };

// Protótipo temporário: o frontend reaproveita as peças e apaga esta rota.
const CORES = [
  ["primaria", "Verde principal, preenchimentos"],
  ["secundaria", "Verde secundário"],
  ["primaria-texto", "Verde para texto e links"],
  ["primaria-suave", "Chips e seleção"],
  ["fundo", "Fundo do app"],
  ["superficie", "Cartões"],
  ["superficie-2", "Áreas rebaixadas"],
  ["texto", "Texto"],
  ["texto-suave", "Texto secundário"],
  ["borda", "Divisórias"],
  ["borda-controle", "Borda de input"],
  ["entrada", "Receita"],
  ["saida", "Despesa"],
  ["erro", "Erro"],
  ["alerta", "Alerta"],
  ["foco", "Anel de foco"],
] as const;

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 border-t border-borda pt-10 md:grid-cols-[14rem_1fr] md:gap-12">
      <h2 className="text-xl font-semibold">{titulo}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function Vitrine() {
  return (
    <main className="relative mx-auto w-full max-w-6xl flex-1 overflow-hidden px-4 pb-24 md:px-8">
      {/* Linha-trilha de fundo: o conceito "rastro" como textura, nunca como informação. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] w-full"
        viewBox="0 0 1200 420"
        preserveAspectRatio="none"
      >
        <path
          d={caminhoDaTrilha(-20, 400, 1220, 60)}
          fill="none"
          stroke="var(--cor-rastro-fraco)"
          strokeWidth={2}
        />
        <path
          d={caminhoDaTrilha(-20, 420, 1220, 140)}
          fill="none"
          stroke="var(--cor-rastro-fraco)"
          strokeWidth={1}
        />
      </svg>

      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-3">
          <LogoRastro tamanho={36} title="" />
          <span className="font-titulo text-xl font-bold tracking-tight">
            Rastro
          </span>
        </div>
        <SeletorDeTema />
      </header>

      <div className="grid gap-6 py-16 md:py-24">
        <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
          Identidade visual do Rastro
        </h1>
        <p className="max-w-[60ch] text-lg text-texto-suave">
          Logo, cores, tipografia e movimento em um só lugar. Tudo aqui vem de
          src/identidade-visual.
        </p>
        <div>
          <RepetirAbertura />
        </div>
      </div>

      <div className="grid gap-16">
        <Secao titulo="Logo">
          <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <div className="grid place-items-center rounded-g border border-borda bg-superficie p-10">
              <LogoRastro tamanho={200} />
            </div>
            <div className="grid gap-4">
              <div
                className="grid place-items-center rounded-g border border-borda p-8"
                style={{ background: "#071315" }}
              >
                <LogoRastro tamanho={120} title="Rastro sobre grafite" />
              </div>
              <div className="grid place-items-center rounded-g border border-borda bg-superficie p-8">
                <LogoRastro
                  tamanho={120}
                  variante="tracada"
                  espessura={10}
                  title="Rastro, versão traçada"
                />
              </div>
            </div>
          </div>
        </Secao>

        <Secao titulo="Cores">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {CORES.map(([token, uso]) => (
              <li
                key={token}
                className="grid grid-cols-[2.75rem_1fr] items-center gap-3"
              >
                <span
                  className="size-11 rounded-m border border-borda"
                  style={{ background: `var(--cor-${token})` }}
                />
                <span className="min-w-0">
                  <code className="block break-all text-sm font-medium">
                    --cor-{token}
                  </code>
                  <span className="block text-xs text-texto-suave">{uso}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="h-10 rounded-full bg-primaria px-5 text-sm font-semibold text-sobre-primaria transition-transform duration-[140ms] ease-saida active:scale-[0.97]"
            >
              Conectar banco
            </button>
            <a
              href="#"
              className="text-sm font-medium text-primaria-texto underline underline-offset-4"
            >
              Ver extrato completo
            </a>
            <span className="rounded-p bg-erro-suave px-2 py-1 text-sm text-erro">
              Conexão expirada
            </span>
            <span className="rounded-p bg-alerta-suave px-2 py-1 text-sm text-alerta">
              3 sem categoria
            </span>
          </div>
        </Secao>

        <Secao titulo="Tipografia">
          <div className="grid gap-6">
            <p className="font-titulo text-3xl font-bold tracking-tight">
              Montserrat para títulos
            </p>
            <p className="max-w-[60ch] text-base leading-relaxed text-texto-suave">
              Inter para textos e interface. Os valores usam algarismos
              tabulares, então as colunas de R$ se alinham pela vírgula.
            </p>
            <dl className="grid max-w-sm gap-2">
              {[
                ["Recebido", 18450.0, "text-entrada"],
                ["Gasto", -11204.37, "text-saida"],
                ["Saldo", 7245.63, "text-texto"],
              ].map(([rotulo, valor, cor]) => (
                <div
                  key={rotulo as string}
                  className="flex justify-between border-b border-borda py-2"
                >
                  <dt className="text-texto-suave">{rotulo}</dt>
                  <dd className={`valor-monetario font-semibold ${cor}`}>
                    {brl.format(valor as number)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Secao>

        <Secao titulo="Carregando">
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {(Object.keys(CONTEXTOS) as ContextoCarregando[]).map((c) => (
              <li
                key={c}
                className="rounded-m border border-borda bg-superficie"
              >
                <Carregando contexto={c} />
                <code className="block pb-4 text-center text-xs text-texto-suave">
                  contexto=&quot;{c}&quot;
                </code>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <BotaoSincronizar />
            <p className="text-sm text-texto-suave">
              Inline no texto:{" "}
              <Carregando
                contexto="categorizando"
                tamanho="inline"
                rotulo="categorizando 12 lançamentos"
              />
            </p>
          </div>
        </Secao>

        <Secao titulo="Rastro">
          <DemoRastro />
        </Secao>
      </div>
    </main>
  );
}
