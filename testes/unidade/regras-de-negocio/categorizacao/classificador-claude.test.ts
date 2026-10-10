import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import {
  ClassificadorClaude,
  classificadorClaude,
  MODELO_DO_CLASSIFICADOR,
} from "@/regras-de-negocio/categorizacao";
import type { ClienteDaAnthropic } from "@/regras-de-negocio/categorizacao/adaptadores/claude/classificador-claude";

const opcoes = {
  categorias: [{ codigo: "c1", nome: "Combustível", tipo: "saida" as const }],
  centrosDeCusto: [],
};
const lote = [
  { referencia: "0", descricao: "POSTO IPIRANGA", valorCentavos: -25090, contraparte: "Posto Ipiranga" },
];

function clienteFalso(resposta: unknown) {
  const parse = vi.fn(async (_pedido: unknown) => resposta);
  return { cliente: { beta: { messages: { parse } } } as unknown as ClienteDaAnthropic, parse };
}

describe("ClassificadorClaude (API simulada)", () => {
  it("saída estruturada validada, effort low, fallback do servidor e só os campos mínimos", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const sugestoes = [{ referencia: "0", categoriaCodigo: "c1", centroDeCustoCodigo: null, confianca: 0.9 }];
    const { cliente, parse } = clienteFalso({ stop_reason: "end_turn", parsed_output: { sugestoes } });
    expect(await new ClassificadorClaude(cliente).classificar(lote, opcoes)).toEqual(sugestoes);

    const pedido = parse.mock.calls[0][0] as unknown as Record<string, unknown> & {
      output_config: { effort: string; format: unknown };
      messages: { content: string }[];
    };
    expect(pedido).toMatchObject({
      model: "claude-opus-5-5",
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    expect(pedido.output_config.effort).toBe("low");
    expect(pedido.output_config.format).toBeDefined();
    expect(pedido).not.toHaveProperty("thinking");
    expect(JSON.parse(pedido.messages[0].content)).toEqual({
      categorias: opcoes.categorias,
      centrosDeCusto: [],
      itens: [{ referencia: "0", descricao: "POSTO IPIRANGA", valor: -250.9, contraparte: "Posto Ipiranga" }],
    });
  });

  it("modelo trocado por ANTHROPIC_MODELO não envia o fallback do servidor", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { cliente, parse } = clienteFalso({ stop_reason: "end_turn", parsed_output: { sugestoes: [] } });
    await new ClassificadorClaude(cliente, "claude-sonnet-5-5").classificar(lote, opcoes);
    expect(parse.mock.calls[0][0]).toMatchObject({ model: "claude-sonnet-5-5" });
    expect(parse.mock.calls[0][0]).not.toHaveProperty("fallbacks");
  });

  it("recusa, max_tokens ou saída que não validou → sem sugestão (sem erro)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    for (const resposta of [
      { stop_reason: "refusal", parsed_output: null },
      { stop_reason: "max_tokens", parsed_output: { sugestoes: [] } },
      { stop_reason: "end_turn", parsed_output: null },
    ])
      expect(await new ClassificadorClaude(clienteFalso(resposta).cliente).classificar(lote, opcoes)).toEqual([]);
  });

  it("falha de rede/API → classificador_indisponivel", async () => {
    const parse = vi.fn(async () => {
      throw new Anthropic.APIConnectionError({ message: "offline" });
    });
    const cliente = { beta: { messages: { parse } } } as unknown as ClienteDaAnthropic;
    await expect(new ClassificadorClaude(cliente).classificar(lote, opcoes)).rejects.toMatchObject({
      codigo: "classificador_indisponivel",
    });
  });

  it("lote vazio não chama a API; a fábrica é um singleton com o modelo padrão", async () => {
    const { cliente, parse } = clienteFalso(null);
    expect(await new ClassificadorClaude(cliente).classificar([], opcoes)).toEqual([]);
    expect(parse).not.toHaveBeenCalled();
    const a = classificadorClaude({ apiKey: "sk-teste" });
    expect(classificadorClaude({ apiKey: "outra" })).toBe(a);
    expect(MODELO_DO_CLASSIFICADOR).toBe("claude-opus-5-5");
  });
});
