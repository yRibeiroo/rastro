import { NextResponse, type NextRequest } from "next/server";
import { lerFiltros } from "@/componentes/extrato/filtros-da-url";
import { ErroDeNegocio, registrarFalha } from "@/regras-de-negocio/erros";
import { servicosDoUsuario } from "@/regras-de-negocio/montagem";

// Exportação do extrato em CSV (Fase 5, ADR 0017): mesmos filtros da tela (?periodo, ?de, ?ate, ?categoria...).
// O proxy já exige sessão; servicosDoUsuario() confere de novo (sessão + allowlist + empresa).

export async function GET(requisicao: NextRequest) {
  const { filtros } = lerFiltros(Object.fromEntries(requisicao.nextUrl.searchParams));
  try {
    const s = await servicosDoUsuario();
    const arquivo = await s.exportacao.exportarExtrato(s.ctx, filtros);
    return new NextResponse(arquivo.conteudo, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${arquivo.nomeDoArquivo}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (erro) {
    if (erro instanceof ErroDeNegocio) {
      if (erro.codigo === "nao_autenticado" || erro.codigo === "email_nao_autorizado")
        return NextResponse.redirect(new URL("/entrar", requisicao.url));
      const status = erro.codigo === "limite_excedido" ? 429 : 400;
      return new NextResponse(erro.mensagemParaUsuario, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    registrarFalha("exportar extrato", erro);
    return new NextResponse("Não foi possível exportar agora. Tente de novo em instantes.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
