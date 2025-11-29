# Scripts de População e Testes

Scripts em JavaScript puro para popular a API e executar testes E2E.

## Pré-requisitos

1. API rodando em `localhost:3000`
2. Usuário `superuser@clubinhonib.com` com senha `Abc@123` deve existir
3. Node.js instalado (v14+)

## Scripts Disponíveis

### 1. População em Massa

Popula a API com dados de teste:
- Cria professores para clubes que não têm
- Cria 10 crianças por clube
- Cria 48 pagelas por criança (semanas 1-48 do ano letivo 2025)

```bash
npm run populate
# ou
node scripts/populate-mass.js
```

### 2. Testes E2E

Executa testes contra a API real:

```bash
npm run test:api
# ou
node scripts/test-api-real.js
```

## O que os scripts fazem

### populate-mass.js

1. Faz login com o superuser
2. Busca ou cria o período letivo de 2025
3. Busca todos os clubes
4. Para cada clube:
   - Verifica se tem professores
   - Se não tiver, cria um usuário professor e vincula ao clube
   - Cria 10 crianças
   - Para cada criança, cria 48 pagelas (semanas 1-48)

### test-api-real.js

1. Verifica se a API está rodando
2. Faz login
3. Testa os seguintes controllers:
   - AcceptedChristController
   - ChildrenController
   - ClubsController
   - UserController
   - PagelasController

## Notas

- Os scripts são independentes e podem ser executados separadamente
- Os dados criados são reais e ficam no banco de dados
- Use com cuidado em ambientes de produção

