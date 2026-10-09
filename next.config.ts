import type { NextConfig } from "next";

const desenvolvimento = process.env.NODE_ENV === "development";

// Origem do Supabase (lida no build). Local: http://127.0.0.1:54321.
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const supabaseRealtime = supabase.replace(/^http/, "ws");

// CSP estática (ADR 0014). Sem nonce porque cacheComponents/PPR servem shells
// estáticos que não recebem nonce por requisição; o Next precisa de scripts inline.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://*.pluggy.ai ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' https://api.pluggy.ai ${supabase} ${supabaseRealtime}`,
  // Widget Pluggy Connect (iframe do zoid) e o iframe de OAuth do banco.
  "frame-src 'self' https://connect.pluggy.ai https://*.pluggy.ai",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Só na Vercel (HTTPS): local e CI usam http://127.0.0.1 para o Supabase.
  ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []),
]
  .map((d) => d.trim())
  .join("; ");

const cabecalhosDeSeguranca = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // allow-popups: o OAuth do Open Finance abre o banco num popup que conversa com a janela.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosDeSeguranca }];
  },
};

export default nextConfig;
