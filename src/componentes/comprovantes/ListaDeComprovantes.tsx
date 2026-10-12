"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import { ValorMonetario } from "@/componentes/extrato/ValorMonetario";
import {
  ajuda,
  botao,
  campo,
  mensagemDeErro,
  rotulo,
} from "@/componentes/formulario/classes";
import { formatarData } from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";
import type {
  CampoCorrigivel,
  Comprovante,
  DadosDoComprovante,
  Id,
  ResultadoDaAcao,
  Transacao,
} from "@/regras-de-negocio";
import {
  CONFIANCA_BAIXA,
  lerValorEmCentavos,
  listarCamposCorrigidos,
  mascararDocumento,
  ROTULO_DA_SITUACAO,
  TIPOS,
  valorParaCampo,
} from "./comprovante";

export type ComprovanteNaLista = Comprovante & { anexoId: Id | null };
/** Transação candidata à conciliação (CandidatoAConciliacao do backend). */
export type Candidato = Pick<
  Transacao,
  "id" | "data" | "valorCentavos" | "descricao" | "contraparte"
>;

export type AcoesDosComprovantes = {
  conciliarComprovante: (
    comprovanteId: Id,
    transacaoId: Id,
  ) => Promise<ResultadoDaAcao<Comprovante>>;
  corrigirComprovante: (
    comprovanteId: Id,
    dados: Partial<DadosDoComprovante>,
  ) => Promise<ResultadoDaAcao<Comprovante>>;
  removerComprovante: (comprovanteId: Id) => Promise<ResultadoDaAcao<null>>;
  desfazerConciliacao: (
    comprovanteId: Id,
  ) => Promise<ResultadoDaAcao<Comprovante>>;
  gerarLinkTemporario: (
    anexoId: Id,
  ) => Promise<ResultadoDaAcao<{ url: string; expiraEm: Date }>>;
  /** RF-41 "Ler de novo". Ausente quando a leitura por IA está desligada. */
  lerComprovanteDeNovo?: (
    comprovanteId: Id,
  ) => Promise<ResultadoDaAcao<Comprovante>>;
};

type Props = AcoesDosComprovantes & {
  comprovantes: ComprovanteNaLista[];
  /** Candidatos dos comprovantes "ambiguo", lidos no servidor. */
  candidatos: Record<Id, Candidato[]>;
};

type Aviso = { ok: boolean; texto: string } | null;

export function ListaDeComprovantes({
  comprovantes,
  candidatos,
  ...acoes
}: Props) {
  const [aviso, setAviso] = useState<Aviso>(null);
  return (
    <div className="grid gap-3">
      <Anuncio className="text-sm empty:hidden">
        {aviso?.ok ? (
          <Sucesso>{aviso.texto}</Sucesso>
        ) : aviso ? (
          <span className="text-erro">{aviso.texto}</span>
        ) : null}
      </Anuncio>
      <ul className="grid gap-3">
        {comprovantes.map((c) => (
          <ItemDoComprovante
            key={c.id}
            comprovante={c}
            candidatos={candidatos[c.id] ?? []}
            acoes={acoes}
            avisar={setAviso}
          />
        ))}
      </ul>
    </div>
  );
}

const COR_DA_SITUACAO: Record<Comprovante["situacao"], string> = {
  conciliado: "bg-primaria",
  pendente: "bg-texto-suave",
  ambiguo: "bg-alerta",
  erro_de_leitura: "bg-erro",
  lendo: "bg-primaria animate-pulse motion-reduce:animate-none",
};

function Situacao({ situacao }: { situacao: Comprovante["situacao"] }) {
  const texto =
    situacao === "ambiguo"
      ? "text-alerta"
      : situacao === "erro_de_leitura"
        ? "text-erro"
        : "text-texto";
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${COR_DA_SITUACAO[situacao]}`}
      />
      <span className={texto}>{ROTULO_DA_SITUACAO[situacao]}</span>
    </span>
  );
}

/** Miniatura por link temporário (60 s). PDF ou sem anexo: ícone. */
export function Miniatura({
  anexoId,
  gerarLinkTemporario,
  tamanho = "size-14",
}: {
  anexoId: Id | null;
  gerarLinkTemporario: AcoesDosComprovantes["gerarLinkTemporario"];
  tamanho?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (!anexoId) return;
    let vivo = true;
    gerarLinkTemporario(anexoId).then(
      (r) => vivo && (r.ok ? setUrl(r.dados.url) : setFalhou(true)),
    );
    return () => {
      vivo = false;
    };
  }, [anexoId, gerarLinkTemporario]);

  return (
    <span
      className={`grid ${tamanho} shrink-0 place-items-center overflow-hidden rounded-m border border-borda bg-superficie-2 text-texto-suave`}
    >
      {url && !falhou ? (
        // URL assinada e curta do Storage: next/image não cabe (domínio dinâmico, sem cache).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          onError={() => setFalhou(true)}
        />
      ) : (
        <Icone nome="extrato" />
      )}
    </span>
  );
}

function ItemDoComprovante({
  comprovante: c,
  candidatos,
  acoes,
  avisar,
}: {
  comprovante: ComprovanteNaLista;
  candidatos: Candidato[];
  acoes: AcoesDosComprovantes;
  avisar: (a: Aviso) => void;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [modo, setModo] = useState<"ver" | "corrigir" | "remover">("ver");
  const [ocupado, setOcupado] = useState(false);
  const [relendo, setRelendo] = useState(false);
  const id = useId();
  const duvidosa = c.confianca !== null && c.confianca < CONFIANCA_BAIXA;
  const documento = mascararDocumento(c.documentoEmissor);
  const titulo = c.tipo ? TIPOS[c.tipo] : "Comprovante";

  async function executar<T>(
    acao: () => Promise<ResultadoDaAcao<T>>,
    sucesso: string | ((dados: T) => NonNullable<Aviso>),
  ) {
    setOcupado(true);
    const r = await acao();
    setOcupado(false);
    if (!r.ok) return avisar({ ok: false, texto: r.erro.mensagem });
    avisar(
      typeof sucesso === "string"
        ? { ok: true, texto: sucesso }
        : sucesso(r.dados),
    );
    setModo("ver");
    iniciar(() => router.refresh());
  }

  const lerDeNovo = acoes.lerComprovanteDeNovo;
  const podeLerDeNovo =
    lerDeNovo &&
    (c.situacao === "erro_de_leitura" || (duvidosa && c.situacao !== "lendo"));
  async function releitura() {
    if (!lerDeNovo) return;
    setRelendo(true);
    await executar(
      () => lerDeNovo(c.id),
      (novo) =>
        novo.situacao === "erro_de_leitura"
          ? {
              ok: false,
              texto:
                novo.erro === "limite"
                  ? "Limite mensal de leituras atingido."
                  : "Não conseguimos ler de novo. Preencha os dados à mão.",
            }
          : { ok: true, texto: "Comprovante lido de novo." },
    );
    setRelendo(false);
  }

  return (
    <li
      aria-labelledby={`${id}-titulo`}
      className={`grid min-w-0 gap-4 rounded-m border bg-superficie p-4 ${c.alerta ? "border-alerta/60" : "border-borda"}`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
        <Miniatura
          anexoId={c.anexoId}
          gerarLinkTemporario={acoes.gerarLinkTemporario}
        />
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 id={`${id}-titulo`} className="text-base font-semibold">
              {titulo}
              {c.data && (
                <span className="font-normal text-texto-suave">
                  {" "}
                  de {formatarData(c.data)}
                </span>
              )}
            </h3>
            {c.valorCentavos !== null && (
              <ValorMonetario
                centavos={c.valorCentavos}
                className="text-lg font-semibold"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="min-w-0 truncate text-sm text-texto-suave">
              {c.emissor ?? "Emissor não identificado"}
              {documento && (
                <span className="valor-monetario"> · {documento}</span>
              )}
            </p>
            <Situacao situacao={c.situacao} />
          </div>
        </div>
      </div>

      {c.situacao === "lendo" && (
        <Carregando
          contexto="categorizando"
          tamanho="inline"
          rotulo="Lendo o comprovante"
        />
      )}
      {c.situacao === "erro_de_leitura" && (
        <p className="rounded-m bg-erro-suave px-3 py-2 text-sm">
          {c.erro === "limite"
            ? "Limite mensal de leituras atingido. Preencha os dados à mão ou envie de novo no mês que vem."
            : "Não conseguimos ler este arquivo. Preencha os dados à mão ou envie uma foto mais nítida."}
        </p>
      )}
      {duvidosa && c.situacao !== "erro_de_leitura" && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-m bg-alerta-suave px-3 py-2 text-sm">
          <span className="rounded-full border border-alerta/50 px-2.5 py-0.5 text-xs font-semibold text-alerta">
            Confira os dados lidos
          </span>
          <span>
            A IA teve pouca certeza (
            <span className="valor-monetario">
              {Math.round((c.confianca ?? 0) * 100)}%
            </span>
            ). Confira o valor e a data.
          </span>
        </p>
      )}
      {c.alerta === "sem_transacao_no_extrato" ? (
        <div className="flex gap-2.5 rounded-m bg-alerta-suave px-3 py-2 text-sm">
          <Icone nome="atencao" className="mt-0.5 size-4 text-alerta" />
          <p>
            <strong className="font-semibold text-alerta">
              Sem transação no extrato.
            </strong>{" "}
            O extrato desta data foi importado há mais de 10 dias e o pagamento
            não apareceu. Importe o extrato daquele período ou ligue à transação
            certa
            {candidatos.length > 0 ? " abaixo" : " corrigindo o valor e a data"}
            .{" "}
            <Link
              href="/importar"
              className="font-medium whitespace-nowrap text-primaria-texto underline underline-offset-4"
            >
              Importar extrato
            </Link>
          </p>
        </div>
      ) : (
        c.situacao === "pendente" && (
          <p className="text-sm text-texto-suave">
            A transação ainda não está no extrato. O Rastro tenta de novo a cada
            importação.
          </p>
        )
      )}
      {c.camposCorrigidos.length > 0 && (
        <p className="text-xs text-texto-suave">
          <span className="font-medium text-texto">Corrigido por você:</span>{" "}
          {listarCamposCorrigidos(c.camposCorrigidos)}. Uma nova leitura não
          muda
          {c.camposCorrigidos.length === 1 ? " esse campo" : " esses campos"}.
        </p>
      )}

      {c.itens.length > 0 && (
        <details className="text-sm">
          <summary className="inline-flex h-11 cursor-pointer items-center text-texto-suave md:h-9">
            {c.itens.length} {c.itens.length === 1 ? "item" : "itens"}
          </summary>
          <ul className="divide-y divide-borda">
            {c.itens.map((item, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-4 py-1.5"
              >
                <span className="min-w-0">
                  {item.quantidade !== null && (
                    <span className="valor-monetario text-texto-suave">
                      {item.quantidade}×{" "}
                    </span>
                  )}
                  {item.descricao}
                </span>
                {item.valorCentavos !== null && (
                  <ValorMonetario centavos={item.valorCentavos} />
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {(c.situacao === "ambiguo" || c.alerta) &&
        candidatos.length > 0 &&
        modo === "ver" && (
          <EscolherTransacao
            candidatos={candidatos}
            ocupado={ocupado}
            aoEscolher={(transacaoId) =>
              executar(
                () => acoes.conciliarComprovante(c.id, transacaoId),
                "Comprovante ligado à transação.",
              )
            }
          />
        )}

      {modo === "corrigir" && (
        <FormularioDeCorrecao
          comprovante={c}
          ocupado={ocupado}
          aoCancelar={() => setModo("ver")}
          aoSalvar={(dados) =>
            executar(
              () => acoes.corrigirComprovante(c.id, dados),
              "Dados corrigidos.",
            )
          }
        />
      )}

      {modo !== "corrigir" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-3">
          {c.transacaoId && (
            <Link
              href={`/extrato/${c.transacaoId}`}
              className={botao.secundario}
            >
              Abrir transação
            </Link>
          )}
          {modo === "remover" ? (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Remover este comprovante?"
            >
              <span className="text-sm">
                Remover o comprovante e o arquivo?
              </span>
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  executar(
                    () => acoes.removerComprovante(c.id),
                    "Comprovante removido.",
                  )
                }
                className={botao.perigo}
              >
                {ocupado ? (
                  <Carregando tamanho="inline" rotulo="Removendo" />
                ) : (
                  "Remover"
                )}
              </button>
              <button
                type="button"
                onClick={() => setModo("ver")}
                className={botao.fantasma}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              {c.situacao === "conciliado" && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    executar(
                      () => acoes.desfazerConciliacao(c.id),
                      "Conciliação desfeita. O comprovante voltou a pendente.",
                    )
                  }
                  className={botao.fantasma}
                >
                  Desligar da transação
                </button>
              )}
              {podeLerDeNovo && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={releitura}
                  className={botao.secundario}
                >
                  {relendo ? (
                    <Carregando
                      contexto="categorizando"
                      tamanho="inline"
                      rotulo="Lendo de novo"
                    />
                  ) : (
                    "Ler de novo"
                  )}
                </button>
              )}
              {c.situacao !== "lendo" && (
                <button
                  type="button"
                  onClick={() => setModo("corrigir")}
                  className={botao.fantasma}
                >
                  {c.situacao === "erro_de_leitura"
                    ? "Preencher dados"
                    : "Corrigir dados"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setModo("remover")}
                className={botao.fantasma}
              >
                Remover
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function EscolherTransacao({
  candidatos,
  ocupado,
  aoEscolher,
}: {
  candidatos: Candidato[];
  ocupado: boolean;
  aoEscolher: (id: Id) => void;
}) {
  const [escolhida, setEscolhida] = useState<Id | null>(null);
  const grupo = useId(); // um grupo de rádios por comprovante (vários ambíguos na mesma tela)
  return (
    <fieldset className="grid gap-2 rounded-m border border-alerta/40 p-3">
      <legend className="px-1 text-sm font-semibold">
        Qual destas transações é este comprovante?
      </legend>
      {candidatos.map((t) => (
        <label
          key={t.id}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-p px-2 py-1.5 text-sm hover:bg-superficie-2 has-checked:bg-primaria-suave"
        >
          <input
            type="radio"
            name={grupo}
            value={t.id}
            onChange={() => setEscolhida(t.id)}
            className="size-4 accent-[var(--cor-primaria-texto)]"
          />
          <span className="grid min-w-0 flex-1">
            <span className="truncate font-medium">{t.descricao}</span>
            <span className="text-xs text-texto-suave">
              {formatarData(t.data)}
              {t.contraparte && ` · ${t.contraparte}`}
            </span>
          </span>
          <ValorMonetario centavos={t.valorCentavos} comSinal />
        </label>
      ))}
      <button
        type="button"
        disabled={!escolhida || ocupado}
        onClick={() => escolhida && aoEscolher(escolhida)}
        className={`${botao.primario} w-fit`}
      >
        {ocupado ? (
          <Carregando tamanho="inline" rotulo="Ligando" />
        ) : (
          "Ligar à transação"
        )}
      </button>
    </fieldset>
  );
}

function FormularioDeCorrecao({
  comprovante: c,
  ocupado,
  aoCancelar,
  aoSalvar,
}: {
  comprovante: Comprovante;
  ocupado: boolean;
  aoCancelar: () => void;
  aoSalvar: (dados: Partial<DadosDoComprovante>) => void;
}) {
  const id = useId();
  const [erroNoValor, setErroNoValor] = useState(false);
  const corrigido = (campo: CampoCorrigivel) =>
    c.camposCorrigidos.includes(campo) && (
      <p className={ajuda}>Corrigido por você</p>
    );

  return (
    <form
      className="grid gap-4 rounded-m bg-superficie-2 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const valorCentavos = lerValorEmCentavos(String(f.get("valor") ?? ""));
        setErroNoValor(valorCentavos === null);
        if (valorCentavos === null) return;
        const emissor = String(f.get("emissor") ?? "").trim();
        aoSalvar({
          tipo: f.get("tipo") as DadosDoComprovante["tipo"],
          valorCentavos,
          data: String(f.get("data") ?? "") || null,
          emissor: emissor || null,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor={`${id}-tipo`} className={rotulo}>
            Tipo
          </label>
          <select
            id={`${id}-tipo`}
            name="tipo"
            defaultValue={c.tipo ?? "outro"}
            className={campo}
          >
            {Object.entries(TIPOS).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
          {corrigido("tipo")}
        </div>
        <div className="grid gap-2">
          <label htmlFor={`${id}-valor`} className={rotulo}>
            Valor (R$)
          </label>
          <input
            id={`${id}-valor`}
            name="valor"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={valorParaCampo(c.valorCentavos)}
            aria-invalid={erroNoValor || undefined}
            aria-describedby={erroNoValor ? `${id}-valor-erro` : undefined}
            className={`${campo} valor-monetario`}
          />
          {erroNoValor && (
            <p id={`${id}-valor-erro`} className={mensagemDeErro}>
              Digite o valor, por exemplo 1.234,56.
            </p>
          )}
          {corrigido("valorCentavos")}
        </div>
        <div className="grid gap-2">
          <label htmlFor={`${id}-data`} className={rotulo}>
            Data
          </label>
          <input
            id={`${id}-data`}
            name="data"
            type="date"
            defaultValue={c.data ?? ""}
            className={campo}
          />
          {corrigido("data")}
        </div>
        <div className="grid gap-2">
          <label htmlFor={`${id}-emissor`} className={rotulo}>
            Emissor ou favorecido
          </label>
          <input
            id={`${id}-emissor`}
            name="emissor"
            autoComplete="off"
            defaultValue={c.emissor ?? ""}
            className={campo}
          />
          {corrigido("emissor")}
        </div>
      </div>
      <p className={ajuda}>
        Ao salvar, o Rastro procura de novo a transação com esse valor e data.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={ocupado} className={botao.primario}>
          {ocupado ? (
            <Carregando tamanho="inline" rotulo="Salvando" />
          ) : (
            "Salvar"
          )}
        </button>
        <button type="button" onClick={aoCancelar} className={botao.fantasma}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
