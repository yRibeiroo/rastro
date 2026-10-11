import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import type { ClienteDaAnthropic } from "@/regras-de-negocio/categorizacao/adaptadores/claude/classificador-claude";
import {
  ErroDeLeitura,
  LeitorDeComprovantesClaude,
  leitorDeComprovantesClaude,
  MODELO_DO_LEITOR,
} from "@/regras-de-negocio/comprovantes";

const CHAVE = "17261008123456000190650010000123451234567899";
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = new TextEncoder().encode("%PDF-1.7 ...");

const lido = {
  legivel: true,
  tipo: "nfce",
  valorTotal: "1234.56",
  data: "2026-10-03",
  emissor: "  Posto Ipiranga Palmas  ",
  documentoEmissor: "12.345.678/0001-90",
  chaveDeAcesso: CHAVE,
  itens: [{ descricao: " Gasolina comum ", quantidade: 40.5, valor: "250,90" }, { descricao: "Água", quantidade: null, valor: null }],
  confianca: 0.876,
};

function clienteFalso(resposta: unknown) {
  const parse = vi.fn(async (_pedido: unknown) => resposta);
  return { cliente: { beta: { messages: { parse } } } as unknown as ClienteDaAnthropic, parse };
}
type Pedido = {
  model: string;
  output_config: { effort: string; format: unknown };
  messages: { content: { type: string; source?: { media_type: string; data: string }; text?: string }[] }[];
};

describe("LeitorDeComprovantesClaude (SDK simulado)", () => {
  it("imagem: bloco image base64 + texto fixo, saída validada e normalizada em centavos", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { cliente, parse } = clienteFalso({ stop_reason: "end_turn", parsed_output: lido });
    const dados = await new LeitorDeComprovantesClaude(cliente).ler({ bytes: JPG, tipoMime: "image/jpeg" });
    expect(dados).toEqual({
      tipo: "nfce",
      valorCentavos: 123456,
      data: "2026-10-03",
      emissor: "Posto Ipiranga Palmas",
      documentoEmissor: "12345678000190",
      chaveDeAcesso: CHAVE,
      itens: [
        { descricao: "Gasolina comum", quantidade: 40.5, valorCentavos: 25090 },
        { descricao: "Água", quantidade: null, valorCentavos: null },
      ],
      confianca: 0.88,
    });
    const pedido = parse.mock.calls[0][0] as unknown as Pedido & Record<string, unknown>;
    expect(pedido).toMatchObject({ model: "claude-opus-5-5", betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    expect(pedido.output_config.effort).toBe("medium");
    expect(pedido).not.toHaveProperty("thinking");
    const [bloco, texto] = pedido.messages[0].content;
    expect(bloco).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(JPG).toString("base64") } });
    // RNF-24: só o arquivo e as instruções fixas, nada da empresa/usuário.
    expect(texto).toEqual({ type: "text", text: "Extraia os dados deste comprovante." });
    expect(pedido.messages).toHaveLength(1);
  });

  it("PDF vai como document; a chave do QR prevalece e vai como dica; modelo trocado não manda fallback", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const outra = { ...lido, chaveDeAcesso: "1".repeat(44), documentoEmissor: "123", data: "03/10/2026" };
    const { cliente, parse } = clienteFalso({ stop_reason: "end_turn", parsed_output: outra });
    const dados = await new LeitorDeComprovantesClaude(cliente, "claude-sonnet-5-5").ler(
      { bytes: PDF, tipoMime: "application/pdf" },
      { chaveDeAcesso: CHAVE },
    );
    expect(dados).toMatchObject({ chaveDeAcesso: CHAVE, documentoEmissor: null, data: null });
    const pedido = parse.mock.calls[0][0] as unknown as Pedido;
    expect(pedido.messages[0].content[0]).toMatchObject({ type: "document", source: { media_type: "application/pdf" } });
    expect(pedido.messages[0].content[1].text).toContain(CHAVE);
    expect(pedido).toMatchObject({ model: "claude-sonnet-5-5" });
    expect(pedido).not.toHaveProperty("fallbacks");
  });

  it("chave lida com DV inválido vira null; dica inválida é ignorada", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { cliente, parse } = clienteFalso({ stop_reason: "end_turn", parsed_output: { ...lido, chaveDeAcesso: `${CHAVE.slice(0, 43)}0` } });
    const dados = await new LeitorDeComprovantesClaude(cliente).ler({ bytes: JPG, tipoMime: "image/png" }, { chaveDeAcesso: "123" });
    expect(dados.chaveDeAcesso).toBeNull();
    expect((parse.mock.calls[0][0] as unknown as Pedido).messages[0].content[1].text).not.toContain("123");
  });

  it.each([
    ["recusa", { stop_reason: "refusal", parsed_output: null }, "recusa"],
    ["max_tokens", { stop_reason: "max_tokens", parsed_output: lido }, "ilegivel"],
    ["fora do schema", { stop_reason: "end_turn", parsed_output: null }, "ilegivel"],
    ["não é comprovante", { stop_reason: "end_turn", parsed_output: { ...lido, legivel: false } }, "ilegivel"],
    ["valor negativo", { stop_reason: "end_turn", parsed_output: { ...lido, valorTotal: "-10.00" } }, "ilegivel"],
    ["valor em texto", { stop_reason: "end_turn", parsed_output: { ...lido, valorTotal: "dez reais" } }, "ilegivel"],
  ])("%s → ErroDeLeitura(%s)", async (_n, resposta, motivo) => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { cliente } = clienteFalso(resposta);
    await expect(new LeitorDeComprovantesClaude(cliente).ler({ bytes: JPG, tipoMime: "image/jpeg" })).rejects.toMatchObject({ motivo });
  });

  it("falha de rede/API → ErroDeLeitura('indisponivel'); a fábrica é singleton com o modelo padrão", async () => {
    const parse = vi.fn(async () => {
      throw new Anthropic.APIConnectionError({ message: "offline" });
    });
    const cliente = { beta: { messages: { parse } } } as unknown as ClienteDaAnthropic;
    const erro = await new LeitorDeComprovantesClaude(cliente).ler({ bytes: JPG, tipoMime: "image/webp" }).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDeLeitura);
    expect(erro.motivo).toBe("indisponivel");
    const a = leitorDeComprovantesClaude({ apiKey: "sk-teste" });
    expect(leitorDeComprovantesClaude({ apiKey: "outra", modelo: "x" })).toBe(a);
    expect(MODELO_DO_LEITOR).toBe("claude-opus-5-5");
  });
});
