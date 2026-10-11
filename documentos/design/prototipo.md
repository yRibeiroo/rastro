# Protótipo navegável → telas ligadas ao backend

Até 2026-10-10 as telas usavam dados falsos (`src/componentes/prototipo/`). Agora todas chamam o backend real; a pasta do protótipo foi removida.

## Como cada tela fala com o backend

| Rota | Leituras (`@/regras-de-negocio/interface-web`, Server Components) | Ações (`.../interface-web/acoes`, injetadas como props nos componentes cliente) |
|---|---|---|
| `/entrar` | (nenhuma) | `enviarLinkMagico` |
| layout `(sistema)` | `carregarRecursos` (flag `openFinance`), `carregarConexoes` (status, "Última importação há X dias") | `sair` |
| `/painel` | `carregarPainel` (período e histórico de 6/12 meses), `carregarConexoes`, `carregarRecursos` | (nenhuma) |
| `/extrato` | `carregarExtrato` (paginado por `?cursor=`, 100 por página), `carregarCategoriasERegras`, `carregarCentrosDeCusto`, `carregarComprovantes({ situacao: "conciliado" })` (clipe) | `corrigirCategoria`, `criarRegra`, `sincronizarAgora` (só Open Finance) |
| `/extrato/[id]` | `carregarTransacao`, `carregarCategoriasERegras`, `carregarCentrosDeCusto`, `carregarComprovantes({ situacao: "conciliado" })` | `corrigirCategoria`, `criarRegra`, `anexar`, `gerarLinkTemporario`, `removerAnexo` |
| `/comprovantes` | `carregarComprovantes(filtros)`, `carregarCandidatosParaConciliacao` (para os ambíguos) | `enviarComprovante`, `conciliarComprovante`, `corrigirComprovante`, `removerComprovante`, `gerarLinkTemporario` |
| `/importar` | `carregarImportacoes` | `importarExtrato` |
| `/categorias` | `carregarCategoriasERegras`, `carregarExtrato` (uso no mês) | `criarCategoria`, `atualizarCategoria`, `criarRegra`, `atualizarRegra`, `removerRegra` |
| `/centros-de-custo` | `carregarCentrosDeCusto`, `carregarPainel` | `criarCentroDeCusto`, `atualizarCentroDeCusto` |
| `/conexoes-bancarias` | só com `RECURSO_OPEN_FINANCE` (senão 404): `carregarConexoes` | `iniciarConexao`, `registrarConexao`, `sincronizarAgora` |

Sem sessão ou fora da allowlist, as leituras redirecionam para `/entrar`; recurso inexistente vira 404. Os `try/catch` das páginas usam `unstable_rethrow` para não engolir esses dois.

## Comprovantes no navegador

Antes de enviar: lê o QR da NFC-e com `BarcodeDetector` (quando existe), reduz a imagem para no máximo 2576 px e reencoda em JPEG 0,85 pelo canvas, o que remove EXIF/GPS (RNF-24/25, `src/componentes/comprovantes/reduzir-imagem.ts`). PDF vai como está. Limites conferidos no cliente: comprovante e anexo até 4 MB (limite de 4,5 MB por requisição na Vercel; a imagem perde qualidade em degraus até caber), OFX até 5 MB.

## Revisar os quatro estados

Só em desenvolvimento (`npm run dev`): `?estado=carregando|vazio|erro` força o estado da tela; em `/entrar` também `?estado=enviado`. Em produção o parâmetro é ignorado.

## Navegação

Painel, Extrato, Comprovantes, Importar, Categorias, Centros de custo; Conexões bancárias só com `RECURSO_OPEN_FINANCE=true`. Fluxos novos em `fluxos.md` (5 e 6) e telas em `wireframes.md` (7 e 8).
