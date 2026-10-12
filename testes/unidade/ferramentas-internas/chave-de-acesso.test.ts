import { describe, expect, it } from "vitest";
import {
  chaveDeAcessoValida,
  extrairChaveDeAcessoDoQr,
} from "@/ferramentas-internas/chave-de-acesso";

// Chave fictícia com dígito verificador módulo 11 correto.
const CHAVE = "17261008123456000190650010000123451234567899";
const DV_ERRADO = `${CHAVE.slice(0, 43)}0`;

describe("chave de acesso (NF-e/NFC-e)", () => {
  it("valida 44 dígitos e o dígito verificador", () => {
    expect(chaveDeAcessoValida(CHAVE)).toBe(true);
    expect(chaveDeAcessoValida(DV_ERRADO)).toBe(false);
    expect(chaveDeAcessoValida(CHAVE.slice(0, 43))).toBe(false);
    expect(chaveDeAcessoValida(`${CHAVE.slice(0, 43)}X`)).toBe(false);
  });

  it("extrai do QR: URL v2 (p=CHAVE|...), v1 (chNFe=), codificada e chave pura com espaços", () => {
    expect(
      extrairChaveDeAcessoDoQr(
        `https://www.sefaz.to.gov.br/nfce/qrcode?p=${CHAVE}|2|1|1|ABCDEF0123`,
      ),
    ).toBe(CHAVE);
    expect(
      extrairChaveDeAcessoDoQr(
        `http://nfce.sefaz.xx.gov.br/qrcode?p=${CHAVE}%7C2%7C1%7C1%7Chash`,
      ),
    ).toBe(CHAVE);
    expect(
      extrairChaveDeAcessoDoQr(
        `https://x.gov.br/consulta?chNFe=${CHAVE}&nVersao=100`,
      ),
    ).toBe(CHAVE);
    expect(extrairChaveDeAcessoDoQr(CHAVE.replace(/(\d{4})/g, "$1 "))).toBe(
      CHAVE,
    );
  });

  it("null para texto qualquer, p ausente, DV inválido ou tipo errado", () => {
    expect(extrairChaveDeAcessoDoQr("olá mundo")).toBeNull();
    expect(
      extrairChaveDeAcessoDoQr("https://sefaz.gov.br/nfce?x=1"),
    ).toBeNull();
    expect(
      extrairChaveDeAcessoDoQr(`https://s.gov.br/q?p=${DV_ERRADO}|2`),
    ).toBeNull();
    expect(extrairChaveDeAcessoDoQr(`${CHAVE}9`)).toBeNull();
    expect(extrairChaveDeAcessoDoQr(42 as unknown as string)).toBeNull();
  });
});
