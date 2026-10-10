"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import { botao } from "@/componentes/formulario/classes";
import type { Id, ResultadoDaAcao } from "@/componentes/prototipo/tipos-provisorios";
import { Carregando } from "@/identidade-visual/Carregando";

type Props = {
  conexaoId: Id;
  sincronizar: (conexaoId: Id) => Promise<ResultadoDaAcao<{ transacoesGravadas: number }>>;
  banco?: string | null;
};

/** "Sincronizar agora" (RF-30, HU-12): a lista atual continua usável enquanto busca. */
export function BotaoSincronizar({ conexaoId, sincronizar, banco }: Props) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function clicar() {
    setOcupado(true);
    setResultado(null);
    const r = await sincronizar(conexaoId);
    setOcupado(false);
    if (!r.ok) return setResultado({ ok: false, texto: r.erro.mensagem });
    const n = r.dados.transacoesGravadas;
    setResultado({ ok: true, texto: n === 0 ? "Nada novo no banco." : `${n} ${n === 1 ? "transação atualizada" : "transações atualizadas"}.` });
    iniciar(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <Anuncio className="order-first text-sm empty:hidden">
        {ocupado ? (
          <span className="text-texto-suave">Buscando transações novas{banco ? ` no ${banco.replace(/ Empresas$/, "")}` : ""}…</span>
        ) : resultado?.ok ? (
          <Sucesso>{resultado.texto}</Sucesso>
        ) : resultado ? (
          <span className="text-erro">{resultado.texto}</span>
        ) : null}
      </Anuncio>
      <button type="button" onClick={clicar} disabled={ocupado} aria-busy={ocupado || undefined} className={`${botao.secundario} min-w-44`}>
        {ocupado ? (
          <Carregando contexto="sincronizando" tamanho="inline" rotulo="Sincronizando" />
        ) : (
          <>
            <Icone nome="sincronizar" className="size-4" />
            Sincronizar agora
          </>
        )}
      </button>
    </div>
  );
}
