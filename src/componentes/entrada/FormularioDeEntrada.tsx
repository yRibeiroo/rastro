"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Erro } from "@/componentes/estados/Estados";
import { ajuda, botao, campo, mensagemDeErro, rotulo } from "@/componentes/formulario/classes";
import type { ResultadoDaAcao } from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";

type Estado =
  | { tipo: "inicial"; email: string }
  | { tipo: "enviado"; email: string }
  | { tipo: "erro"; email: string; campo: boolean; mensagem: string };

type Props = {
  /** Server Action injetada (protótipo ou real): mesma resposta para e-mail permitido ou não. */
  enviar: (email: string) => Promise<ResultadoDaAcao<null>>;
  /** Protótipo: ?estado=carregando|erro e ?estado=enviado. */
  forcar?: "carregando" | "erro" | "enviado" | null;
  /** Vindo do callback (ex.: link expirado): faixa acima do formulário. */
  avisoInicial?: string | null;
};

const ESPERA_PARA_REENVIAR = 60;

export function FormularioDeEntrada({ enviar, forcar = null, avisoInicial = null }: Props) {
  const inicial: Estado =
    forcar === "enviado"
      ? { tipo: "enviado", email: "davi@hometec.com.br" }
      : forcar === "erro"
        ? { tipo: "erro", email: "", campo: false, mensagem: "Não conseguimos enviar agora. Tente de novo em instantes." }
        : { tipo: "inicial", email: "" };

  const [estado, acao, enviando] = useActionState(async (_: Estado, dados: FormData): Promise<Estado> => {
    const email = String(dados.get("email") ?? "").trim();
    const r = await enviar(email);
    if (r.ok) return { tipo: "enviado", email };
    return { tipo: "erro", email, campo: r.erro.codigo === "entrada_invalida", mensagem: r.erro.mensagem };
  }, inicial);

  const [reenviar, setReenviar] = useState(0); // força remontar o "Confira" e reiniciar a contagem
  const [outroEmail, setOutroEmail] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);
  const ocupado = enviando || forcar === "carregando";

  if (estado.tipo === "enviado" && !outroEmail) {
    return (
      <Enviado
        key={reenviar}
        email={estado.email}
        aoReenviar={async () => {
          await enviar(estado.email);
          setReenviar((n) => n + 1);
        }}
        aoTrocar={() => {
          setOutroEmail(true);
          requestAnimationFrame(() => campoRef.current?.focus());
        }}
      />
    );
  }

  const erroNoCampo = estado.tipo === "erro" && estado.campo;
  return (
    <form action={(d) => { setOutroEmail(false); return acao(d); }} className="grid gap-5" noValidate>
      {avisoInicial && estado.tipo === "inicial" && <Erro variante="faixa" titulo="Link inválido" mensagem={avisoInicial} />}
      {estado.tipo === "erro" && !estado.campo && <Erro variante="faixa" titulo="Não enviamos" mensagem={estado.mensagem} />}
      <div className="grid gap-2">
        <label htmlFor="email" className={rotulo}>
          E-mail
        </label>
        <input
          ref={campoRef}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          required
          defaultValue={estado.email}
          aria-invalid={erroNoCampo || undefined}
          aria-describedby={erroNoCampo ? "email-erro" : "email-ajuda"}
          className={campo}
        />
        {erroNoCampo ? (
          <p id="email-erro" className={mensagemDeErro}>
            {estado.mensagem}
          </p>
        ) : (
          <p id="email-ajuda" className={ajuda}>
            Sem senha: enviamos um link de acesso para este e-mail.
          </p>
        )}
      </div>
      <button type="submit" disabled={ocupado} aria-busy={ocupado || undefined} className={`${botao.primario} w-full sm:w-64`}>
        {ocupado ? <Carregando contexto="generico" tamanho="inline" rotulo="Enviando" /> : "Enviar link de acesso"}
      </button>
    </form>
  );
}

function Enviado({ email, aoReenviar, aoTrocar }: { email: string; aoReenviar: () => Promise<void>; aoTrocar: () => void }) {
  const [restante, setRestante] = useState(ESPERA_PARA_REENVIAR);
  const [reenviando, setReenviando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titulo.current?.focus();
    const t = setInterval(() => setRestante((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="surgir grid gap-4" role="status">
      <h2 ref={titulo} tabIndex={-1} className="text-2xl font-bold outline-none">
        Confira seu e-mail
      </h2>
      <p className="max-w-[46ch] text-texto-suave">
        Se <strong className="font-semibold text-texto">{email}</strong> tiver acesso ao Rastro, o link chega em instantes. Ele vale por
        alguns minutos e funciona uma vez.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={botao.secundario}
          disabled={restante > 0 || reenviando}
          aria-busy={reenviando || undefined}
          onClick={async () => {
            setReenviando(true);
            await aoReenviar();
          }}
        >
          {reenviando ? (
            <Carregando contexto="generico" tamanho="inline" rotulo="Reenviando" />
          ) : restante > 0 ? (
            <span className="valor-monetario">Reenviar em {restante} s</span>
          ) : (
            "Reenviar link"
          )}
        </button>
        <button type="button" className={botao.fantasma} onClick={aoTrocar}>
          Usar outro e-mail
        </button>
      </div>
    </div>
  );
}
