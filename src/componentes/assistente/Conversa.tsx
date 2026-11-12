"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ajuda, botao, mensagemDeErro } from "@/componentes/formulario/classes";
import { Carregando } from "@/identidade-visual/Carregando";
import type { ResultadoDaAcao } from "@/regras-de-negocio";

type Mensagem = { papel: "usuario" | "assistente"; texto: string };

type Props = {
  /** Server Action: recebe a conversa inteira (a última mensagem é a pergunta nova). */
  perguntar: (
    mensagens: Mensagem[],
  ) => Promise<ResultadoDaAcao<{ resposta: string }>>;
  maximoDeCaracteres: number;
  /** O servidor aceita no máximo este número de mensagens: as mais antigas saem do envio. */
  maximoDeMensagens: number;
};

const SUGESTOES = [
  "Quanto gastei com combustível no mês passado?",
  "Quais foram os 5 maiores gastos deste mês?",
  "Compare as saídas de setembro e outubro.",
  "Para onde foi o dinheiro nos últimos 3 meses?",
];

export function Conversa({
  perguntar,
  maximoDeCaracteres,
  maximoDeMensagens,
}: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pensando, iniciar] = useTransition();
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [mensagens, pensando]);

  function enviar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || pensando) return;
    const conversa: Mensagem[] = [
      ...mensagens,
      { papel: "usuario", texto: limpa },
    ];
    setMensagens(conversa);
    setTexto("");
    setErro(null);
    iniciar(async () => {
      const r = await perguntar(conversa.slice(-maximoDeMensagens));
      if (r.ok)
        setMensagens([
          ...conversa,
          { papel: "assistente", texto: r.dados.resposta },
        ]);
      else {
        // A pergunta volta para o campo: nada se perde e dá para tentar de novo.
        setMensagens(mensagens);
        setTexto(limpa);
        setErro(r.erro.mensagem);
      }
      campo.current?.focus();
    });
  }

  return (
    <div className="grid min-w-0 gap-4">
      {mensagens.length === 0 && !pensando && (
        <div className="grid min-w-0 gap-3">
          <p className="text-sm text-texto-suave">Experimente perguntar:</p>
          <ul className="flex flex-wrap gap-2">
            {SUGESTOES.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="min-h-11 rounded-full border border-borda-controle bg-superficie px-4 py-2 text-left text-sm font-medium text-texto transition-colors hover:bg-superficie-2 md:min-h-10"
                  onClick={() => enviar(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol aria-label="Conversa" aria-live="polite" className="grid gap-3">
        {mensagens.map((m, i) => (
          <li
            key={i}
            className={
              m.papel === "usuario"
                ? "ml-auto max-w-[85%] rounded-m bg-primaria-suave px-4 py-3"
                : "mr-auto max-w-[85%] rounded-m border border-borda bg-superficie px-4 py-3"
            }
          >
            <span className="sr-only">
              {m.papel === "usuario" ? "Você: " : "Assistente: "}
            </span>
            <p className="break-words whitespace-pre-wrap">{m.texto}</p>
          </li>
        ))}
        {pensando && (
          <li className="mr-auto rounded-m border border-borda bg-superficie px-4 py-3">
            <Carregando
              contexto="generico"
              tamanho="inline"
              rotulo="Consultando seus dados"
            />
          </li>
        )}
      </ol>
      <div ref={fim} />

      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <label htmlFor="pergunta" className="sr-only">
          Sua pergunta
        </label>
        <div className="flex items-end gap-2">
          <textarea
            ref={campo}
            id="pergunta"
            rows={2}
            value={texto}
            maxLength={maximoDeCaracteres}
            placeholder="Pergunte sobre entradas, saídas, categorias ou transações…"
            aria-describedby={erro ? "pergunta-erro" : "pergunta-ajuda"}
            aria-invalid={erro ? true : undefined}
            className="min-h-11 w-full min-w-0 resize-y rounded-p border border-borda-controle bg-superficie px-3 py-2 text-texto placeholder:text-texto-suave aria-invalid:border-erro"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra a linha.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(texto);
              }
            }}
          />
          <button
            type="submit"
            disabled={pensando || !texto.trim()}
            className={botao.primario}
          >
            Perguntar
          </button>
        </div>
        {erro ? (
          <p id="pergunta-erro" role="alert" className={mensagemDeErro}>
            {erro}
          </p>
        ) : (
          <p id="pergunta-ajuda" className={ajuda}>
            O assistente só consulta: não altera nem apaga nada. Os números vêm
            do seu extrato; confira o período citado em cada resposta.
          </p>
        )}
      </form>
    </div>
  );
}
