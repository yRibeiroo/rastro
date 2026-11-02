"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AreaDeSoltar } from "@/componentes/arquivos/AreaDeSoltar";
import { Anuncio, Erro, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import { botao } from "@/componentes/formulario/classes";
import { extrairChaveDeAcessoDoQr } from "@/ferramentas-internas/chave-de-acesso";
import { Carregando } from "@/identidade-visual/Carregando";
import type { Comprovante, ResultadoDaAcao } from "@/regras-de-negocio";
import { TAMANHO_MAXIMO_DO_ARQUIVO } from "./comprovante";
import { reduzirImagem } from "./reduzir-imagem";

type Props = {
  enviarComprovante: (
    formulario: FormData,
  ) => Promise<ResultadoDaAcao<Comprovante>>;
};

const ACEITOS = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const LIMITE = TAMANHO_MAXIMO_DO_ARQUIVO;

// BarcodeDetector ainda não está nos tipos do TypeScript (Chrome/Android e Safari recentes têm).
type Detector = {
  detect(imagem: ImageBitmap): Promise<{ rawValue: string }[]>;
};
type ConstrutorDeDetector = new (opcoes: { formats: string[] }) => Detector;

/** Tenta ler o QR code da NFC-e no próprio navegador. Sem suporte ou sem QR, segue sem chave. */
async function lerChaveDoQr(arquivo: File): Promise<string | null> {
  const Construtor = (globalThis as { BarcodeDetector?: ConstrutorDeDetector })
    .BarcodeDetector;
  if (!Construtor || !arquivo.type.startsWith("image/")) return null;
  try {
    const imagem = await createImageBitmap(arquivo);
    const codigos = await new Construtor({ formats: ["qr_code"] }).detect(
      imagem,
    );
    imagem.close();
    for (const c of codigos) {
      const chave = extrairChaveDeAcessoDoQr(c.rawValue);
      if (chave) return chave;
    }
  } catch {
    // formato sem suporte ou imagem ilegível: a IA lê a chave impressa, se houver
  }
  return null;
}

const MENSAGEM: Record<Comprovante["situacao"], string> = {
  conciliado: "Lido e ligado à transação do extrato.",
  pendente:
    "Lido. A transação ainda não está no extrato: ele será ligado na próxima importação.",
  ambiguo:
    "Lido. Há mais de uma transação possível: escolha a certa na lista abaixo.",
  erro_de_leitura:
    "Não conseguimos ler este arquivo. Confira na lista e preencha os dados à mão.",
  lendo: "Recebido. A leitura termina em instantes.",
};

/** Botão principal: câmera no celular, arrastar no desktop. Lê o QR antes de enviar. */
export function EnviarComprovante({ enviarComprovante }: Props) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [estado, setEstado] = useState<
    | { tipo: "parado" }
    | { tipo: "lendo" }
    | { tipo: "erro"; mensagem: string }
    | { tipo: "pronto"; c: Comprovante }
  >({
    tipo: "parado",
  });

  async function enviar(original: File) {
    const imagem = original.type.startsWith("image/");
    if (!imagem && original.type !== "application/pdf")
      return setEstado({
        tipo: "erro",
        mensagem: "Envie uma foto ou um PDF do comprovante.",
      });
    if (!imagem && original.size > LIMITE)
      return setEstado({
        tipo: "erro",
        mensagem:
          "O PDF passa de 4 MB. Envie um arquivo menor ou uma foto do comprovante.",
      });
    setEstado({ tipo: "lendo" });
    // O QR é lido na foto original (mais nítida); o envio vai reduzido e sem EXIF/GPS (RNF-24/25).
    const chave = await lerChaveDoQr(original);
    let arquivo: File;
    try {
      arquivo = await reduzirImagem(original, LIMITE);
    } catch {
      return setEstado({
        tipo: "erro",
        mensagem:
          "Não conseguimos abrir esta imagem. Tire a foto de novo ou envie em JPG ou PNG.",
      });
    }
    if (!ACEITOS.includes(arquivo.type) || arquivo.size > LIMITE)
      return setEstado({
        tipo: "erro",
        mensagem:
          "Mesmo reduzida, a imagem passa de 4 MB. Tire a foto mais de perto, só do comprovante.",
      });
    const dados = new FormData();
    dados.set("arquivo", arquivo);
    if (chave) dados.set("chaveDeAcesso", chave);
    const r = await enviarComprovante(dados);
    if (!r.ok) return setEstado({ tipo: "erro", mensagem: r.erro.mensagem });
    setEstado({ tipo: "pronto", c: r.dados });
    iniciar(() => router.refresh());
  }

  const lendo = estado.tipo === "lendo";
  return (
    <div className="grid gap-4">
      <AreaDeSoltar
        rotulo={
          <>
            <Icone nome="comprovante" className="size-4" />
            Enviar comprovante
          </>
        }
        // O celular abre a câmera traseira; o desktop ignora capture e abre o seletor.
        capture="environment"
        accept="image/*,application/pdf"
        desabilitado={lendo}
        aoEscolher={enviar}
        classeDoBotao={botao.primario}
        extra={
          // Só no celular: escolher um PDF ou foto já salva, sem abrir a câmera.
          <label
            className={`${botao.secundario} cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco md:hidden ${lendo ? "pointer-events-none opacity-60" : ""}`}
          >
            Escolher arquivo
            <input
              type="file"
              accept="image/*,application/pdf"
              className="sr-only"
              disabled={lendo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) enviar(f);
              }}
            />
          </label>
        }
        ajuda={
          <>
            Pix, boleto pago, cupom (NFC-e), DANFE ou recibo.{" "}
            <span className="hidden md:inline">
              Arraste a foto ou o PDF para cá.
            </span>
          </>
        }
      />

      <Anuncio>
        {lendo && (
          <Carregando
            contexto="categorizando"
            rotulo="Lendo o comprovante"
            className="py-4"
          />
        )}
        {estado.tipo === "erro" && (
          <Erro
            variante="faixa"
            titulo="Não enviamos"
            mensagem={estado.mensagem}
          />
        )}
        {estado.tipo === "pronto" && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {estado.c.situacao === "erro_de_leitura" ? (
              <p className="text-sm font-medium text-alerta">
                {estado.c.erro === "limite"
                  ? "Limite mensal de leituras atingido. O arquivo foi salvo: preencha os dados na lista."
                  : MENSAGEM.erro_de_leitura}
              </p>
            ) : (
              <Sucesso>{MENSAGEM[estado.c.situacao]}</Sucesso>
            )}
            {estado.c.transacaoId && (
              <Link
                href={`/extrato/${estado.c.transacaoId}`}
                className="text-sm font-medium text-primaria-texto underline underline-offset-4"
              >
                Abrir transação
              </Link>
            )}
          </div>
        )}
      </Anuncio>
    </div>
  );
}
