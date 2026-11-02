"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ajuda, mensagemDeErro } from "@/componentes/formulario/classes";
import type { Id, ResultadoDaAcao, Transacao } from "@/regras-de-negocio";

type Ocultar = (
  transacaoId: Id,
  oculta: boolean,
) => Promise<ResultadoDaAcao<Transacao>>;

/** "Ocultar dos totais" (ADR 0017): checkbox nativo, salva ao marcar. */
export function OcultarDosTotais({
  transacaoId,
  oculta,
  ocultar,
}: {
  transacaoId: Id;
  oculta: boolean;
  ocultar: Ocultar;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [marcado, setMarcado] = useState(oculta);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="grid gap-1">
      <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={marcado}
          disabled={ocupado}
          aria-describedby="ocultar-ajuda"
          className="size-4 accent-[var(--cor-primaria-texto)]"
          onChange={async (e) => {
            const valor = e.currentTarget.checked;
            setMarcado(valor);
            setOcupado(true);
            setErro(null);
            const r = await ocultar(transacaoId, valor);
            setOcupado(false);
            if (!r.ok) {
              setMarcado(!valor);
              return setErro(r.erro.mensagem);
            }
            iniciar(() => router.refresh());
          }}
        />
        <span className="text-sm font-medium">Fora dos totais do painel</span>
      </label>
      <p id="ocultar-ajuda" className={ajuda}>
        Para aplicações, resgates e transferências entre contas suas: continua
        no extrato e no saldo, mas não conta como gasto nem como entrada.
      </p>
      {erro && (
        <p className={mensagemDeErro} role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
