"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import { botao } from "@/componentes/formulario/classes";
import type { Anexo, Id, ResultadoDaAcao } from "@/regras-de-negocio";
import { formatarDataHora } from "@/ferramentas-internas/formatar-data";
import { Carregando } from "@/identidade-visual/Carregando";
import { TAMANHO_MAXIMO_DO_ARQUIVO } from "@/componentes/comprovantes/comprovante";

type Props = {
  transacaoId: Id;
  anexos: Anexo[];
  anexar: (
    transacaoId: Id,
    formulario: FormData,
  ) => Promise<ResultadoDaAcao<Anexo>>;
  gerarLinkTemporario: (
    anexoId: Id,
  ) => Promise<ResultadoDaAcao<{ url: string; expiraEm: Date }>>;
  removerAnexo: (anexoId: Id) => Promise<ResultadoDaAcao<null>>;
};

const ACEITOS = "application/pdf,image/jpeg,image/png,image/webp";
const LIMITE = TAMANHO_MAXIMO_DO_ARQUIVO;
const tamanho = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const formatarTamanho = (b: number) =>
  b < 1024 * 1024
    ? `${tamanho.format(b / 1024)} KB`
    : `${tamanho.format(b / 1024 / 1024)} MB`;

/** Anexos opcionais (RF-28, HU-11): enviar, listar, abrir por link temporário e remover. */
export function Anexos({
  transacaoId,
  anexos,
  anexar,
  gerarLinkTemporario,
  removerAnexo,
}: Props) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(
    null,
  );

  async function enviar(arquivo: File) {
    setAviso(null);
    // Mesma regra do servidor, antes de gastar o envio. O servidor confere de novo.
    if (!ACEITOS.split(",").includes(arquivo.type) || arquivo.size > LIMITE)
      return setAviso({
        ok: false,
        texto: "Arquivo não permitido (PDF, JPG, PNG ou WEBP de até 4 MB).",
      });
    setEnviando(arquivo.name);
    const dados = new FormData();
    dados.set("arquivo", arquivo);
    const r = await anexar(transacaoId, dados);
    setEnviando(null);
    if (entrada.current) entrada.current.value = "";
    if (!r.ok) return setAviso({ ok: false, texto: r.erro.mensagem });
    setAviso({ ok: true, texto: `${r.dados.nomeArquivo} anexado.` });
    iniciar(() => router.refresh());
  }

  async function abrir(a: Anexo) {
    // A janela abre no clique (sem bloqueio de pop-up) e recebe a URL assinada depois.
    const janela = window.open("about:blank", "_blank");
    setOcupado(a.id);
    const r = await gerarLinkTemporario(a.id);
    setOcupado(null);
    if (!r.ok) {
      janela?.close();
      return setAviso({ ok: false, texto: r.erro.mensagem });
    }
    if (janela) janela.location.href = r.dados.url;
    else window.location.assign(r.dados.url);
  }

  async function remover(a: Anexo) {
    setOcupado(a.id);
    const r = await removerAnexo(a.id);
    setOcupado(null);
    setConfirmar(null);
    if (!r.ok) return setAviso({ ok: false, texto: r.erro.mensagem });
    setAviso({ ok: true, texto: `${a.nomeArquivo} removido.` });
    iniciar(() => router.refresh());
  }

  return (
    <section aria-labelledby="anexos" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 id="anexos" className="text-xl font-semibold">
            Nota fiscal e comprovantes
          </h2>
          <p className="text-sm text-texto-suave">
            Opcional. PDF, JPG, PNG ou WEBP de até 4 MB.
          </p>
        </div>
        <label
          className={`${botao.secundario} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-foco`}
        >
          <Icone nome="clipe" className="size-4" />
          Anexar arquivo
          <input
            ref={entrada}
            type="file"
            accept={ACEITOS}
            className="sr-only"
            disabled={enviando !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) enviar(f);
            }}
          />
        </label>
      </div>

      <Anuncio className="text-sm empty:hidden">
        {aviso?.ok ? (
          <Sucesso>{aviso.texto}</Sucesso>
        ) : aviso ? (
          <span className="text-erro">{aviso.texto}</span>
        ) : null}
      </Anuncio>

      {anexos.length === 0 && !enviando ? (
        <p className="rounded-m border border-dashed border-borda-controle px-4 py-6 text-sm text-texto-suave">
          Nenhum arquivo. Anexe a nota só quando o contador pedir.
        </p>
      ) : (
        <ul className="divide-y divide-borda rounded-m border border-borda bg-superficie">
          {anexos.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-medium">{a.nomeArquivo}</span>
                <span className="valor-monetario text-xs text-texto-suave">
                  {formatarTamanho(a.tamanhoBytes)} ·{" "}
                  {formatarDataHora(a.criadoEm)}
                </span>
              </div>
              {confirmar === a.id ? (
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-label={`Remover ${a.nomeArquivo}?`}
                >
                  <span className="text-sm">Remover?</span>
                  <button
                    type="button"
                    onClick={() => remover(a)}
                    disabled={ocupado === a.id}
                    className={botao.perigo}
                  >
                    {ocupado === a.id ? (
                      <Carregando tamanho="inline" rotulo="Removendo" />
                    ) : (
                      "Remover"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmar(null)}
                    className={botao.fantasma}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => abrir(a)}
                    disabled={ocupado === a.id}
                    className={botao.fantasma}
                  >
                    {ocupado === a.id ? (
                      <Carregando tamanho="inline" rotulo="Abrindo" />
                    ) : (
                      <>
                        <Icone nome="abrir" className="size-4" />
                        Abrir
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmar(a.id)}
                    className={botao.fantasma}
                  >
                    Remover
                  </button>
                </div>
              )}
            </li>
          ))}
          {enviando && (
            <li className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="truncate text-sm">{enviando}</span>
              <Carregando tamanho="inline" rotulo="Enviando" />
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
