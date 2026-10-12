import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { ValorMonetario } from "@/componentes/extrato/ValorMonetario";

const lido = (el: HTMLElement) =>
  el.querySelector(".sr-only")!.textContent!.replace(/\s/g, " ");

test("sem sinal, o leitor de tela não ouve 'mais' (valor de comprovante, item)", () => {
  const { container } = render(<ValorMonetario centavos={41463} />);
  expect(lido(container)).toBe("R$ 414,63");
});

test("com sinal (extrato), entrada é 'mais' e saída é 'menos'", () => {
  const { container: a } = render(<ValorMonetario centavos={100} comSinal />);
  const { container: b } = render(<ValorMonetario centavos={-100} />);
  expect(lido(a)).toBe("mais R$ 1,00");
  expect(lido(b)).toBe("menos R$ 1,00");
});
