# Deploy do Backend no Railway (producao inicial)

## Checklist rapido (5 min)

1. Garanta que o codigo do `backend` esteja no GitHub (Railway faz deploy do repo, nao da pasta local).
2. No Railway, crie o servico apontando para a pasta `backend` (Root Directory).
3. Defina todas as envs obrigatorias no Railway:
   - `DATABASE_URL`
   - `MERCADOLIVRE_API_MODE=auto`
   - `MERCADOLIVRE_API_BASE_URL=https://api.mercadolibre.com`
   - `MERCADOLIVRE_AUTH_BASE_URL=https://auth.mercadolivre.com.br/authorization`
   - `MERCADOLIVRE_OAUTH_TOKEN_URL=https://api.mercadolibre.com/oauth/token`
   - `MERCADOLIVRE_CLIENT_ID=<seu_client_id>`
   - `MERCADOLIVRE_CLIENT_SECRET=<seu_client_secret>`
   - `MERCADOLIVRE_REDIRECT_URI=https://<railway-public-domain>/integrations/mercadolivre/oauth/callback`
4. Publique e valide:
   - `GET https://<railway-public-domain>/` retorna `200`
5. Execute OAuth do Mercado Livre:
   - `GET /integrations/mercadolivre/auth/url`
   - abra a URL retornada, autorize, conclua callback
6. Rode o smoke de deploy:
   - `DEPLOY_API_BASE_URL=https://<railway-public-domain>`
   - `npm run deploy:smoke`
7. No frontend, configure:
   - `VITE_API_BASE_URL=https://<railway-public-domain>`

## 1) Criar servico no Railway

1. No Railway, crie um novo projeto a partir do repositorio GitHub.
2. Configure o servico para usar a pasta `backend` como root.
3. Start command: `npm run start`.
4. Regiao recomendada: `US East`.

O arquivo `railway.toml` deste backend ja fixa o start command para `npm run start`.

## 2) Variaveis de ambiente no Railway

Configure no painel do Railway:

- `DATABASE_URL`
- `MERCADOLIVRE_API_MODE=auto`
- `MERCADOLIVRE_API_BASE_URL=https://api.mercadolibre.com`
- `MERCADOLIVRE_AUTH_BASE_URL=https://auth.mercadolivre.com.br/authorization`
- `MERCADOLIVRE_OAUTH_TOKEN_URL=https://api.mercadolibre.com/oauth/token`
- `MERCADOLIVRE_CLIENT_ID=<seu_client_id>`
- `MERCADOLIVRE_CLIENT_SECRET=<seu_client_secret>`
- `MERCADOLIVRE_REDIRECT_URI=https://<railway-public-domain>/integrations/mercadolivre/oauth/callback`
- `MERCADOLIVRE_ACCESS_TOKEN=` (vazio inicialmente)
- `MERCADOLIVRE_SELLER_ID=` (vazio inicialmente)

Para validar se o ambiente esta completo:

```bash
npm run check:env:railway
```

## 3) Configurar app do Mercado Livre (OAuth)

Nas redirect URIs do app:

- `http://localhost:3001/integrations/mercadolivre/oauth/callback` (dev)
- `https://<railway-public-domain>/integrations/mercadolivre/oauth/callback` (producao inicial)

Fluxos recomendados:

- `Authorization Code`
- `Refresh Token`

## 4) Executar conexao OAuth

Depois do backend publicado:

```bash
# Exemplo em PowerShell
$env:DEPLOY_API_BASE_URL="https://<railway-public-domain>"
npm run mercadolivre:oauth:url
```

Abra a `authorizationUrl` retornada, conclua no Mercado Livre e valide o callback em:

- `/integrations/mercadolivre/oauth/callback`

## 5) Testes de aceite

### Sem efeito colateral (nao responde pergunta real)

```bash
$env:DEPLOY_API_BASE_URL="https://<railway-public-domain>"
npm run deploy:smoke
```

### Completo (inclui resposta real de pergunta)

```bash
$env:DEPLOY_API_BASE_URL="https://<railway-public-domain>"
$env:ENABLE_REPLY_TEST="true"
# opcional: forcar uma pergunta especifica
# $env:MERCADOLIVRE_TEST_QUESTION_ID="<question_id>"
npm run deploy:smoke
```

O script cobre:

1. `GET /` retorna `200`.
2. `GET /integrations/mercadolivre/status` retorna `200` e valida `usingLive=true` (default).
3. `GET /integrations/mercadolivre/questions` retorna `200` e valida `meta.source=mercado-livre-api` (default).
4. `POST /integrations/mercadolivre/questions/:id/reply` quando `ENABLE_REPLY_TEST=true`.

## 6) Frontend

No frontend publicado, configure:

- `VITE_API_BASE_URL=https://<railway-public-domain>`

Com isso, o botao de reconexao do Mercado Livre no Hub de Integracoes usa o backend publicado para abrir OAuth.
