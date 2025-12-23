# Documentação dos Endpoints do Dashboard

Esta documentação descreve os 3 endpoints principais utilizados no dashboard de gerenciamento de clubinhos, crianças e pagelas.

---

## 📋 Índice

1. [GET /clubs - Listar Clubinhos](#1-get-clubs---listar-clubinhos)
2. [GET /children - Listar Crianças](#2-get-children---listar-crianças)
3. [GET /pagelas/paginated - Listar Pagelas](#3-get-pagelaspaginated---listar-pagelas)

---

## 1. GET /clubs - Listar Clubinhos

**Endpoint:** `GET /clubs`

**Descrição:** Retorna uma lista paginada de clubinhos com busca por endereço (bairro, cidade) e número do clubinho.

**Autenticação:** Requerida (JWT Token)

**Permissões:** Admin ou Coordinator (Teachers não têm acesso)

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `page` | number | Não | `1` | Número da página (mínimo: 1) |
| `limit` | number | Não | `10` | Itens por página (mínimo: 1) |
| `searchString` | string | Não | - | Busca por:<br>- **Número do clube** (se for número inteiro, ex: "82")<br>- **Bairro** (district)<br>- **Cidade** (city) |
| `sort` | string | Não | `number` | Campo para ordenação:<br>- `number` (padrão)<br>- `weekday`<br>- `time`<br>- `createdAt`<br>- `updatedAt`<br>- `city`<br>- `state` |
| `order` | string | Não | `ASC` | Ordem de classificação: `ASC` ou `DESC` |

### Exemplo de Requisição

```http
GET /clubs?page=1&limit=12&sort=updatedAt&order=DESC
```

**Busca por número do clube:**
```http
GET /clubs?searchString=82
```

**Busca por bairro:**
```http
GET /clubs?searchString=JORGE TEIXEIRA
```

**Busca por cidade:**
```http
GET /clubs?searchString=Manaus
```

### Resposta de Sucesso (200 OK)

```json
{
  "data": [
    {
      "id": "170a4ca7-3e4f-45de-b2c7-ee9911cd5c32",
      "number": 82,
      "time": "15:30",
      "isActive": true,
      "weekday": "saturday",
      "address": {
        "id": "fef67a54-5e94-41d8-8738-603b443140ff",
        "street": "R: MALVARISCO",
        "number": "157",
        "district": "JORGE TEIXEIRA",
        "city": "MANAUS",
        "state": "AM",
        "postalCode": "",
        "complement": "NIB BRILHO CELESTE, JOÃO PAULO"
      },
      "coordinator": {
        "id": "748f8a3f-8a2b-45f8-a7c0-893af4a38630",
        "active": true,
        "user": {
          "id": "a27880cf-0c57-4ce6-a7bd-48eec5509c05",
          "name": "Carlos Ramos",
          "email": "coordinator.1764451403563@teste.clubinhonib.com",
          "phone": "41369766470",
          "active": true,
          "completed": true,
          "commonUser": false
        }
      },
      "teachers": [...],
      "createdAt": "2025-09-16T17:19:49.492Z",
      "updatedAt": "2025-11-29T21:23:24.000Z"
    }
  ],
  "total": 127,
  "page": 1,
  "limit": 12,
  "pageCount": 11
}
```

### Campos da Resposta

- **data**: Array de clubinhos
- **total**: Total de clubinhos encontrados (após aplicar filtros)
- **page**: Página atual
- **limit**: Itens por página
- **pageCount**: Total de páginas

### Comportamento da Busca

- **Se `searchString` for um número inteiro:** Busca pelo número do clube **OU** no bairro/cidade
- **Se `searchString` for texto:** Busca apenas em bairro e cidade

---

## 2. GET /children - Listar Crianças

**Endpoint:** `GET /children`

**Descrição:** Retorna uma lista paginada de crianças com busca por nome da criança, nome do responsável e número do responsável (telefone). Quando `clubNumber` é usado, retorna apenas crianças ativas por padrão.

**Autenticação:** Requerida (JWT Token)

**Permissões:** Admin, Coordinator ou Teacher (com filtro de acesso baseado em role)

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `page` | number | Não | `1` | Número da página (mínimo: 1) |
| `limit` | number | Não | `20` | Itens por página (mínimo: 1) |
| `searchString` | string | Não | - | Busca por:<br>- Nome da criança<br>- Nome do responsável<br>- Número do responsável (telefone) |
| `clubNumber` | number | Não | - | Filtrar por número do clube<br>**IMPORTANTE:** Quando usado, retorna apenas crianças ativas por padrão |
| `orderBy` | string | Não | `name` | Campo para ordenação:<br>- `name` (padrão)<br>- `birthDate`<br>- `joinedAt`<br>- `createdAt` |
| `order` | string | Não | `ASC` | Ordem de classificação: `ASC` ou `DESC` |

### Exemplo de Requisição

```http
GET /children?page=1&limit=12&orderBy=updatedAt&order=DESC&clubNumber=82
```

**Busca por nome da criança:**
```http
GET /children?searchString=Thiago
```

**Busca por nome do responsável:**
```http
GET /children?searchString=Rafael
```

**Busca por telefone:**
```http
GET /children?searchString=11987654321
```

### Resposta de Sucesso (200 OK)

```json
{
  "data": [
    {
      "id": "bb1580e8-437c-477a-a89f-a2993bba144e",
      "name": "Thiago Fernandes",
      "birthDate": "2012-07-19",
      "guardianName": "Rafael Teixeira",
      "gender": "Masculino",
      "guardianPhone": "11987654321",
      "joinedAt": "2024-01-20",
      "isActive": true,
      "club": {
        "id": "170a4ca7-3e4f-45de-b2c7-ee9911cd5c32",
        "number": 82,
        "weekday": "saturday"
      },
      "address": {...},
      "createdAt": "2024-01-20T10:00:00.000Z",
      "updatedAt": "2024-11-29T21:23:24.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 12,
    "totalItems": 40,
    "totalPages": 4,
    "orderBy": "updatedAt",
    "order": "DESC"
  }
}
```

### Campos da Resposta

- **data**: Array de crianças
- **meta.page**: Página atual
- **meta.limit**: Itens por página
- **meta.totalItems**: Total de crianças encontradas (após aplicar filtros)
- **meta.totalPages**: Total de páginas
- **meta.orderBy**: Campo usado para ordenação
- **meta.order**: Ordem de classificação

### Comportamento Especial

**Quando `clubNumber` é usado:**
- Se `isActive` não for informado, retorna apenas crianças ativas
- Se `isActive` for explicitamente informado, usa o valor informado

---

## 3. GET /pagelas/paginated - Listar Pagelas

**Endpoint:** `GET /pagelas/paginated`

**Descrição:** Retorna uma lista paginada de pagelas (registros de presença e atividades) com busca por semana e ano.

**Autenticação:** Requerida (JWT Token)

**Permissões:** Admin, Coordinator ou Teacher (com filtro de acesso baseado em role)

### Query Parameters

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `page` | number | Não | `1` | Número da página (mínimo: 1) |
| `limit` | number | Não | `20` | Itens por página (mínimo: 1, máximo: 200) |
| `childId` | UUID | Não | - | Filtrar por ID da criança |
| `searchString` | string | Não | - | Busca por semana e ano:<br>- **Ano** (ex: "2025") - número entre 2000-9999<br>- **Semana** (ex: "48") - número entre 1-53<br>- **Ano-Semana** (ex: "2025-48") - formato "ano-semana" |
| `year` | number | Não | - | Filtrar por ano letivo (mínimo: 2000, máximo: 9999) |
| `week` | number | Não | - | Filtrar por semana do ano letivo (mínimo: 1, máximo: 53) |

### Exemplo de Requisição

**Listar pagelas de uma criança:**
```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&page=1&limit=12
```

**Buscar por ano:**
```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&searchString=2025&page=1&limit=12
```

**Buscar por semana:**
```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&searchString=48&page=1&limit=12
```

**Buscar por ano e semana (formato "ano-semana"):**
```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&searchString=2025-48&page=1&limit=12
```

**Usar filtros diretos de year e week:**
```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&year=2025&week=48&page=1&limit=12
```

### Resposta de Sucesso (200 OK)

```json
{
  "items": [
    {
      "id": "abc123...",
      "createdAt": "2025-11-28T10:00:00.000Z",
      "updatedAt": "2025-11-28T10:00:00.000Z",
      "childId": "bf0b0946-adc6-45b9-8c8e-37deec9e6191",
      "teacherProfileId": "def456...",
      "referenceDate": "2025-11-28",
      "year": 2025,
      "week": 48,
      "present": true,
      "didMeditation": true,
      "recitedVerse": true,
      "notes": "Semana 48 - Presente"
    }
  ],
  "total": 48,
  "page": 1,
  "limit": 12,
  "totalPages": 4
}
```

### Campos da Resposta

- **items**: Array de pagelas
- **total**: Total de pagelas encontradas (após aplicar filtros)
- **page**: Página atual
- **limit**: Itens por página
- **totalPages**: Total de páginas

### Ordenação Padrão

As pagelas são ordenadas por:
1. **Ano** (DESC) - Mais recente primeiro
2. **Semana** (DESC) - Semana mais recente primeiro
3. **Nome da criança** (ASC) - Ordem alfabética

### Comportamento da Busca (searchString)

O `searchString` aceita os seguintes formatos:

1. **Apenas ano:** `"2025"` → Busca por ano = 2025
2. **Apenas semana:** `"48"` → Busca por semana = 48 (se o número estiver entre 1-53)
3. **Ano e semana:** `"2025-48"` → Busca por ano = 2025 **E** semana = 48

**Regras:**
- Números entre 2000-9999 são interpretados como **ano**
- Números entre 1-53 são interpretados como **semana**
- Formato `"ano-semana"` (ex: "2025-48") busca por ambos

### Observações Importantes

- **Semana e Ano:** A semana e o ano são do **ano letivo**, não do ano calendário
- **childId:** Geralmente é necessário informar `childId` para listar pagelas de uma criança específica
- **Filtros combinados:** `searchString`, `year` e `week` podem ser usados juntos

---

## 🔐 Autenticação

Todos os endpoints requerem autenticação via JWT Token. O token deve ser enviado no header:

```http
Authorization: Bearer <seu-token-jwt>
```

## 📝 Notas de Implementação Frontend

### 1. Paginação

Todos os endpoints retornam informações de paginação:
- **Clubs:** `page`, `limit`, `total`, `pageCount`
- **Children:** `meta.page`, `meta.limit`, `meta.totalItems`, `meta.totalPages`
- **Pagelas:** `page`, `limit`, `total`, `totalPages`

Use esses campos para implementar controles de paginação.

### 2. Busca em Tempo Real

Para melhor UX, implemente **debounce** na busca (`searchString`) para evitar muitas requisições enquanto o usuário digita.

**Recomendação:** Aguardar 300-500ms após o usuário parar de digitar antes de fazer a requisição.

### 3. Placeholders dos Inputs

- **Clubs:** "Endereço / nº do clubinho.." → Busca em bairro, cidade e número do clube
- **Children:** "Buscar por nome, responsável, telefone..." → Busca em nome da criança, nome do responsável e telefone
- **Pagelas:** "Semana e ano" → Busca em semana e ano (aceita "2025", "48" ou "2025-48")

### 4. Tratamento de Erros

- **401 Unauthorized:** Token inválido ou expirado
- **403 Forbidden:** Usuário não tem permissão para acessar o recurso
- **400 Bad Request:** Parâmetros inválidos
- **404 Not Found:** Recurso não encontrado

### 5. Loading States

Implemente estados de loading durante as requisições, especialmente para:
- Busca com `searchString`
- Mudança de página
- Aplicação de filtros

### 6. Cache

Considere implementar cache para:
- Lista de clubinhos (muda pouco)
- Dados de crianças (atualizar após criar/editar)
- Pagelas (atualizar após criar/editar)

---

## 📚 Exemplos de Uso Completo

### Fluxo Completo: Selecionar Clube → Ver Crianças → Ver Pagelas

**1. Listar clubinhos:**
```http
GET /clubs?page=1&limit=12&sort=updatedAt&order=DESC
```

**2. Buscar clube por número:**
```http
GET /clubs?searchString=82&page=1&limit=12
```

**3. Selecionar clube #82 e listar crianças:**
```http
GET /children?page=1&limit=12&orderBy=updatedAt&order=DESC&clubNumber=82
```

**4. Buscar criança por nome:**
```http
GET /children?clubNumber=82&searchString=Thiago&page=1&limit=12
```

**5. Selecionar criança e listar pagelas:**
```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&page=1&limit=12
```

**6. Filtrar pagelas por semana e ano:**
```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&searchString=2025-48&page=1&limit=12
```

---

## 🆘 Suporte

Para dúvidas ou problemas, consulte a documentação completa da API ou entre em contato com a equipe de desenvolvimento.
