# Documentação da API - Children e Clubs

## 📋 Índice
- [Children Controller](#children-controller)
- [Clubs Controller](#clubs-controller)
- [Mudanças com isActive](#mudanças-com-isactive)

---

## Children Controller

**Base URL:** `/children`  
**Autenticação:** Requerida (JWT)

### Endpoints

#### 1. GET `/children`
Lista paginada de crianças com filtros.

**Query Parameters:**
```typescript
{
  searchString?: string;        // Busca por nome, nome do responsável ou telefone
  clubId?: string;              // UUID do clubinho
  clubNumber?: number;          // Número do clubinho
  city?: string;                // Cidade
  state?: string;               // Estado
  birthDate?: string;           // Data de nascimento (YYYY-MM-DD)
  birthDateFrom?: string;       // Data de nascimento inicial (YYYY-MM-DD)
  birthDateTo?: string;         // Data de nascimento final (YYYY-MM-DD)
  joinedAt?: string;            // Data de entrada (YYYY-MM-DD)
  joinedFrom?: string;          // Data de entrada inicial (YYYY-MM-DD)
  joinedTo?: string;            // Data de entrada final (YYYY-MM-DD)
  isActive?: boolean;           // ⭐ NOVO: Filtrar por status ativo/inativo
  orderBy?: 'name' | 'birthDate' | 'joinedAt' | 'createdAt';
  order?: 'ASC' | 'DESC';
  page?: number;                // Padrão: 1
  limit?: number;               // Padrão: 20
}
```

**Response:**
```typescript
{
  data: ChildResponseDto[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    orderBy?: string;
    order?: 'ASC' | 'DESC';
  };
}
```

---

#### 2. GET `/children/simple`
Lista simples de crianças (sem paginação).

**Response:**
```typescript
ChildListItemDto[]
```

---

#### 3. GET `/children/:id`
Busca uma criança por ID.

**Response:**
```typescript
ChildResponseDto
```

---

#### 4. POST `/children`
Cria uma nova criança.

**Request Body:**
```typescript
{
  name: string;                 // 2-255 caracteres
  birthDate: string;            // YYYY-MM-DD
  guardianName: string;         // 2-255 caracteres
  gender: string;               // 2-255 caracteres
  guardianPhone: string;        // 5-32 caracteres
  joinedAt?: string;            // YYYY-MM-DD (opcional)
  isActive?: boolean;           // ⭐ NOVO: Status ativo/inativo (padrão: true)
  clubId?: string;              // UUID do clubinho (opcional)
  address?: {                   // Endereço (opcional)
    street: string;
    number?: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    complement?: string;
  };
}
```

**Response:**
```typescript
ChildResponseDto
```

---

#### 5. PUT `/children/:id`
Atualiza uma criança.

**Request Body:**
```typescript
{
  name?: string;                // 2-255 caracteres
  birthDate?: string;           // YYYY-MM-DD
  guardianName?: string;        // 2-255 caracteres
  gender?: string;              // 2-255 caracteres
  guardianPhone?: string;       // 5-32 caracteres
  joinedAt?: string;            // YYYY-MM-DD
  isActive?: boolean;           // ⭐ NOVO: Status ativo/inativo
  clubId?: string | null;       // UUID do clubinho ou null
  address?: {                   // Endereço (opcional)
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    complement?: string;
  } | null;
}
```

**Response:**
```typescript
ChildResponseDto
```

---

#### 6. DELETE `/children/:id`
Remove uma criança.

**Response:**
```typescript
{
  ok: true;
}
```

---

#### 7. PATCH `/children/:id/toggle-active` ⭐ NOVO
Ativa ou desativa uma criança. Todas as roles podem usar este endpoint.

**Response:**
```typescript
ChildResponseDto
```

---

### DTOs - Children

#### ChildResponseDto
```typescript
{
  id: string;
  name: string;
  birthDate: string;            // YYYY-MM-DD
  guardianName: string;
  gender: string;
  guardianPhone: string;
  joinedAt?: string | null;     // YYYY-MM-DD
  isActive: boolean;            // ⭐ NOVO
  club?: {
    id: string;
    number: number;
    weekday: string;
  } | null;
  address?: {
    id: string;
    street: string;
    number?: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    complement?: string;
  } | null;
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}
```

#### ChildListItemDto
```typescript
{
  id: string;
  name: string;
  guardianName: string;
  gender: string;
  guardianPhone: string;
  isActive: boolean;            // ⭐ NOVO
  clubId?: string | null;
  acceptedChrists?: {
    id: string;
    decision: string;
    createdAt: string;
    updatedAt: string;
  }[];
}
```

---

## Clubs Controller

**Base URL:** `/clubs`  
**Autenticação:** Requerida (JWT)

### Endpoints

#### 1. GET `/clubs`
Lista paginada de clubinhos com filtros.

**Query Parameters:**
```typescript
{
  page?: number;                // Padrão: 1
  limit?: number;               // Padrão: 10
  addressSearchString?: string; // Busca no endereço
  userSearchString?: string;    // Busca em coordenadores/professores
  clubSearchString?: string;    // Busca por número, horário ou dia da semana
  isActive?: boolean;           // ⭐ NOVO: Filtrar por status ativo/inativo
  sort?: 'number' | 'weekday' | 'time' | 'createdAt' | 'updatedAt' | 'city' | 'state';
  order?: 'ASC' | 'DESC' | 'asc' | 'desc';
}
```

**Response:**
```typescript
{
  data: ClubResponseDto[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;  // Calculado automaticamente: Math.ceil(total / limit)
}
```

---

#### 2. GET `/clubs/all`
Lista simples de todos os clubinhos (sem paginação).

**Response:**
```typescript
ClubSimpleResponseDto[]
```

---

#### 3. GET `/clubs/simple-options`
Lista de clubinhos para seleção (opções simples).

**Response:**
```typescript
ClubSelectOptionDto[]
```

---

#### 4. GET `/clubs/:id`
Busca um clubinho por ID.

**Response:**
```typescript
ClubResponseDto
```

---

#### 5. POST `/clubs`
Cria um novo clubinho.

**Request Body:**
```typescript
{
  number: number;               // Mínimo: 1
  weekday: Weekday;             // 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
  time?: string;                // Formato: H:mm ou HH:mm (0:00-23:59)
  isActive?: boolean;           // ⭐ NOVO: Status ativo/inativo (padrão: true)
  address: {                    // Obrigatório
    street: string;
    number?: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    complement?: string;
  };
  coordinatorProfileId?: string;      // UUID (opcional)
  teacherProfileIds?: string[];       // Array de UUIDs (opcional)
}
```

**Response:**
```typescript
ClubResponseDto
```

---

#### 6. PATCH `/clubs/:id`
Atualiza um clubinho.

**Request Body:**
```typescript
{
  number?: number;              // Mínimo: 1
  weekday?: Weekday;
  time?: string | null;         // Formato: H:mm ou HH:mm (0:00-23:59)
  isActive?: boolean;           // ⭐ NOVO: Status ativo/inativo
  coordinatorProfileId?: string | null;
  address?: {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    complement?: string;
  };
  teacherProfileIds?: string[];
}
```

**Response:**
```typescript
ClubResponseDto
```

---

#### 7. DELETE `/clubs/:id`
Remove um clubinho.

**Response:**
```typescript
{
  message: string;              // "Clubinho removido com sucesso"
}
```

---

#### 8. PATCH `/clubs/:id/toggle-active` ⭐ NOVO
Ativa ou desativa um clubinho. Apenas admin e coordinator podem usar este endpoint.

**Response:**
```typescript
ClubResponseDto
```

---

### DTOs - Clubs

#### ClubResponseDto
```typescript
{
  id: string;
  number: number;
  time: string | null;          // Formato: H:mm (primeiros 5 caracteres)
  isActive: boolean;            // ⭐ NOVO
  address: {
    id: string;
    street: string;
    number?: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    complement?: string;
  };
  coordinator: {
    id: string;
    active: boolean;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string;
      active: boolean;
      completed: boolean;
      commonUser: boolean;
    };
  } | null;
  teachers: {
    id: string;
    active: boolean;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string;
      active: boolean;
      completed: boolean;
      commonUser: boolean;
    };
  }[];
  weekday: Weekday;
  createdAt: Date;
  updatedAt: Date;
}
```

#### ClubSimpleResponseDto
```typescript
{
  id: string;
  number: number;
  weekday: Weekday;
  time: string | null;          // Formato: H:mm
  isActive: boolean;            // ⭐ NOVO
  address: {
    id: string;
    street: string;
    number?: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    complement?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### ClubSelectOptionDto
```typescript
{
  id: string;
  detalhe: string;              // Formato: "Clubinho {number} : {bairro}"
  coordinator: boolean;
}
```

#### ClubMiniDto
```typescript
{
  id: string;
  number: number;
  weekday: Weekday;
  time: string | null;
  isActive: boolean;            // ⭐ NOVO
}
```

---

## Mudanças com isActive

### ⭐ Campo `isActive` Adicionado

#### Children (Crianças)

1. **CreateChildDto**
   - Campo `isActive?: boolean` (opcional)
   - Padrão: `true` se não informado

2. **UpdateChildDto**
   - Campo `isActive?: boolean` (opcional)

3. **ChildResponseDto**
   - Campo `isActive: boolean` (obrigatório)

4. **ChildListItemDto**
   - Campo `isActive: boolean` (obrigatório)

5. **QueryChildrenDto**
   - Parâmetro `isActive?: boolean` (opcional)
   - **Importante:** Não é filtro padrão. Só filtra quando explicitamente fornecido na query.

6. **Novo Endpoint:**
   - `PATCH /children/:id/toggle-active`
   - Alterna o status ativo/inativo
   - **Permissões:** Todas as roles podem usar

---

#### Clubs (Clubinhos)

1. **CreateClubDto**
   - Campo `isActive?: boolean` (opcional)
   - Padrão: `true` se não informado

2. **UpdateClubDto**
   - Campo `isActive?: boolean` (opcional)

3. **ClubResponseDto**
   - Campo `isActive: boolean` (obrigatório)

4. **ClubSimpleResponseDto**
   - Campo `isActive: boolean` (obrigatório)

5. **ClubMiniDto**
   - Campo `isActive: boolean` (obrigatório)

6. **QueryClubsDto**
   - Parâmetro `isActive?: boolean` (opcional)
   - **Importante:** Não é filtro padrão. Só filtra quando explicitamente fornecido na query.

7. **Novo Endpoint:**
   - `PATCH /clubs/:id/toggle-active`
   - Alterna o status ativo/inativo
   - **Permissões:** Apenas admin e coordinator podem usar

---

### 📝 Notas Importantes

1. **Filtro `isActive`:**
   - Por padrão, **NÃO** filtra por `isActive`
   - Retorna tanto crianças/clubinhos ativos quanto inativos
   - Para filtrar, use explicitamente:
     - `GET /children?isActive=true` - Apenas ativos
     - `GET /children?isActive=false` - Apenas inativos
     - `GET /clubs?isActive=true` - Apenas ativos
     - `GET /clubs?isActive=false` - Apenas inativos

2. **Permissões:**
   - **Children toggle-active:** Todas as roles (admin, coordinator, teacher)
   - **Clubs toggle-active:** Apenas admin e coordinator

3. **Valores Padrão:**
   - Ao criar uma criança/clubinho sem especificar `isActive`, o valor padrão é `true` (ativo)

4. **Formato de Data:**
   - Todas as datas devem estar no formato `YYYY-MM-DD`
   - Exemplo: `"2024-01-15"`

5. **Formato de Hora:**
   - Horários devem estar no formato `H:mm` ou `HH:mm`
   - Exemplo: `"14:30"` ou `"9:00"`

---

## Exemplos de Uso

### Criar criança ativa
```json
POST /children
{
  "name": "João Silva",
  "birthDate": "2015-05-20",
  "guardianName": "Maria Silva",
  "gender": "M",
  "guardianPhone": "1234567890",
  "isActive": true
}
```

### Criar criança inativa
```json
POST /children
{
  "name": "João Silva",
  "birthDate": "2015-05-20",
  "guardianName": "Maria Silva",
  "gender": "M",
  "guardianPhone": "1234567890",
  "isActive": false
}
```

### Filtrar apenas crianças ativas
```
GET /children?isActive=true
```

### Ativar/Desativar criança
```
PATCH /children/{id}/toggle-active
```

### Criar clubinho ativo
```json
POST /clubs
{
  "number": 1,
  "weekday": "MONDAY",
  "time": "14:30",
  "isActive": true,
  "address": {
    "street": "Rua Exemplo",
    "district": "Centro",
    "city": "São Paulo",
    "state": "SP",
    "postalCode": "01234567"
  }
}
```

### Filtrar apenas clubinhos ativos
```
GET /clubs?isActive=true
```

### Ativar/Desativar clubinho
```
PATCH /clubs/{id}/toggle-active
```

---

## Enum Weekday

```typescript
enum Weekday {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY'
}
```

