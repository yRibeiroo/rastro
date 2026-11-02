"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import {
  ajuda,
  botao,
  campo,
  mensagemDeErro,
  rotulo,
} from "@/componentes/formulario/classes";
import { textoParaCentavos } from "@/ferramentas-internas/formatar-moeda";
import type {
  Categoria,
  Conta,
  EdicaoDeLancamento,
  Id,
  NovaContaManual,
  NovoLancamento,
  ResultadoDaAcao,
  TipoDeConta,
} from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";

import { TIPOS_DE_CONTA } from "./tipos-de-conta";

// Contas e lançamentos manuais (Fase 2, ADR 0017).

type Criar = (dados: NovaContaManual) => Promise<ResultadoDaAcao<{ id: Id }>>;
type Lancar = (dados: NovoLancamento) => Promise<ResultadoDaAcao<{ id: Id }>>;
type Remover = (transacaoId: Id) => Promise<ResultadoDaAcao<null>>;
type Editar = (
  transacaoId: Id,
  dados: EdicaoDeLancamento,
) => Promise<ResultadoDaAcao<null>>;

/** 3550 → "35,50" (valor sem sinal, para preencher o campo). */
export const centavosParaTexto = (c: number) =>
  (Math.abs(c) / 100).toFixed(2).replace(".", ",");

function useAcao() {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  async function executar<T>(
    acao: () => Promise<ResultadoDaAcao<T>>,
    sucesso: string,
  ) {
    setOcupado(true);
    setErro(null);
    setAviso(null);
    const r = await acao();
    setOcupado(false);
    if (!r.ok) {
      setErro(r.erro.mensagem);
      return false;
    }
    setAviso(sucesso);
    iniciar(() => router.refresh());
    return true;
  }
  return { ocupado, erro, setErro, aviso, executar };
}

const cartao = "grid gap-4 rounded-m border border-borda bg-superficie p-4";

export function NovaConta({ criar }: { criar: Criar }) {
  const { ocupado, erro, setErro, aviso, executar } = useAcao();
  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const d = new FormData(f);
        const saldoTexto = String(d.get("saldo") ?? "").trim();
        const saldo = saldoTexto ? textoParaCentavos(saldoTexto) : 0;
        if (saldo === null)
          return setErro("Saldo inicial inválido. Use, por exemplo, 150,00.");
        const nome = String(d.get("nome") ?? "");
        const ok = await executar(
          () =>
            criar({
              nome,
              tipo: String(d.get("tipo")) as TipoDeConta,
              saldoInicialCentavos: saldo,
            }),
          `Conta ${nome.trim()} criada.`,
        );
        if (ok) f.reset();
      }}
      className={cartao}
    >
      <h2 className="text-lg font-semibold">Nova conta manual</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor="conta-nome" className={rotulo}>
            Nome
          </label>
          <input
            id="conta-nome"
            name="nome"
            required
            maxLength={200}
            placeholder="Ex.: Carteira"
            className={campo}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="conta-tipo" className={rotulo}>
            Tipo
          </label>
          <select
            id="conta-tipo"
            name="tipo"
            defaultValue="dinheiro"
            className={campo}
          >
            {Object.entries(TIPOS_DE_CONTA).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="conta-saldo" className={rotulo}>
            Saldo inicial (R$)
          </label>
          <input
            id="conta-saldo"
            name="saldo"
            inputMode="decimal"
            placeholder="0,00"
            className={`${campo} valor-monetario`}
          />
        </div>
      </div>
      <p className={ajuda}>
        Para o que não vem do banco: dinheiro em espécie, uma conta de outro
        banco, um cofrinho.
      </p>
      <Rodape
        ocupado={ocupado}
        erro={erro}
        aviso={aviso}
        rotuloBotao="Criar conta"
        rotuloOcupado="Criando"
      />
    </form>
  );
}

export function NovoLancamento({
  contas,
  categorias,
  hoje,
  lancar,
}: {
  contas: Conta[];
  categorias: Categoria[];
  hoje: string;
  lancar: Lancar;
}) {
  const { ocupado, erro, setErro, aviso, executar } = useAcao();
  const [sentido, setSentido] = useState<"saida" | "entrada">("saida");
  const opcoes = categorias.filter(
    (c) => !c.arquivada && (c.tipo === "ambos" || c.tipo === sentido),
  );

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const d = new FormData(f);
        const valor = textoParaCentavos(String(d.get("valor") ?? ""));
        if (!valor)
          return setErro("Informe um valor maior que zero. Ex.: 35,90.");
        const categoria = String(d.get("categoria") ?? "");
        const ok = await executar(
          () =>
            lancar({
              contaId: String(d.get("conta")),
              data: String(d.get("data")),
              descricao: String(d.get("descricao") ?? ""),
              valorCentavos: sentido === "saida" ? -valor : valor,
              categoriaId: categoria || null,
            }),
          "Lançamento registrado.",
        );
        if (ok) {
          f.reset();
          setSentido("saida");
        }
      }}
      className={cartao}
    >
      <h2 className="text-lg font-semibold">Novo lançamento</h2>
      <fieldset className="flex gap-2">
        <legend className="sr-only">Tipo do lançamento</legend>
        {(["saida", "entrada"] as const).map((s) => (
          <label
            key={s}
            className={`${botao.secundario} cursor-pointer has-[:checked]:border-primaria has-[:checked]:bg-primaria-suave`}
          >
            <input
              type="radio"
              name="sentido"
              value={s}
              checked={sentido === s}
              onChange={() => setSentido(s)}
              className="sr-only"
            />
            {s === "saida" ? "Saída" : "Entrada"}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="lanc-valor" className={rotulo}>
            Valor (R$)
          </label>
          <input
            id="lanc-valor"
            name="valor"
            required
            inputMode="decimal"
            placeholder="0,00"
            className={`${campo} valor-monetario`}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="lanc-data" className={rotulo}>
            Data
          </label>
          <input
            id="lanc-data"
            name="data"
            type="date"
            required
            defaultValue={hoje}
            className={campo}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="lanc-descricao" className={rotulo}>
            Descrição
          </label>
          <input
            id="lanc-descricao"
            name="descricao"
            required
            maxLength={500}
            placeholder="Ex.: Feira do sábado"
            className={campo}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="lanc-conta" className={rotulo}>
            Conta
          </label>
          <select id="lanc-conta" name="conta" required className={campo}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="lanc-categoria" className={rotulo}>
            Categoria
          </label>
          <select
            id="lanc-categoria"
            name="categoria"
            defaultValue=""
            className={campo}
          >
            <option value="">Automática (regras e IA)</option>
            {opcoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Rodape
        ocupado={ocupado}
        erro={erro}
        aviso={aviso}
        rotuloBotao="Lançar"
        rotuloOcupado="Lançando"
      />
    </form>
  );
}

function Rodape({
  ocupado,
  erro,
  aviso,
  rotuloBotao,
  rotuloOcupado,
  semIcone,
}: {
  ocupado: boolean;
  erro: string | null;
  aviso: string | null;
  rotuloBotao: string;
  rotuloOcupado: string;
  semIcone?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={ocupado}
        aria-busy={ocupado || undefined}
        className={botao.primario}
      >
        {ocupado ? (
          <Carregando tamanho="inline" rotulo={rotuloOcupado} />
        ) : (
          <>
            {!semIcone && <Icone nome="adicionar" className="size-4" />}
            {rotuloBotao}
          </>
        )}
      </button>
      {erro && (
        <p className={mensagemDeErro} role="alert">
          {erro}
        </p>
      )}
      <Anuncio className="empty:hidden">
        {aviso && <Sucesso>{aviso}</Sucesso>}
      </Anuncio>
    </div>
  );
}

/** Detalhe da transação: corrigir data, descrição e valor de um lançamento manual. */
export function EditarLancamento({
  transacaoId,
  data,
  descricao,
  valorCentavos,
  editar,
}: {
  transacaoId: Id;
  data: string;
  descricao: string;
  valorCentavos: number;
  editar: Editar;
}) {
  const { ocupado, erro, setErro, aviso, executar } = useAcao();
  return (
    <details className="rounded-m border border-borda bg-superficie p-4">
      <summary className="cursor-pointer font-medium">
        Editar lançamento
      </summary>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          const valor = textoParaCentavos(String(d.get("valor") ?? ""));
          if (!valor)
            return setErro("Informe um valor maior que zero. Ex.: 35,90.");
          await executar(
            () =>
              editar(transacaoId, {
                data: String(d.get("data")),
                descricao: String(d.get("descricao") ?? ""),
                valorCentavos: d.get("sentido") === "entrada" ? valor : -valor,
              }),
            "Lançamento atualizado.",
          );
        }}
        className="grid gap-4 pt-4 sm:grid-cols-2"
      >
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="editar-descricao" className={rotulo}>
            Descrição
          </label>
          <input
            id="editar-descricao"
            name="descricao"
            required
            maxLength={500}
            defaultValue={descricao}
            className={campo}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="editar-valor" className={rotulo}>
            Valor (R$)
          </label>
          <div className="flex gap-2">
            <select
              name="sentido"
              aria-label="Tipo do lançamento"
              defaultValue={valorCentavos < 0 ? "saida" : "entrada"}
              className={campo}
            >
              <option value="saida">Saída</option>
              <option value="entrada">Entrada</option>
            </select>
            <input
              id="editar-valor"
              name="valor"
              required
              inputMode="decimal"
              defaultValue={centavosParaTexto(valorCentavos)}
              className={`${campo} valor-monetario`}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="editar-data" className={rotulo}>
            Data
          </label>
          <input
            id="editar-data"
            name="data"
            type="date"
            required
            defaultValue={data}
            className={campo}
          />
        </div>
        <div className="sm:col-span-2">
          <Rodape
            ocupado={ocupado}
            erro={erro}
            aviso={aviso}
            rotuloBotao="Salvar"
            rotuloOcupado="Salvando"
            semIcone
          />
        </div>
      </form>
    </details>
  );
}

/** Detalhe da transação: apagar um lançamento manual (volta para o extrato). */
export function ApagarLancamento({
  transacaoId,
  remover,
}: {
  transacaoId: Id;
  remover: Remover;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={ocupado}
        aria-busy={ocupado || undefined}
        className={botao.perigo}
        onClick={async () => {
          if (
            !window.confirm(
              "Apagar este lançamento? O saldo da conta é ajustado.",
            )
          )
            return;
          setOcupado(true);
          setErro(null);
          const r = await remover(transacaoId);
          setOcupado(false);
          if (!r.ok) return setErro(r.erro.mensagem);
          router.push("/extrato");
        }}
      >
        {ocupado ? (
          <Carregando tamanho="inline" rotulo="Apagando" />
        ) : (
          "Apagar lançamento"
        )}
      </button>
      {erro && (
        <p className={mensagemDeErro} role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
