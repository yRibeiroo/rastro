"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AreaDeSoltar } from "@/componentes/arquivos/AreaDeSoltar";
import { Anuncio, Erro } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import { botao } from "@/componentes/formulario/classes";
import { formatarData } from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";
import { deixarRastro } from "@/identidade-visual/rastro-movimento";
import type { DataISO, Id, ResultadoDaAcao } from "@/regras-de-negocio";

export type ResultadoDaImportacao = {
  importacaoId: Id;
  novas: number;
  atualizadas: number;
  periodo: { de: DataISO; ate: DataISO };
  comprovantesConciliados: number;
};

type Props = {
  importarExtrato: (formulario: FormData) => Promise<ResultadoDaAcao<ResultadoDaImportacao>>;
};

const LIMITE = 5 * 1024 * 1024;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Envio do OFX: soltar/selecionar → importando → resultado (com o rastro até o número de novas). */
export function ImportarExtrato({ importarExtrato }: Props) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [estado, setEstado] = useState<
    { tipo: "parado" } | { tipo: "importando"; nome: string } | { tipo: "erro"; mensagem: string } | { tipo: "pronto"; r: ResultadoDaImportacao }
  >({ tipo: "parado" });
  const area = useRef<HTMLDivElement>(null);
  const numero = useRef<HTMLElement>(null);

  // O valor "viaja" do arquivo enviado até o total de transações novas.
  useEffect(() => {
    if (estado.tipo === "pronto" && area.current && numero.current) deixarRastro(area.current, numero.current);
  }, [estado]);

  async function importar(arquivo: File) {
    if (!/\.ofx$/i.test(arquivo.name) || arquivo.size > LIMITE)
      return setEstado({ tipo: "erro", mensagem: "Envie o arquivo .ofx exportado do Internet Banking (até 5 MB)." });
    setEstado({ tipo: "importando", nome: arquivo.name });
    const dados = new FormData();
    dados.set("arquivo", arquivo);
    const r = await importarExtrato(dados);
    if (!r.ok) return setEstado({ tipo: "erro", mensagem: r.erro.mensagem });
    setEstado({ tipo: "pronto", r: r.dados });
    iniciar(() => router.refresh());
  }

  const importando = estado.tipo === "importando";
  return (
    <div className="grid gap-4">
      <AreaDeSoltar
        ref={area}
        rotulo={
          <>
            <Icone nome="importar" className="size-4" />
            {estado.tipo === "pronto" ? "Importar outro arquivo" : "Escolher arquivo OFX"}
          </>
        }
        ajuda={<span className="hidden md:inline">ou arraste o arquivo .ofx para cá</span>}
        accept=".ofx,application/x-ofx,application/ofx"
        desabilitado={importando}
        aoEscolher={importar}
        classeDoBotao={botao.primario}
      />

      <Anuncio>
        {importando && <Carregando contexto="sincronizando" rotulo={`Importando ${estado.nome}`} className="py-4" />}
        {estado.tipo === "erro" && <Erro variante="faixa" titulo="Não importamos" mensagem={estado.mensagem} />}
        {estado.tipo === "pronto" && (
          <div className="surgir grid gap-4 rounded-g border border-borda bg-superficie p-5 md:p-6">
            <p className="text-sm text-texto-suave">
              Extrato de {formatarData(estado.r.periodo.de)} a {formatarData(estado.r.periodo.ate)} importado.
            </p>
            <dl className="flex flex-wrap gap-x-10 gap-y-4">
              <div className="grid gap-0.5">
                <dt className="text-sm text-texto-suave">Transações novas</dt>
                <dd>
                  <strong ref={numero} className="valor-monetario inline-block font-titulo text-4xl font-bold">
                    {estado.r.novas}
                  </strong>
                </dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-sm text-texto-suave">Atualizadas</dt>
                <dd className="valor-monetario font-titulo text-4xl font-bold">{estado.r.atualizadas}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-sm text-texto-suave">Comprovantes conciliados</dt>
                <dd className="valor-monetario font-titulo text-4xl font-bold">{estado.r.comprovantesConciliados}</dd>
              </div>
            </dl>
            <p className="text-sm">
              {estado.r.novas === 0 && estado.r.atualizadas > 0
                ? "Esse período já estava importado: nada foi duplicado."
                : `${plural(estado.r.novas, "transação nova entrou", "transações novas entraram")} já categorizadas.`}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/extrato?de=${estado.r.periodo.de}&ate=${estado.r.periodo.ate}`} className={botao.secundario}>
                Ver no extrato
              </Link>
              <Link href="/comprovantes" className={botao.fantasma}>
                Enviar comprovantes
              </Link>
            </div>
          </div>
        )}
      </Anuncio>
    </div>
  );
}
