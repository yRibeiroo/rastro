import Link from "next/link";
import { Vazio } from "@/componentes/estados/Estados";
import { botao } from "@/componentes/formulario/classes";

export default function NaoEncontrado() {
  return (
    <main
      id="conteudo"
      className="mx-auto w-full max-w-3xl flex-1 px-4 md:px-8"
    >
      <Vazio
        titulo="Esta página não existe"
        descricao="O endereço pode ter mudado ou a transação foi removida pelo banco."
        acao={
          <Link href="/painel" className={botao.primario}>
            Ir para o painel
          </Link>
        }
      />
    </main>
  );
}
