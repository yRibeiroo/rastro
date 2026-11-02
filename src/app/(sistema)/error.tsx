"use client";

import { Erro } from "@/componentes/estados/Estados";
import { botao } from "@/componentes/formulario/classes";

// Erro inesperado em qualquer tela interna: a navegação continua de pé.
export default function ErroDoSistema({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-10">
      <Erro
        titulo="Não foi possível abrir esta tela"
        mensagem="Algo falhou do nosso lado. Seus dados estão salvos; tente de novo em instantes."
        acao={
          <button type="button" onClick={reset} className={botao.primario}>
            Tentar de novo
          </button>
        }
      />
    </div>
  );
}
