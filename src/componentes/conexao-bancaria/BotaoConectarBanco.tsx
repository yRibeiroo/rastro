"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Anuncio, Erro, Sucesso } from "@/componentes/estados/Estados";
import { botao } from "@/componentes/formulario/classes";
import type { Conexao, Id, ResultadoDaAcao } from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";

// O widget (iframe da Pluggy) só existe no navegador e só baixa quando alguém clica.
const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((m) => m.PluggyConnect), { ssr: false });

type Props = {
  /** Server Action que gera o Connect Token (o servidor tira o clientUserId da sessão). */
  iniciarConexao: (opcoes?: { conexaoIdParaReconectar?: Id }) => Promise<ResultadoDaAcao<{ token: string }>>;
  /** Server Action que valida o item na Pluggy e salva a Conexão (upsert). */
  registrarConexao: (idExterno: string) => Promise<ResultadoDaAcao<Conexao>>;
  /** Reconectar: abre o widget em modo de atualização do mesmo item (RF-08), sem criar outra Conexão. */
  reconectar?: { conexaoId: Id; idExterno: string };
  /** Só com PLUGGY_INCLUIR_SANDBOX=true. */
  incluirSandbox?: boolean;
  variante?: keyof typeof botao;
};

type Estado =
  | { tipo: "parado" }
  | { tipo: "preparando" }
  | { tipo: "widget"; token: string }
  | { tipo: "conectando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "sucesso"; mensagem: string };

/**
 * Conectar ou reconectar o banco pelo Pluggy Connect (RF-05 a RF-08). Porte de
 * prototipo-flask/OpenFinanceConnect.tsx: o navegador só recebe o Connect Token de curta duração.
 */
export function BotaoConectarBanco({ iniciarConexao, registrarConexao, reconectar, incluirSandbox = false, variante }: Props) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  const rotulo = reconectar ? "Reconectar" : "Conectar banco";

  async function abrir() {
    setEstado({ tipo: "preparando" });
    const r = await iniciarConexao(reconectar ? { conexaoIdParaReconectar: reconectar.conexaoId } : undefined);
    if (!r.ok) return setEstado({ tipo: "erro", mensagem: "Não foi possível iniciar a conexão com o banco. Tente de novo em instantes." });
    setEstado({ tipo: "widget", token: r.dados.token });
  }

  async function aoConectar(idExterno: string) {
    setEstado({ tipo: "conectando" });
    const r = await registrarConexao(idExterno);
    if (!r.ok) return setEstado({ tipo: "erro", mensagem: "O banco autorizou, mas não conseguimos salvar a conexão. Tente de novo." });
    setEstado({
      tipo: "sucesso",
      mensagem: reconectar ? `${r.dados.banco ?? "Banco"} reconectado.` : `${r.dados.banco ?? "Banco"} conectado. Buscando as transações dos últimos 90 dias.`,
    });
    iniciar(() => router.refresh());
  }

  const ocupado = estado.tipo === "preparando" || estado.tipo === "widget" || estado.tipo === "conectando";

  return (
    <div className="grid justify-items-start gap-3">
      <button type="button" onClick={abrir} disabled={ocupado} aria-busy={ocupado || undefined} className={`${botao[variante ?? "primario"]} min-w-40`}>
        {estado.tipo === "preparando" ? <Carregando contexto="conectando" tamanho="inline" rotulo="Preparando" /> : rotulo}
      </button>

      {estado.tipo === "widget" && (
        <>
          <Carregando contexto="aguardando" tamanho="inline" rotulo="Aguardando a autorização no app do Sicredi" />
          <PluggyConnect
            connectToken={estado.token}
            includeSandbox={incluirSandbox}
            updateItem={reconectar?.idExterno}
            onSuccess={({ item }) => aoConectar(item.id)}
            onError={() => setEstado({ tipo: "erro", mensagem: "O banco não concluiu a autorização. Tente de novo." })}
            onClose={() => setEstado((e) => (e.tipo === "widget" ? { tipo: "parado" } : e))}
            onLoadError={() => setEstado({ tipo: "erro", mensagem: "Não foi possível abrir a janela do banco. Tente de novo." })}
          />
        </>
      )}

      {estado.tipo === "conectando" && (
        <Carregando contexto="conectando" tamanho="inline" rotulo="Conectando ao banco" />
      )}

      <Anuncio className="w-full empty:hidden">
        {estado.tipo === "sucesso" && <Sucesso>{estado.mensagem}</Sucesso>}
      </Anuncio>
      {estado.tipo === "erro" && (
        <Erro
          variante="faixa"
          titulo="Conexão não concluída"
          mensagem={estado.mensagem}
          acao={
            <button type="button" onClick={abrir} className={botao.secundario}>
              Tentar de novo
            </button>
          }
        />
      )}
    </div>
  );
}
