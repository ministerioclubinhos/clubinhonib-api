# Feature Flags - Documentação Completa

Sistema de Feature Flags do Clubinho NIB para habilitar/desabilitar módulos do sistema.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura do Módulo](#estrutura-do-módulo)
3. [Endpoints da API](#endpoints-da-api)
4. [DTOs (Data Transfer Objects)](#dtos-data-transfer-objects)
5. [Entidade do Banco de Dados](#entidade-do-banco-de-dados)
6. [Guards e Decorators](#guards-e-decorators)
7. [Flags Disponíveis](#flags-disponíveis)
8. [Scripts de Automação](#scripts-de-automação)
9. [Exemplos de Uso](#exemplos-de-uso)

---

## Visão Geral

O sistema de Feature Flags permite:
- Habilitar/desabilitar módulos inteiros do sistema
- Controlar funcionalidades por ambiente (development, staging, production)
- Proteger rotas baseado no estado das flags
- Cache automático de 60 segundos para performance

---

## Estrutura do Módulo

```
src/core/feature-flags/
├── decorators/
│   └── feature-flag.decorator.ts    # Decorator @FeatureFlag('key')
├── dto/
│   ├── create-feature-flag.dto.ts   # DTO para criação
│   └── update-feature-flag.dto.ts   # DTO para atualização
├── entities/
│   └── feature-flag.entity.ts       # Entidade TypeORM
├── enums/
│   └── feature-flag-keys.enum.ts    # Enum com todas as chaves
├── guards/
│   └── feature-flag.guard.ts        # Guard para proteger rotas
├── feature-flags.controller.ts      # Controller REST
├── feature-flags.module.ts          # Módulo NestJS
├── feature-flags.repository.ts      # Repository TypeORM
└── feature-flags.service.ts         # Service com lógica de negócio
```

---

## Endpoints da API

### Base URL: `/feature-flags`

---

### 1. Criar Feature Flag

**POST** `/feature-flags`

**Autenticação:** JWT + Admin Role

**Request Body (CreateFeatureFlagDto):**
```json
{
  "key": "children",
  "name": "Crianças",
  "description": "Módulo de gestão de crianças",
  "enabled": true,
  "environment": "production",
  "metadata": {
    "category": "children"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "children",
  "name": "Crianças",
  "description": "Módulo de gestão de crianças",
  "enabled": true,
  "environment": "production",
  "metadata": {
    "category": "children"
  },
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**
- `409 Conflict`: Flag com essa key já existe

---

### 2. Listar Todas as Flags

**GET** `/feature-flags`

**Autenticação:** Nenhuma (público)

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "key": "children",
    "name": "Crianças",
    "description": "Módulo de gestão de crianças",
    "enabled": true,
    "environment": null,
    "metadata": { "category": "children" },
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "key": "pagelas",
    "name": "Pagelas",
    "description": "Módulo de pagelas/figurinhas",
    "enabled": true,
    "environment": null,
    "metadata": { "category": "pagelas" },
    "createdAt": "2025-01-15T10:31:00.000Z",
    "updatedAt": "2025-01-15T10:31:00.000Z"
  }
]
```

---

### 3. Buscar Flag por Key

**GET** `/feature-flags/:key`

**Autenticação:** Nenhuma (público)

**Parâmetros:**
| Parâmetro | Tipo   | Descrição           |
|-----------|--------|---------------------|
| key       | string | Chave única da flag |

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "children",
  "name": "Crianças",
  "description": "Módulo de gestão de crianças",
  "enabled": true,
  "environment": null,
  "metadata": { "category": "children" },
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

**Erros:**
- `404 Not Found`: Flag não encontrada

---

### 4. Verificar se Flag está Habilitada

**GET** `/feature-flags/check/:key`

**Autenticação:** JWT

**Parâmetros:**
| Parâmetro   | Tipo   | Descrição                    |
|-------------|--------|------------------------------|
| key         | string | Chave única da flag          |
| environment | string | Ambiente (query param, opcional) |

**Exemplo:** `/feature-flags/check/children?environment=production`

**Response (200 OK):**
```json
{
  "key": "children",
  "enabled": true,
  "environment": "production"
}
```

---

### 5. Buscar Flags por Ambiente

**GET** `/feature-flags/environment/:environment`

**Autenticação:** JWT

**Parâmetros:**
| Parâmetro   | Tipo   | Descrição                          |
|-------------|--------|------------------------------------|
| environment | string | Ambiente (development, staging, production) |

**Response (200 OK):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "key": "children",
    "name": "Crianças",
    "enabled": true,
    "environment": "production",
    ...
  }
]
```

---

### 6. Atualizar Feature Flag

**PATCH** `/feature-flags/:key`

**Autenticação:** JWT + Admin Role

**Request Body (UpdateFeatureFlagDto):**
```json
{
  "name": "Crianças (Atualizado)",
  "description": "Nova descrição",
  "enabled": false
}
```

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "children",
  "name": "Crianças (Atualizado)",
  "description": "Nova descrição",
  "enabled": false,
  ...
}
```

**Erros:**
- `404 Not Found`: Flag não encontrada

---

### 7. Toggle (Alternar) Feature Flag

**PATCH** `/feature-flags/:key/toggle`

**Autenticação:** JWT + Admin Role

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "key": "children",
  "enabled": false,
  ...
}
```

---

### 8. Excluir Feature Flag

**DELETE** `/feature-flags/:key`

**Autenticação:** JWT + Admin Role

**Response (200 OK):**
```json
{
  "message": "Feature flag \"children\" deleted successfully"
}
```

**Erros:**
- `404 Not Found`: Flag não encontrada

---

## DTOs (Data Transfer Objects)

### CreateFeatureFlagDto

```typescript
{
  key: string;         // Obrigatório, máx 255 chars, único
  name: string;        // Obrigatório, máx 255 chars
  description?: string; // Opcional, texto livre
  enabled?: boolean;   // Opcional, default: false
  environment?: string; // Opcional, máx 50 chars (development, staging, production)
  metadata?: object;   // Opcional, JSON livre
}
```

### UpdateFeatureFlagDto

```typescript
{
  key?: string;         // Opcional
  name?: string;        // Opcional
  description?: string; // Opcional
  enabled?: boolean;    // Opcional
  environment?: string; // Opcional
  metadata?: object;    // Opcional
}
```

---

## Entidade do Banco de Dados

**Tabela:** `feature_flags`

| Coluna      | Tipo         | Descrição                        |
|-------------|--------------|----------------------------------|
| id          | UUID         | Chave primária                   |
| key         | VARCHAR(255) | Chave única da flag              |
| name        | VARCHAR(255) | Nome amigável                    |
| description | TEXT         | Descrição detalhada (nullable)   |
| enabled     | BOOLEAN      | Se está habilitada (default: false) |
| environment | VARCHAR(50)  | Ambiente (nullable = global)     |
| metadata    | JSON         | Dados extras (nullable)          |
| created_at  | TIMESTAMP    | Data de criação                  |
| updated_at  | TIMESTAMP    | Data de última atualização       |

---

## Guards e Decorators

### Decorator `@FeatureFlag`

Marca uma rota para verificar se uma flag está habilitada:

```typescript
import { FeatureFlag } from 'src/core/feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from 'src/core/feature-flags/guards/feature-flag.guard';

@Controller('children')
export class ChildrenController {

  @Get()
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag('children')
  findAll() {
    // Só executa se a flag 'children' estiver habilitada
  }
}
```

### Guard `FeatureFlagGuard`

Verifica automaticamente o estado da flag baseado no decorator:

- Se a flag está **habilitada**: Permite acesso
- Se a flag está **desabilitada**: Retorna `403 Forbidden`

---

## Flags Disponíveis

### Por Categoria

| Categoria       | Key                    | Nome                     |
|-----------------|------------------------|--------------------------|
| **core**        | `auth`                 | Autenticação             |
| **core**        | `users`                | Usuários                 |
| **core**        | `profile`              | Perfil                   |
| **children**    | `children`             | Crianças                 |
| **children**    | `accepted-christs`     | Aceitos em Cristo        |
| **pagelas**     | `pagelas`              | Pagelas                  |
| **clubs**       | `clubs`                | Clubinhos                |
| **clubs**       | `club-control`         | Controle de Clubinhos    |
| **statistics**  | `statistics`           | Estatísticas             |
| **team**        | `teacher-profiles`     | Perfis de Professores    |
| **team**        | `coordinator-profiles` | Perfis de Coordenadores  |
| **content**     | `week-material`        | Material Semanal         |
| **content**     | `video-pages`          | Páginas de Vídeos        |
| **content**     | `image-pages`          | Páginas de Imagens       |
| **content**     | `ideas-pages`          | Páginas de Ideias        |
| **content**     | `image-sections`       | Seções de Imagens        |
| **content**     | `ideas-sections`       | Seções de Ideias         |
| **activities**  | `events`               | Eventos                  |
| **activities**  | `meditations`          | Meditações               |
| **communication** | `informatives`       | Informativos             |
| **communication** | `contacts`           | Contatos                 |
| **communication** | `comments`           | Comentários              |
| **communication** | `feedbacks`          | Feedbacks                |
| **files**       | `documents`            | Documentos               |
| **files**       | `media`                | Mídia                    |
| **navigation**  | `routes`               | Rotas                    |
| **notifications** | `notifications`      | Notificações             |
| **system**      | `system-maintenance`   | Modo Manutenção          |
| **system**      | `system-registration`  | Registro Aberto          |
| **system**      | `system-api-public`    | API Pública              |
| **shelter**     | `shelter-address`      | Shelter Address (legado) |
| **shelter**     | `shelter-management`   | Shelter Management (legado) |
| **shelter**     | `shelter-pagelas`      | Shelter Pagelas (legado) |

---

## Scripts de Automação

### Localização

```
scripts/automations/feature-flags/
├── flags-definition.js  # Definição de todas as flags
├── create.js            # Script de criação
├── list-fix.js          # Script de listagem/sincronização
├── run.js               # Script standalone (CLI)
└── README.md            # Esta documentação
```

### Comandos Disponíveis

```bash
# Ver ajuda
node scripts/automations/feature-flags/run.js help

# Listar todas as flags definidas
node scripts/automations/feature-flags/run.js flags

# Listar categorias
node scripts/automations/feature-flags/run.js categories

# Contar total de flags
node scripts/automations/feature-flags/run.js count

# Criar todas as flags no banco
node scripts/automations/feature-flags/run.js create

# Simular criação (dry-run)
FEATURE_FLAGS_DRY_RUN=1 node scripts/automations/feature-flags/run.js create

# Criar apenas de uma categoria
FEATURE_FLAGS_CATEGORY=children node scripts/automations/feature-flags/run.js create

# Listar flags no banco vs definidas
node scripts/automations/feature-flags/run.js list

# Sincronizar (criar faltantes)
node scripts/automations/feature-flags/run.js sync
# ou
FEATURE_FLAGS_SYNC=1 node scripts/automations/feature-flags/run.js list
```

### Variáveis de Ambiente

| Variável                    | Descrição                              | Default                    |
|-----------------------------|----------------------------------------|----------------------------|
| `API_BASE_URL`              | URL base da API                        | `http://localhost:3000`    |
| `SUPERUSER_EMAIL`           | Email do superusuário                  | `superuser@clubinhonib.com`|
| `SUPERUSER_PASSWORD`        | Senha do superusuário                  | `Abc@123`                  |
| `ENVIRONMENT`               | Ambiente das flags                     | `null` (global)            |
| `FEATURE_FLAGS_CATEGORY`    | Categoria específica para criar        | (todas)                    |
| `FEATURE_FLAGS_DRY_RUN`     | Se `1`, simula sem criar               | `0`                        |
| `FEATURE_FLAGS_SYNC`        | Se `1`, sincroniza flags               | `0`                        |
| `FEATURE_FLAGS_DELETE_ORPHANS` | Se `1`, exclui flags órfãs          | `0`                        |
| `FEATURE_FLAGS_UPDATE_EXISTING` | Se `1`, atualiza flags existentes  | `0`                        |

---

## Exemplos de Uso

### Usando no Código (TypeScript)

```typescript
import { Injectable } from '@nestjs/common';
import { FeatureFlagsService } from 'src/core/feature-flags/feature-flags.service';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';

@Injectable()
export class MyService {
  constructor(private featureFlagsService: FeatureFlagsService) {}

  async doSomething() {
    // Verificar se módulo está habilitado
    const isEnabled = await this.featureFlagsService.isEnabled(
      FeatureFlagKeys.CHILDREN,
      'production' // ambiente opcional
    );

    if (!isEnabled) {
      throw new Error('Módulo de crianças está desabilitado');
    }

    // ... lógica
  }
}
```

### Protegendo uma Rota

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureFlag } from 'src/core/feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from 'src/core/feature-flags/guards/feature-flag.guard';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';

@Controller('children')
@UseGuards(FeatureFlagGuard)
export class ChildrenController {

  @Get()
  @FeatureFlag(FeatureFlagKeys.CHILDREN)
  findAll() {
    // Esta rota só funciona se 'children' estiver habilitada
  }
}
```

### Via cURL

```bash
# Criar flag
curl -X POST http://localhost:3000/feature-flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "children",
    "name": "Crianças",
    "description": "Módulo de gestão de crianças",
    "enabled": true
  }'

# Verificar se está habilitada
curl http://localhost:3000/feature-flags/check/children \
  -H "Authorization: Bearer $TOKEN"

# Toggle (alternar)
curl -X PATCH http://localhost:3000/feature-flags/children/toggle \
  -H "Authorization: Bearer $TOKEN"

# Listar todas
curl http://localhost:3000/feature-flags
```

---

## Cache

O serviço implementa cache em memória com TTL de **60 segundos** para melhorar performance.

- O cache é invalidado automaticamente ao criar, atualizar ou excluir flags
- O método `isEnabled()` usa cache para verificações frequentes
- O cache é por chave: `key` ou `key:environment`

---

## Considerações

1. **Flags globais vs por ambiente**: Se `environment` for `null`, a flag é considerada global
2. **Verificação de ambiente**: Ao verificar com ambiente, flags globais (`environment = null`) também são consideradas
3. **Performance**: Use `isEnabled()` para verificações frequentes (usa cache)
4. **Segurança**: Apenas admins podem criar, atualizar ou excluir flags
