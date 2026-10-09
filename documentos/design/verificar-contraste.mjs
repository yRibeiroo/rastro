// Verifica o contraste WCAG 2.x dos pares texto/fundo do Rastro, lendo os valores reais de
// src/identidade-visual/tokens.css. Sai com código 1 se algum par ficar abaixo do mínimo.
// Uso: node documentos/design/verificar-contraste.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(
  fileURLToPath(new URL("../../src/identidade-visual/tokens.css", import.meta.url)),
  "utf8",
);

// --nome: light-dark(#claro, #escuro)
const tokens = {};
for (const [, nome, claro, escuro] of css.matchAll(
  /--(cor-[\w-]+):\s*light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/gi,
)) {
  tokens[nome] = { claro, escuro };
}

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [frente, fundo, mínimo, uso]
const TEXTO = 4.5;
const UI = 3; // texto grande (≥ 24px ou 18,66px negrito) e componentes de interface
const superficies = ["cor-fundo", "cor-superficie", "cor-superficie-2"];
const pares = [
  ...superficies.flatMap((s) => [
    ["cor-texto", s, TEXTO, "texto principal"],
    ["cor-texto-suave", s, TEXTO, "texto secundário"],
    ["cor-primaria-texto", s, TEXTO, "links / texto verde"],
    ["cor-entrada", s, TEXTO, "valor de receita"],
    ["cor-saida", s, TEXTO, "valor de despesa"],
    ["cor-erro", s, TEXTO, "mensagem de erro"],
    ["cor-alerta", s, TEXTO, "mensagem de alerta"],
    ["cor-foco", s, UI, "anel de foco"],
    ["cor-borda-controle", s, UI, "borda de input"],
  ]),
  ["cor-sobre-primaria", "cor-primaria", TEXTO, "texto do botão principal"],
  ["cor-texto", "cor-primaria-suave", TEXTO, "texto em chip/seleção"],
  ["cor-primaria-texto", "cor-primaria-suave", TEXTO, "texto verde em chip"],
  ["cor-erro", "cor-erro-suave", TEXTO, "texto de erro em faixa"],
  ["cor-alerta", "cor-alerta-suave", TEXTO, "texto de alerta em faixa"],
  ["cor-texto", "cor-erro-suave", TEXTO, "texto comum em faixa de erro"],
];

let falhas = 0;
const linhas = [];
for (const modo of ["claro", "escuro"]) {
  for (const [frente, fundo, minimo, uso] of pares) {
    const a = tokens[frente]?.[modo];
    const b = tokens[fundo]?.[modo];
    if (!a || !b) {
      console.error(`Token ausente: ${!a ? frente : fundo}`);
      process.exit(2);
    }
    const r = contraste(a, b);
    const ok = r >= minimo;
    if (!ok) falhas++;
    linhas.push(
      `${ok ? "OK   " : "FALHA"} ${modo.padEnd(6)} ${r.toFixed(2).padStart(5)}:1 (mín ${minimo})  ${frente} ${a} sobre ${fundo} ${b}  [${uso}]`,
    );
  }
}
console.log(linhas.join("\n"));

// Informativo: por que existe --cor-primaria-texto.
const proibido = contraste("#00d1a0", tokens["cor-superficie"].claro);
console.log(`\nINFO  #00D1A0 como texto sobre a superfície clara: ${proibido.toFixed(2)}:1 (não use; use --cor-primaria-texto)`);
console.log(`\n${linhas.length - falhas}/${linhas.length} pares aprovados.`);
if (falhas) {
  console.error(`${falhas} par(es) abaixo do mínimo WCAG AA.`);
  process.exit(1);
}
