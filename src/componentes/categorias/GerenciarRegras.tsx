"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Anuncio, Sucesso } from "@/componentes/estados/Estados";
import { Icone } from "@/componentes/estrutura/Icone";
import { botao, campo, mensagemDeErro, rotulo } from "@/componentes/formulario/classes";
import type { Categoria, CentroDeCusto, Id, NovaRegra, Regra, ResultadoDaAcao } from "@/regras-de-negocio";
import { Carregando } from "@/identidade-visual/Carregando";

type EdicaoDeRegra = Partial<Pick<Regra, "padrao" | "campo" | "prioridade" | "categoriaId" | "centroDeCustoId" | "ativa">>;

type Props = {
  regras: Regra[];
  categorias: Categoria[];
  centros: CentroDeCusto[];
  criarRegra: (dados: NovaRegra) => Promise<ResultadoDaAcao<{ regra: Regra; transacoesAlteradas: number }>>;
  atualizarRegra: (id: Id, dados: EdicaoDeRegra) => Promise<ResultadoDaAcao<Regra>>;
  removerRegra: (id: Id) => Promise<ResultadoDaAcao<null>>;
};

const ORIGEM: Record<Regra["origem"], string> = { padrao: "sugerida", usuario: "criada por você", correcao: "de uma correção" };

/** Regras (RF-19, RF-22): a primeira que casar vence; a ordem é a prioridade (menor = antes). */
export function GerenciarRegras({ regras, categorias, centros, criarRegra, atualizarRegra, removerRegra }: Props) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);

  const nomeDaCategoria = new Map(categorias.map((c) => [c.id, c.nome]));
  const nomeDoCentro = new Map(centros.map((c) => [c.id, c.nome]));

  async function executar(id: string, acao: () => Promise<ResultadoDaAcao<unknown>>, sucesso: string) {
    setOcupado(id);
    setErro(null);
    const r = await acao();
    setOcupado(null);
    if (!r.ok) return setErro({ id, texto: r.erro.mensagem });
    setEditando(null);
    setExcluir(null);
    setAviso(sucesso);
    iniciar(() => router.refresh());
  }

  function dadosDoFormulario(d: FormData) {
    return {
      padrao: String(d.get("padrao") ?? ""),
      campo: d.get("campo") === "contraparte" ? ("contraparte" as const) : ("descricao" as const),
      categoriaId: String(d.get("categoria")),
      centroDeCustoId: String(d.get("centro") ?? "") || null,
      prioridade: Number(d.get("prioridade")) || 50,
    };
  }

  return (
    <section id="regras" aria-labelledby="titulo-regras" className="grid content-start gap-6">
      <div className="grid gap-1">
        <h2 id="titulo-regras" className="text-xl font-semibold">
          Regras
        </h2>
        <p className="text-sm text-texto-suave">As regras rodam antes da IA, de cima para baixo. A primeira que casar define a categoria.</p>
      </div>

      <Anuncio className="empty:hidden">{aviso && <Sucesso>{aviso}</Sucesso>}</Anuncio>

      {regras.length === 0 ? (
        <p className="rounded-m border border-dashed border-borda-controle px-4 py-6 text-sm text-texto-suave">
          Nenhuma regra ainda. Ao corrigir uma categoria no extrato, o Rastro oferece criar uma.
        </p>
      ) : (
        <ol className="divide-y divide-borda">
          {regras.map((r, i) => (
            <li key={r.id} className="grid gap-3 py-3">
              {editando === r.id ? (
                <FormularioDeRegra
                  regra={r}
                  categorias={categorias}
                  centros={centros}
                  ocupado={ocupado === r.id}
                  erro={erro?.id === r.id ? erro.texto : null}
                  aoCancelar={() => setEditando(null)}
                  rotuloDoBotao="Salvar regra"
                  aoEnviar={(d) => executar(r.id, () => atualizarRegra(r.id, dadosDoFormulario(d)), "Regra atualizada.")}
                />
              ) : (
                <>
                  <div className="grid gap-1">
                    <p className="text-sm">
                      <span className="valor-monetario mr-2 inline-grid min-w-7 place-items-center rounded-full bg-superficie-2 px-1.5 text-xs font-semibold">
                        {r.prioridade}
                      </span>
                      Quando {r.campo === "contraparte" ? "a contraparte" : "a descrição"} contém{" "}
                      <code className="rounded-p bg-superficie-2 px-1.5 py-0.5 font-mono text-[0.85em]">{r.padrao}</code>
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span aria-hidden="true" className="text-texto-suave">
                        →
                      </span>
                      <span className="font-medium">{nomeDaCategoria.get(r.categoriaId) ?? "Categoria removida"}</span>
                      {r.centroDeCustoId && <span className="text-texto-suave">· {nomeDoCentro.get(r.centroDeCustoId)}</span>}
                      <span className="text-xs text-texto-suave">({ORIGEM[r.origem]})</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <label className="mr-2 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm md:min-h-0">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={r.ativa}
                        disabled={ocupado === r.id}
                        onChange={(e) =>
                          executar(r.id, () => atualizarRegra(r.id, { ativa: e.target.checked }), e.target.checked ? "Regra ativada." : "Regra desativada.")
                        }
                        className="size-4 accent-[var(--cor-primaria-texto)]"
                      />
                      {r.ativa ? "Ativa" : "Desativada"}
                    </label>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          executar(r.id, () => atualizarRegra(r.id, { prioridade: Math.max(1, regras[i - 1].prioridade - 1) }), "Regra subiu na lista.")
                        }
                        disabled={ocupado === r.id}
                        className={botao.icone}
                        aria-label={`Subir a regra ${r.padrao}`}
                        title="Subir"
                      >
                        <Icone nome="subir" className="size-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => setEditando(r.id)} className={botao.fantasma} aria-label={`Editar a regra ${r.padrao}`}>
                      Editar
                    </button>
                    {excluir === r.id ? (
                      <span className="flex items-center gap-1" role="group" aria-label={`Excluir a regra ${r.padrao}?`}>
                        <button type="button" onClick={() => executar(r.id, () => removerRegra(r.id), "Regra excluída.")} className={botao.perigo}>
                          {ocupado === r.id ? <Carregando tamanho="inline" rotulo="Excluindo" /> : "Excluir"}
                        </button>
                        <button type="button" onClick={() => setExcluir(null)} className={botao.fantasma}>
                          Cancelar
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setExcluir(r.id)} className={botao.fantasma} aria-label={`Excluir a regra ${r.padrao}`}>
                        Excluir
                      </button>
                    )}
                  </div>
                  {erro?.id === r.id && (
                    <p className={mensagemDeErro} role="alert">
                      {erro.texto}
                    </p>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      <details className="rounded-m border border-borda bg-superficie p-4">
        <summary className="inline-flex h-11 cursor-pointer items-center gap-2 font-medium md:h-9">
          <Icone nome="adicionar" className="size-4" />
          Nova regra
        </summary>
        <div className="pt-4">
          <FormularioDeRegra
            categorias={categorias}
            centros={centros}
            ocupado={ocupado === "nova"}
            erro={erro?.id === "nova" ? erro.texto : null}
            rotuloDoBotao="Criar regra"
            aoEnviar={(d) =>
              executar(
                "nova",
                () => criarRegra({ ...dadosDoFormulario(d), origem: "usuario", aplicarNasExistentes: false }),
                "Regra criada. Vale para as próximas transações.",
              )
            }
          />
        </div>
      </details>
    </section>
  );
}

type PropsDoFormulario = {
regra?: Regra;
categorias: Categoria[];
centros: CentroDeCusto[];
ocupado: boolean;
erro: string | null;
rotuloDoBotao: string;
aoEnviar: (d: FormData) => void;
aoCancelar?: () => void;
};

function FormularioDeRegra({ regra, categorias, centros, ocupado, erro, rotuloDoBotao, aoEnviar, aoCancelar }: PropsDoFormulario) {
  const p = regra?.id ?? "nova";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        aoEnviar(new FormData(e.currentTarget));
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_1fr]">
      <div className="grid gap-1.5">
        <label htmlFor={`${p}-campo`} className={rotulo}>
          Quando
        </label>
        <select id={`${p}-campo`} name="campo" defaultValue={regra?.campo ?? "descricao"} className={campo}>
          <option value="descricao">a descrição</option>
          <option value="contraparte">a contraparte</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${p}-padrao`} className={rotulo}>
          contém o texto
        </label>
        <input id={`${p}-padrao`} name="padrao" required minLength={2} defaultValue={regra?.padrao} placeholder="POSTO" className={`${campo} font-mono uppercase`} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${p}-categoria`} className={rotulo}>
          Categoria
        </label>
        <select id={`${p}-categoria`} name="categoria" required defaultValue={regra?.categoriaId ?? ""} className={campo}>
          <option value="" disabled>
            Escolha
          </option>
          {categorias
            .filter((c) => !c.arquivada || c.id === regra?.categoriaId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${p}-centro`} className={rotulo}>
          Centro de custo (opcional)
        </label>
        <select id={`${p}-centro`} name="centro" defaultValue={regra?.centroDeCustoId ?? ""} className={campo}>
          <option value="">Não mudar</option>
          {centros
            .filter((c) => !c.arquivado || c.id === regra?.centroDeCustoId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${p}-prioridade`} className={rotulo}>
          Prioridade
        </label>
        <input
          id={`${p}-prioridade`}
          name="prioridade"
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          defaultValue={regra?.prioridade ?? 50}
          aria-describedby={`${p}-prioridade-ajuda`}
          className={`${campo} valor-monetario`}
        />
        <span id={`${p}-prioridade-ajuda`} className="text-xs text-texto-suave">
          Menor número vence.
        </span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <button type="submit" disabled={ocupado} aria-busy={ocupado || undefined} className={botao.primario}>
          {ocupado ? <Carregando tamanho="inline" rotulo="Salvando" /> : rotuloDoBotao}
        </button>
        {aoCancelar && (
          <button type="button" onClick={aoCancelar} className={botao.fantasma}>
            Cancelar
          </button>
        )}
      </div>
      {erro && (
        <p className={`${mensagemDeErro} sm:col-span-2`} role="alert">
          {erro}
        </p>
      )}
    </form>
  );
}
