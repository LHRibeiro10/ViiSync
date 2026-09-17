# ViiSync — contexto do projeto

Você está trabalhando no ViiSync, um SaaS de gestão para vendedores do Mercado Livre.
Leia este arquivo inteiro antes de mexer em qualquer coisa.

## O que é

Painel que mostra ao seller de ML o que ele não consegue ver em lugar nenhum:
**quanto sobra de verdade em cada venda**, depois de custo de produto, tarifa do
marketplace, frete subsidiado, imposto, despesa recorrente e gasto adicional.
Também gerencia NFes (XML/PDF), perguntas de comprador do ML e tem um assistente
contextual.

Objetivo atual: **sair de projeto pessoal validado e virar produto vendável.**

## Stack

| Camada | O quê |
|---|---|
| Front | React 19 + Vite 8, React Router 7, ExcelJS. Hospedado na Vercel. |
| Back | Node 24, Express 5, Prisma 7 (`server.js` + `src/modules/*`). Hoje no Railway. |
| Banco | Postgres 17. Migrations versionadas em `backend/prisma/migrations/`. |
| Auth | Caseira: scrypt + sessão em tabela, bearer token no header. Sem JWT. |
| Integração | OAuth do Mercado Livre + webhook + scheduler de sync a cada 30 min. |

Domínio: `viisync.com.br`. Repo: `LHRibeiro10/ViiSync`.

### Estrutura

```
backend/
  server.js                 rotas principais + CORS + boot do scheduler
  src/modules/<dominio>/     .routes .controller .service  (padrão a seguir)
  src/services/analyticsDb.service.js   cálculo de lucro/dashboard (arquivo grande)
  prisma/schema.prisma       20 models
frontend/
  src/pages/<Tela>.jsx + .css   uma pasta flat, um css por página
  src/services/api.js           cliente HTTP central
```

## Convenções

- **Português com acento** em toda string visível ao usuário, front e back.
  O código legado está sem acento — isso é um bug sendo corrigido, não um padrão.
- Módulo novo no back segue `routes → controller → service`. Controller não fala com Prisma.
- Toda query de dado do seller é escopada por `userId` vindo de `req.auth`,
  **nunca** de `req.query`/`req.body`/`req.params`.
- Rota nova nasce com `requireAuth` salvo decisão explícita em contrário.
- CSS por página, sem framework. Segue o visual escuro existente.
- Commits em português, imperativo, prefixo `feat:` / `fix:` / `chore:`.

## Estado conhecido (auditoria de set/2026)

### Bugs e buracos confirmados

1. **`Settings.jsx:53`** — `"desativado".includes("ativado")` é `true`, então a tela
   mostra "Verificação em duas etapas: Ativado" quando não existe 2FA nenhum.
   Comparar valor exato.
2. **Webhook `POST /webhooks/mercadolivre`** é público e não valida origem,
   assinatura, nem idempotência.
3. **Tokens OAuth do ML em texto plano** em `MarketplaceAccount.accessToken/refreshToken`.
4. **Sem rate limit e sem helmet** — `/auth/*` aberto a força bruta.
5. **Scheduler roda in-process** (`setInterval`): duplica se subir mais de uma instância.
6. **Multi-tenancy pela metade** — `Organization` existe no schema mas os dados
   penduram em `userId`. Decisão pendente: assumir single-seller ou ir pra org de verdade.
7. **Session token no `localStorage`** (`api.js:11`).
8. **Sem testes e sem CI.** Só smoke tests manuais em `backend/scripts/`.
9. Rotas órfãs fora do menu: `/alertas`, `/calendario`, `/automacoes`, `/contas`,
   `/integracoes` — essa última é a tela de conectar o ML.
10. Estado vazio não distingue "não conectou" de "conectou e não vendeu".
11. Lixo commitado na raiz (`ml-dismiss-route*.err/out`, `backend/tmp-ml-auth-*.log`)
    e não há `.gitignore` na raiz.

### O que NÃO refatorar sem motivo

O Centro Financeiro, a tela de Integrações, os textos dos estados vazios e o
esquema de auth (scrypt + sessão hasheada) estão bons. São o ativo do produto.

## Backlog priorizado

1. Bug do 2FA + remover os "em breve" de Configurações + implementar troca de senha logado
2. Acentuação em todas as strings visíveis
3. Segurança: validação do webhook, criptografia dos tokens do ML, rate limit + helmet
4. `/integracoes` no menu + checklist de ativação (conectar → custear → ver lucro)
5. Estado vazio inteligente; colapsar os 8 vazios do dashboard em 1
6. Landing page em `/` com o login indo pra `/login`
7. Importação de custo por planilha
8. Migração Railway → Fly.io (região gru) e banco pra região BR
9. Cobrança (Mercado Pago ou Asaas): `Plan`, `Subscription`, webhook, gating

## Como quero trabalhar

- Antes de codar tarefa não-trivial: me mostra o plano em 3-5 linhas e espera meu ok.
- Uma tarefa por branch, uma coisa por commit.
- Não inventa dependência nova sem me perguntar.
- Se achar um problema fora do escopo da tarefa, me avisa e **não conserta junto**.
- Pode ser direto. Se minha ideia for ruim, fala.
