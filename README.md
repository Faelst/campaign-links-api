# Campaign Links API

API REST em **NestJS + Express + TypeScript** para gerenciamento dinâmico de links de campanha.

O sistema permite criar usuários, autenticar com JWT, organizar links por projetos, cadastrar parâmetros reutilizáveis e gerar uma URL final considerando base URL, parâmetros e redirect.

## Tecnologias

- Node.js
- TypeScript
- NestJS com Express
- Prisma ORM
- SQLite como banco relacional local
- JWT para autenticação
- class-validator e class-transformer para validação de DTOs
- Cache em memória com `@nestjs/cache-manager`
- Jest + Supertest para testes unitários e e2e

## Como rodar

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run seed
npm run start:dev
```

A API ficará disponível em:

```bash
http://localhost:3000/api
```

Usuários criados no seed:

```txt
José
email: jose@example.com
senha: 123456
```

## Como rodar os testes

Unitários:

```bash
npm run test
```

Integração e2e:

```bash
npm run test:e2e
```

O teste e2e usa um banco SQLite separado: `e2e.db`.

## Principais endpoints

### Autenticação

```http
POST /api/auth/register
POST /api/auth/login
```

Exemplo de login:

```json
{
  "email": "jose@example.com",
  "password": "123456"
}
```

A resposta retorna um `accessToken`. Use esse token no header:

```http
Authorization: Bearer TOKEN_AQUI
```

### Projetos

```http
POST /api/projects
GET /api/projects?page=1&limit=10&search=black
GET /api/projects/:id
PATCH /api/projects/:id
DELETE /api/projects/:id
```

### Parâmetros reutilizáveis

```http
POST /api/parameters
GET /api/parameters?page=1&limit=10&search=utm&key=utm_source
GET /api/parameters/:id
PATCH /api/parameters/:id
DELETE /api/parameters/:id
```

### Links

```http
POST /api/projects/:projectId/links
GET /api/links?page=1&limit=10&search=landing&projectId=PROJECT_ID&hasRedirect=true
GET /api/links/:id
PATCH /api/links/:id
DELETE /api/links/:id
GET /api/links/:id/generate
```

Exemplo de criação de link:

```json
{
  "name": "Landing principal",
  "baseUrl": "https://example.com",
  "parameters": [
    {
      "key": "utm_source",
      "value": "FB"
    },
    {
      "key": "utm_medium",
      "value": "paid_social"
    }
  ],
  "redirect": {
    "targetUrl": "https://checkout.example.com/oferta",
    "paramKey": "redirect",
    "statusCode": 302
  }
}
```

Exemplo de retorno do endpoint de geração:

```json
{
  "url": "https://example.com/?utm_source=FB&utm_medium=paid_social&redirect=https%3A%2F%2Fcheckout.example.com%2Foferta",
  "cached": false,
  "linkId": "clx...",
  "generatedAt": "2026-05-05T12:00:00.000Z"
}
```

## Paginação e filtros

A paginação segue o padrão:

```http
?page=1&limit=10
```

Filtros disponíveis:

- Projetos: `search`
- Parâmetros: `search`, `key`
- Links: `search`, `projectId`, `hasRedirect`

A resposta paginada retorna:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

## Cache

O endpoint `GET /api/links/:id/generate` usa cache em memória.

A chave do cache considera:

- `userId`
- `linkId`
- `updatedAt` do link

Isso evita que um usuário receba resultado de outro usuário e também invalida naturalmente o cache quando o link é atualizado.

## Logs

A aplicação possui um interceptor global que registra método, rota, IP e tempo de resposta.

Também existem logs específicos em criação, atualização, remoção e geração de links.

## Seed do banco

O seed cria dois usuários, projetos, parâmetros e um link de exemplo.

```bash
npm run seed
```

## Parte conceitual

### 1. Como as entidades foram modeladas?

A modelagem principal ficou assim:

- `User`: representa o dono dos dados.
- `Project`: pertence a um usuário e agrupa links.
- `Link`: pertence a um projeto e representa um template reutilizável de URL.
- `Parameter`: pertence a um usuário e representa um parâmetro reutilizável, como `utm_source=FB`.
- `LinkParameter`: tabela intermediária entre links e parâmetros, permitindo que um mesmo parâmetro seja reutilizado em vários links.
- `RedirectConfig`: configuração opcional de redirect para um link.

Exemplo prático: José pode ter um projeto chamado `Black Friday`, com um link `Landing principal`. Esse link pode reutilizar parâmetros como `utm_source=FB` e `utm_campaign=black_friday`. David pode ter seus próprios projetos e links, sem acessar os dados de José.

### 2. Quais decisões foram tomadas e por quê?

A primeira decisão foi isolar todos os dados por usuário. Projetos pertencem a usuários, links pertencem a projetos e parâmetros também pertencem a usuários. Assim, a API consegue garantir que cada pessoa acesse apenas os próprios dados.

A segunda decisão foi separar `Parameter` de `Link`. Isso permite reaproveitar parâmetros entre vários links, evitando duplicação e facilitando manutenção.

A terceira decisão foi criar `RedirectConfig` como uma entidade separada. Como nem todo link precisa de redirect, essa configuração fica opcional e desacoplada do link principal.

Também foi escolhido SQLite para facilitar a execução local do teste técnico, mas a estrutura com Prisma pode ser migrada para PostgreSQL ou MySQL com baixa alteração.

### 3. Como a solução resolve o problema de escala na edição de links?

A solução resolve o problema porque os links deixam de ser URLs editadas manualmente e passam a ser compostos por partes gerenciáveis:

- base URL
- parâmetros reutilizáveis
- redirect opcional

Quando um parâmetro é alterado, todos os links que usam esse parâmetro passam a gerar a URL final atualizada. Isso evita editar link por link manualmente.

Por exemplo: se José usa `utm_source=FB` em vários links e precisa mudar o valor para `facebook_ads`, basta atualizar o parâmetro uma vez. Na próxima geração, os links já saem com o novo valor.

## Estrutura de pastas

```txt
src
├── common
│   ├── decorators
│   ├── dto
│   ├── filters
│   ├── interceptors
│   └── prisma
├── modules
│   ├── auth
│   ├── users
│   ├── projects
│   ├── parameters
│   └── links
prisma
├── schema.prisma
└── seed.ts
test
└── app.e2e-spec.ts
```

## Validações implementadas

- E-mail válido no cadastro e login.
- Senha com no mínimo 6 caracteres.
- Nome de projeto e link com tamanho mínimo e máximo.
- URL válida para `baseUrl` e `targetUrl`.
- Limite de paginação entre 1 e 100 itens.
- Rejeição de campos não esperados via `forbidNonWhitelisted`.

## Observações para produção

Para produção, seria recomendado trocar SQLite por PostgreSQL, configurar cache distribuído com Redis, adicionar refresh token, rate limit, Swagger, monitoramento centralizado e pipeline de CI/CD rodando os testes unitários e e2e.
