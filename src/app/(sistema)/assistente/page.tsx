import type { Metadata } from "next";
import { Conversa } from "@/componentes/assistente/Conversa";
import { Erro } from "@/componentes/estados/Estados";
import { CabecalhoDaPagina } from "@/componentes/estrutura/CabecalhoDaPagina";
import {
  MAXIMO_DE_CARACTERES,
  MAXIMO_DE_MENSAGENS,
} from "@/regras-de-negocio/agente";
import { carregarRecursos } from "@/regras-de-negocio/interface-web";
import { perguntarAoAssistente } from "@/regras-de-negocio/interface-web/acoes";

export const metadata: Metadata = { title: "Assistente" };

// Uma pergunta pode levar várias chamadas ao modelo (uma por consulta aos dados).
export const maxDuration = 60;

export default async function Assistente() {
  const { assistente } = await carregarRecursos();
  return (
    <>
      <CabecalhoDaPagina
        titulo="Assistente"
        descricao="Pergunte sobre suas finanças e receba a resposta com os números e o período consultado."
      />
      {assistente ? (
        <Conversa
          perguntar={perguntarAoAssistente}
          maximoDeCaracteres={MAXIMO_DE_CARACTERES}
          maximoDeMensagens={MAXIMO_DE_MENSAGENS}
        />
      ) : (
        <Erro
          titulo="O assistente está desligado"
          mensagem="Ligue RECURSO_ASSISTENTE e cadastre a chave da Anthropic para usar o chat."
        />
      )}
    </>
  );
}
