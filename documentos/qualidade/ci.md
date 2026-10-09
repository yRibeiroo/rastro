# CI e proteção da branch `main`

O pipeline está em `.github/workflows/ci.yml` (decisão no [ADR 0015](../arquitetura/decisoes/0015-infraestrutura-como-codigo-e-pipeline.md)). Ele roda em todo pull request e em cada push na `main`.

## Jobs (todos obrigatórios)

| Job | Equivalente local |
|---|---|
| `qualidade` | `npm run lint && npm run tipos && npm run formatar:verificar` |
| `unidade` | `npm run testar:cobertura` |
| `integracao` | `npx supabase start && npx supabase db reset && npm run testar:banco && npm run testar:integracao` |
| `build` | `npm run build` |
| `e2e` | `npm run build && npm run testar:e2e` (com o Supabase local rodando) |
| `lighthouse` | `npm run build && npm run lighthouse` |
| `segredos` | `npm run segredos` |

O CI não usa segredos reais. Não cadastre segredos no GitHub para ele.

## Proteger a `main` (uma vez, no GitHub)

O CI precisa ter rodado pelo menos uma vez para os nomes dos checks aparecerem na lista.

### Pela interface
1. Repositório → **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.
2. Nome: `proteger-main`. **Enforcement status**: Active.
3. **Target branches** → **Add target** → **Include default branch**.
4. Marque:
   - **Restrict deletions**;
   - **Block force pushes**;
   - **Require a pull request before merging** (aprovações: 0 no trabalho solo; a revisão do QA fica registrada em `documentos/qualidade/revisoes.md`) e **Require conversation resolution before merging**;
   - **Require status checks to pass** + **Require branches to be up to date before merging**, adicionando: `qualidade`, `unidade`, `integracao`, `build`, `e2e`, `lighthouse`, `segredos`.
5. **Create**.

### Pelo `gh` (equivalente)
Salve o JSON abaixo como `regras-main.json` e rode `gh api -X POST repos/<dono>/rastro/rulesets --input regras-main.json`:

```json
{
  "name": "proteger-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "qualidade" },
          { "context": "unidade" },
          { "context": "integracao" },
          { "context": "build" },
          { "context": "e2e" },
          { "context": "lighthouse" },
          { "context": "segredos" }
        ]
      }
    }
  ]
}
```

Atenção: rulesets e proteção de branch em repositório **privado** exigem GitHub Pro (ou Team). No plano gratuito com repositório privado, a regra é salva mas não é aplicada; nesse caso, siga a convenção de nunca dar push direto na `main` e use o checklist do PR.

## Também no GitHub
- **Settings → Code security**: ative *Dependabot alerts*, *Dependabot security updates* e *Secret scanning* com *Push protection*, se o plano permitir.
- **Settings → Actions → General → Workflow permissions**: *Read repository contents and packages permissions*.

## Hook local
O `npm install` configura `git config core.hooksPath .githooks`. O pre-commit roda `gitleaks git --staged --redact` (via `node comandos/segredos.mjs --staged`). Sem o gitleaks instalado, o commit é bloqueado com instruções de instalação. Não use `--no-verify`.
