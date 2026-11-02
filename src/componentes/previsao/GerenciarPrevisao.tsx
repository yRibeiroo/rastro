"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import { ajuda, botao, campo, mensagemDeErro, rotulo } from "@/componentes/formulario/classes";
import { textoParaCentavos } from "@/ferramentas-internas/formatar-moeda";
import type { Categoria, Conta, Id, NovaRecorrencia, Recorrencia, ResultadoDaAcao } from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";

// Recorrências e baixa de ocorrências (Fase 4, ADR 0017).

type Criar = (dados: NovaRecorrencia) => Promise<ResultadoDaAcao<Recorrencia>>;
type Baixar = (dados: { recorrenciaId: Id; data: string; lancar?: boolean }) => Promise<ResultadoDaAcao<{ transacaoId: Id | null }>>;
type Encerrar = (recorrenciaId: Id) => Promise<ResultadoDaAcao<null>>;

function useAcao() {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  async function executar<T>(acao: () => Promise<ResultadoDaAcao<T>>, sucesso: string) {
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

export function NovaRecorrenciaForm({
  contas,
  categorias,
  hoje,
  criar,
}: {
  contas: Array<Conta & { rotulo: string }>;
  categorias: Categoria[];
  hoje: string;
  criar: Criar;
}) {
  const { ocupado, erro, setErro, aviso, executar } = useAcao();
  const [sentido, setSentido] = useState<"saida" | "entrada">("saida");
  const opcoes = categorias.filter((c) => !c.arquivada && (c.tipo === "ambos" || c.tipo === sentido));

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const d = new FormData(f);
        const valor = textoParaCentavos(String(d.get("valor") ?? ""));
        if (!valor) return setErro("Informe um valor maior que zero. Ex.: 1.500,00.");
        const fim = String(d.get("fim") ?? "");
        const ok = await executar(
          () =>
            criar({
              contaId: String(d.get("conta")),
              descricao: String(d.get("descricao") ?? ""),
              valorCentavos: sentido === "saida" ? -valor : valor,
              categoriaId: String(d.get("categoria") ?? "") || null,
              frequencia: String(d.get("frequencia")) as NovaRecorrencia["frequencia"],
              inicio: String(d.get("inicio")),
              fim: fim || null,
            }),
          "Recorrência criada.",
        );
        if (ok) {
          f.reset();
          setSentido("saida");
        }
      }}
      className="grid gap-4 rounded-m border border-borda bg-superficie p-4"
    >
      <h2 className="text-lg font-semibold">Nova conta a pagar ou a receber</h2>
      <fieldset className="flex gap-2">
        <legend className="sr-only">A pagar ou a receber</legend>
        {(["saida", "entrada"] as const).map((s) => (
          <label key={s} className={`${botao.secundario} cursor-pointer has-[:checked]:border-primaria has-[:checked]:bg-primaria-suave`}>
            <input type="radio" name="sentido" value={s} checked={sentido === s} onChange={() => setSentido(s)} className="sr-only" />
            {s === "saida" ? "A pagar" : "A receber"}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="rec-descricao" className={rotulo}>
            Descrição
          </label>
          <input id="rec-descricao" name="descricao" required maxLength={200} placeholder="Ex.: Aluguel, Salário, Internet" className={campo} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="rec-valor" className={rotulo}>
            Valor (R$)
          </label>
          <input id="rec-valor" name="valor" required inputMode="decimal" placeholder="0,00" className={`${campo} valor-monetario`} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="rec-frequencia" className={rotulo}>
            Repete
          </label>
          <select id="rec-frequencia" name="frequencia" defaultValue="mensal" className={campo}>
            <option value="mensal">Todo mês</option>
            <option value="semanal">Toda semana</option>
            <option value="anual">Todo ano</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="rec-inicio" className={rotulo}>
            Primeira data
          </label>
          <input id="rec-inicio" name="inicio" type="date" required defaultValue={hoje} className={campo} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="rec-fim" className={rotulo}>
            Termina em (opcional)
          </label>
          <input id="rec-fim" name="fim" type="date" className={campo} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="rec-conta" className={rotulo}>
            Conta
          </label>
          <select id="rec-conta" name="conta" required className={campo}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="rec-categoria" className={rotulo}>
            Categoria
          </label>
          <select id="rec-categoria" name="categoria" defaultValue="" className={campo}>
            <option value="">Automática (regras e IA)</option>
            {opcoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className={ajuda}>Em conta manual, &quot;Paguei&quot; já lança o valor. Em conta de banco, o lançamento chega pelo extrato.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={ocupado} aria-busy={ocupado || undefined} className={botao.primario}>
          {ocupado ? (
            <Carregando tamanho="inline" rotulo="Criando" />
          ) : (
            <>
              <Icone nome="adicionar" className="size-4" />
              Criar
            </>
          )}
        </button>
        {erro && (
          <p className={mensagemDeErro} role="alert">
            {erro}
          </p>
        )}
        <Anuncio className="empty:hidden">{aviso && <Sucesso>{aviso}</Sucesso>}</Anuncio>
      </div>
    </form>
  );
}

/** "Paguei/Recebi" e "Pular" na linha da ocorrência. */
export function AcoesDaOcorrencia({
  recorrenciaId,
  data,
  entrada,
  descricao,
  baixar,
}: {
  recorrenciaId: Id;
  data: string;
  entrada: boolean;
  descricao: string;
  baixar: Baixar;
}) {
  const { ocupado, erro, executar } = useAcao();
  return (
    <span className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        disabled={ocupado}
        className={botao.secundario}
        aria-label={`${entrada ? "Recebi" : "Paguei"}: ${descricao}`}
        onClick={() => executar(() => baixar({ recorrenciaId, data }), "Marcado.")}
      >
        {ocupado ? <Carregando tamanho="inline" rotulo="Salvando" /> : entrada ? "Recebi" : "Paguei"}
      </button>
      <button
        type="button"
        disabled={ocupado}
        className={botao.fantasma}
        aria-label={`Pular esta ocorrência: ${descricao}`}
        onClick={() => executar(() => baixar({ recorrenciaId, data, lancar: false }), "Pulada.")}
      >
        Pular
      </button>
      {erro && (
        <span className="basis-full text-sm text-erro" role="alert">
          {erro}
        </span>
      )}
    </span>
  );
}

export function EncerrarRecorrencia({ recorrenciaId, descricao, encerrar }: { recorrenciaId: Id; descricao: string; encerrar: Encerrar }) {
  const { ocupado, erro, executar } = useAcao();
  return (
    <span className="flex items-center gap-2">
      {erro && <span className="text-sm text-erro">{erro}</span>}
      <button
        type="button"
        disabled={ocupado}
        className={botao.fantasma}
        aria-label={`Encerrar ${descricao}`}
        onClick={() => {
          if (window.confirm(`Encerrar "${descricao}"? Ela deixa de aparecer na previsão.`))
            executar(() => encerrar(recorrenciaId), "Encerrada.");
        }}
      >
        {ocupado ? <Carregando tamanho="inline" rotulo="Encerrando" /> : "Encerrar"}
      </button>
    </span>
  );
}
