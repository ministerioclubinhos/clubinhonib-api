# API Documentation - Children & Clubs

## 📋 Index

- [Children Controller](#children-controller)
- [Clubs Controller](#clubs-controller)
- [Changes with isActive](#changes-with-isactive)

---

## Children Controller

**Base URL:** `/children`
**Authentication:** Required (JWT)

### Endpoints

#### 1. GET `/children`

Paginated list of children with filters.

**Query Parameters:**

```typescript
{
  searchString?: string;        // Search by name, guardian name or phone
  clubId?: string;              // Club UUID
  clubNumber?: number;          // Club Number
  city?: string;                // City
  state?: string;               // State
  birthDate?: string;           // Birth date (YYYY-MM-DD)
  birthDateFrom?: string;       // Initial birth date (YYYY-MM-DD)
  birthDateTo?: string;         // Final birth date (YYYY-MM-DD)
  joinedAt?: string;            // Join date (YYYY-MM-DD)
  joinedFrom?: string;          // Initial join date (YYYY-MM-DD)
  joinedTo?: string;            // Final join date (YYYY-MM-DD)
  isActive?: boolean;           // Filter by active/inactive status
  orderBy?: ChildSortField;     // 'name' | 'birthDate' | 'joinedAt' | 'createdAt' | 'updatedAt'
  order?: 'ASC' | 'DESC';       // Default: 'ASC'; case-insensitive
  page?: number;                // Default: 1
  limit?: number;               // Default: 20, maximum 100
}
```

`orderBy` and `order` are validated against enums: an unknown value is rejected
with `400` instead of silently falling back to another column. Every date filter
must be a valid ISO date. Ordering breaks ties by `c.id`, so paging never repeats
or skips a row.

**Response:**

```typescript
{
  data: ChildResponseDto[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    orderBy: ChildSortField;    // the ordering actually applied
    order: 'ASC' | 'DESC';
  };
}
```

`meta` reports the ordering the query really used, not the one requested — the
two used to differ silently when an unsupported `orderBy` arrived.

---

#### 2. GET `/children/simple`

Children in the shape the form selects use. Paginated like the main listing —
`page` (default 1) and `limit` (default 20, maximum 100) — and ordered with the
active ones first, then by name. It accepts `searchString`, `isActive` and
`acceptedChrist`, and does not accept a client-chosen ordering; `meta.orderBy`
and `meta.order` report the fixed one.

**Response:**

```typescript
ChildListItemDto[]
```

---

#### 3. GET `/children/:id`

Fetch a child by ID.

**Response:**

```typescript
ChildResponseDto
```

---

#### 4. POST `/children`

Create a new child.

**Request Body:**

```typescript
{
  name: string;                 // 2-255 characters
  birthDate: string;            // YYYY-MM-DD
  guardianName: string;         // 2-255 characters
  gender: Gender;               // 'M' | 'F' — any other value is rejected with 400
  guardianPhone?: string;       // digits only
  joinedAt?: string;            // YYYY-MM-DD (optional)
  isActive?: boolean;           // Active/inactive status (default: true)
  clubId?: string;              // Club UUID (optional)
  address?: {                   // Address (optional)
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    complement?: string;
  };
}
```

The address DTO accepts **only** those fields: global validation rejects
non-whitelisted properties, so sending back `id`, `createdAt` or `updatedAt` from
a previous response fails the whole request with `400`.

**Response:**

```typescript
ChildResponseDto
```

---

#### 5. PUT `/children/:id`

**Who may change the child's club:**

| Role | Move to another club | Unlink (`clubId: null`) |
| --- | --- | --- |
| Admin | Any club | Yes |
| Coordinator | Only clubs under their coordination | No — `403` (`CHILD_7002`) |
| Teacher | No — `403` (`CHILD_7002`) | No — `403` |

The rule applies to a **change**, not to the field being present: the form
resends `clubId` untouched on every edit, so a teacher fixing a phone number
must not trip on it. Unlinking used to have no check at all — moving went
through the scope test, `clubId: null` went straight through. A child with no
club leaves the coordination that was following them and becomes visible to
every role (the role filter hands over `club_id IS NULL` to everyone), so
cutting the link is admin-only.

On `/area-das-criancas` the club field is shown but locked for a teacher — the
API refuses the change anyway, and the helper text points at the coordination.

Update a child.

**Request Body:**

```typescript
{
  name?: string;                // 2-255 characters
  birthDate?: string;           // YYYY-MM-DD
  guardianName?: string;        // 2-255 characters
  gender?: string;              // 1-255 characters
  guardianPhone?: string;       // 5-32 characters
  joinedAt?: string;            // YYYY-MM-DD
  isActive?: boolean;           // ⭐ NEW: Active/inactive status
  clubId?: string | null;       // Club UUID or null
  address?: {                   // Address (optional)
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

Remove a child. **Admin only** — `403` (`CHILD_7002`) for anyone else.

Deleting is the only child operation closed to coordinators and teachers, and
the reason is that it is the only irreversible one: the row is gone and with it
the pagela history. `PATCH /children/:id/toggle-active` covers the real need —
"this child does not come any more" — keeping the record and undoable, and stays
open to every role.

The route had no role guard at all: whoever could see a child could delete one.
Since the role filter also hands over every child **with no club**
(`c.club_id IS NULL`), a teacher could delete any child not yet assigned.

**Response:**

```typescript
{
  ok: true;
}
```

---

#### 7. PATCH `/children/:id/toggle-active` ⭐ NEW

Activate or deactivate a child. All roles can use this endpoint.

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
  gender: Gender;               // 'M' | 'F'
  guardianPhone: string;
  joinedAt: string | null;      // YYYY-MM-DD
  isActive: boolean;
  club: {
    id: string;
    number: number;
    weekday: string;
  } | null;
  address: {
    id: string;
    street: string;
    number: string | null;
    district: string;
    city: string;
    state: string;
    postalCode: string;
    complement: string | null;
  } | null;                     // no createdAt/updatedAt: the address is a
                                // detail of the child, not its own resource
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
  isActive: boolean;            // ⭐ NEW
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
**Authentication:** Required (JWT)

### Endpoints

#### 1. GET `/clubs`

Paginated list of clubs with filters.

**Query Parameters:**

```typescript
{
  page?: number;                // Default: 1
  limit?: number;               // Default: 10
  searchString?: string;        // Club number, district or city
  isActive?: boolean;           // Filter by active/inactive status
  sort?: 'number' | 'weekday' | 'time' | 'createdAt' | 'updatedAt' | 'city' | 'state';  // Default: 'number'
  order?: 'ASC' | 'DESC';       // Case-insensitive on input; default: 'ASC'
}
```

**Response:**

```typescript
{
  data: ClubResponseDto[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;  // Automatically calculated: Math.ceil(total / limit)
}
```

---

#### 2. GET `/clubs/all`

Simple list of all clubs (no pagination).

**Response:**

```typescript
ClubSimpleResponseDto[]
```

---

#### 3. GET `/clubs/simple-options`

List of clubs for selection (simple options).

**Response:**

```typescript
ClubSelectOptionDto[]
```

---

#### 4. GET `/clubs/:id`

Fetch a club by ID.

**Response:**

```typescript
ClubResponseDto
```

---

#### 5. POST `/clubs`

Create a new club. A number already in use answers `409` with
`CLUB_NUMBER_IN_USE` — on `PATCH` as well as here.

**Request Body:**

```typescript
{
  number: number;               // Minimum: 1
  weekday: Weekday;             // 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
  time?: string;                // Format: H:mm or HH:mm (0:00-23:59)
  isActive?: boolean;           // ⭐ NEW: Active/inactive status (default: true)
  address?: {                   // Optional; every field is optional
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    complement?: string;
  };
  coordinatorProfileId?: string;      // UUID (optional)
  teacherProfileIds?: string[];       // UUID array (optional)
}
```

**Response:**

```typescript
ClubResponseDto
```

---

#### 6. PATCH `/clubs/:id`

Update a club.

**Request Body:**

```typescript
{
  number?: number;              // Minimum: 1
  weekday?: Weekday;
  time?: string | null;         // Format: H:mm or HH:mm (0:00-23:59)
  isActive?: boolean;           // ⭐ NEW: Active/inactive status
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

Remove a club. Teachers are detached, the coordinator link is cleared, the
weekly meeting leaves the calendar, and the address row is deleted with the
club. Children keep their record with `clubId` set to `NULL`.

**Response:**

```typescript
{
  message: string;              // "Clubinho removido com sucesso"
}
```

---

### What a coordinator decides alone

A coordinator manages the clubs under their coordination without going through
an admin:

| Operation | Allowed for a coordinator |
| --- | --- |
| Change the club's **weekday** and **time** | Yes, on their own clubs |
| Add or remove **any** teacher, wherever that teacher is today | Yes, on their own clubs |
| Change the club's address, number, active flag | Yes, on their own clubs |
| **Deactivate** the club | Yes — it leaves the calendar and the history stays |
| **Delete** the club | **No — admin only** |
| Act on a club of another coordination | No — `404`, the club is hidden |
| Move the club to another coordination | No — `403` |
| Create, edit or delete an academic period or a calendar exception | No — admin only |

Deleting is the only club operation closed to coordinators, and the reason is
that it is the only irreversible one: the row is gone and the children are
unlinked from it. Deactivating covers the same need with a way back, so the
coordinator keeps it. `DELETE /clubs/:id` answers `403` with the message
pointing at that alternative, and the club card hides the button for anyone who
is not an admin (`clubLinkPermissionsOf().canDeleteClub`).

Changing the weekday rebuilds the club's meeting series in the calendar from
today: the whole series moves day, so keeping the old start date would claim
meetings that never happened. See `SyncClubEventService`.

---

#### 8. PATCH `/clubs/:id/toggle-active`

Activate or deactivate a club. Only admin and coordinator can use this endpoint.

Deactivating a club removes **all** of its club days from the calendar — an
inactive club has none. Activating it creates them again, valid from the day of
the reactivation. Creating, updating and deleting a club keep those days in sync
the same way — see `SyncClubEventService`. None of it sends e-mail.

The week-by-week record of what happened lives in `club_control_logs`, not in
the calendar: the calendar shows what is valid now.

Which days the meeting actually falls on comes from the academic period and the
calendar exceptions, computed at read time — with no active period for the year,
the club has no meeting days at all. See "Encontro semanal do clubinho" in
[`api-content-management.md`](api-content-management.md).

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
  time: string | null;          // Format: H:mm (first 5 chars)
  isActive: boolean;            // ⭐ NEW
  address: {                    // null when the club has no address
    id: string;
    street: string | null;
    number: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    complement: string | null;
  } | null;
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
    } | null;
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
    } | null;
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
  time: string | null;          // Format: H:mm
  isActive: boolean;            // ⭐ NEW
  address: {                    // null when the club has no address
    id: string;
    street: string | null;
    number: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    complement: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
```

#### ClubSelectOptionDto

```typescript
{
  id: string;
  label: string;                // Format: "Clubinho {number} : {district}"
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
  isActive: boolean;            // ⭐ NEW
}
```

---

## Changes with isActive

### ⭐ `isActive` Field Added

#### Children

1. **CreateChildDto**
   - Field `isActive?: boolean` (optional)
   - Default: `true` if not informed

2. **UpdateChildDto**
   - Field `isActive?: boolean` (optional)

3. **ChildResponseDto**
   - Field `isActive: boolean` (required)

4. **ChildListItemDto**
   - Field `isActive: boolean` (required)

5. **QueryChildrenDto**
   - Parameter `isActive?: boolean` (optional)
   - **Important:** Not a default filter. Only filters when explicitly provided in query.

6. **New Endpoint:**
   - `PATCH /children/:id/toggle-active`
   - Toggles active/inactive status
   - **Permissions:** All roles can use

---

#### Clubs

1. **CreateClubDto**
   - Field `isActive?: boolean` (optional)
   - Default: `true` if not informed

2. **UpdateClubDto**
   - Field `isActive?: boolean` (optional)

3. **ClubResponseDto**
   - Field `isActive: boolean` (required)

4. **ClubSimpleResponseDto**
   - Field `isActive: boolean` (required)

5. **ClubMiniDto**
   - Field `isActive: boolean` (required)

6. **QueryClubsDto**
   - Parameter `isActive?: boolean` (optional)
   - **Important:** Not a default filter. Only filters when explicitly provided in query.

7. **New Endpoint:**
   - `PATCH /clubs/:id/toggle-active`
   - Toggles active/inactive status
   - **Permissions:** Only admin and coordinator can use

---

### 📝 Important Notes

1. **`isActive` Filter:**
   - By default, DOES **NOT** filter by `isActive`
   - Returns both active and inactive children/clubs
   - To filter, use explicitly:
     - `GET /children?isActive=true` - Only active
     - `GET /children?isActive=false` - Only inactive
     - `GET /clubs?isActive=true` - Only active
     - `GET /clubs?isActive=false` - Only inactive

2. **Permissions:**
   - **Children toggle-active:** All roles (admin, coordinator, teacher)
   - **Children delete:** Admin only
   - **Clubs toggle-active:** Only admin and coordinator
   - **Clubs delete:** Admin only

   Deleting is admin-only on both, for the same reason: it is the only
   irreversible operation, and deactivating covers the same need with a way
   back.

3. **Default Values:**
   - When creating a child/club without specifying `isActive`, default is `true` (active)

4. **Date Format:**
   - All dates must be in `YYYY-MM-DD` format
   - Example: `"2024-01-15"`

5. **Time Format:**
   - Times must be in `H:mm` or `HH:mm` format
   - Example: `"14:30"` or `"9:00"`

---

## Usage Examples

### Create active child

```json
POST /children
{
  "name": "John Doe",
  "birthDate": "2015-05-20",
  "guardianName": "Mary Doe",
  "gender": "M",
  "guardianPhone": "1234567890",
  "isActive": true
}
```

### Create inactive child

```json
POST /children
{
  "name": "John Doe",
  "birthDate": "2015-05-20",
  "guardianName": "Mary Doe",
  "gender": "M",
  "guardianPhone": "1234567890",
  "isActive": false
}
```

### Filter only active children

```
GET /children?isActive=true
```

### Activate/Deactivate child

```
PATCH /children/{id}/toggle-active
```

### Create active club

```json
POST /clubs
{
  "number": 1,
  "weekday": "MONDAY",
  "time": "14:30",
  "isActive": true,
  "address": {
    "street": "Example St",
    "district": "Downtown",
    "city": "Sao Paulo",
    "state": "SP",
    "postalCode": "01234567"
  }
}
```

### Filter only active clubs

```
GET /clubs?isActive=true
```

### Activate/Deactivate club

```
PATCH /clubs/{id}/toggle-active
```

---

## Enum Weekday

```typescript
enum Weekday {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
}
```

There is no Sunday: no Clubinho meets on Sunday, and the column is a database
enum. The frontend list in `src/features/clubs/constants.ts` mirrors these six
values exactly.

```typescript
```

---
⬅️ [Back to Documentation Hub](README.md)

---

## Decisões (`/accepted-christs`)

### `DELETE /accepted-christs/:id`

Desfaz um registro lançado por engano. Mesmos papéis e mesmo recorte do
registro: decisão de criança fora do alcance responde `404` `CHILD_7004`. A
aceitação só sai depois das reconciliações da criança (`409` `CHILD_7005`),
para não sobrar "reconciliada sem nunca ter aceitado". Resposta:
`{ "message": "Decisão excluída com sucesso" }`.

### `POST /accepted-christs`

Registra que uma criança aceitou ou se reconciliou com Jesus.

- **Acesso**: exige sessão. Administrador, coordenador e professor registram;
  qualquer outro papel recebe `403` `ACCESS_DENIED`.
- **Recorte**: a criança é buscada pelo `GetChildrenService`, que já aplica o
  filtro de papel — o professor só alcança a turma dele, o coordenador os
  clubinhos que coordena. Criança fora do alcance responde `404`
  `CHILD_NOT_FOUND` com a mesma mensagem de "não existe": a resposta não conta
  em qual clubinho ela está.
- **Regras de decisão** (2026-11-11), recusadas com `409`:
  - aceitar é uma vez só: criança que já tem `ACCEPTED` ou `RECONCILED` não
    recebe outro `ACCEPTED` (`CHILD_7005`);
  - reconciliar exige ter aceitado; pode se repetir (`CHILD_7005`);
  - criança desativada não recebe decisão (`CHILD_7003`);
  - registro antigo sem tipo (`decision = null`) não conta como aceitação.
- **Corpo** (`CreateAcceptedChristDto`):

  ```jsonc
  {
    "childId": "uuid-da-crianca",   // obrigatório
    "decision": "ACCEPTED",         // 'ACCEPTED' | 'RECONCILED'; obrigatório
    "notes": "texto até 500 chars"  // opcional; vazio equivale a ausente
  }
  ```

- **Resposta** `201` (`AcceptedChristResponseDto`):

  ```json
  {
    "id": "uuid-da-decisao",
    "decision": "ACCEPTED",
    "childId": "uuid-da-crianca",
    "notes": null,
    "createdAt": "2026-03-10T12:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z"
  }
  ```

  A criança sai apenas pelo id. A rota devolvia a entidade do TypeORM, e com
  ela a relação `child` inteira — responsável, telefone e endereço em cada
  decisão gravada.

> **Histórico**: até setembro de 2026 esta rota não tinha guard nenhum, e ainda
> imprimia o corpo da requisição no log da aplicação. `src/app.module.spec.ts`
> agora falha se um controller nascer sem `@UseGuards` fora da lista de
> públicos deliberados.

## Crianças — ajustes de 2026-11-11

- **Busca por telefone**: `searchString` compara o telefone só pelos dígitos
  (`phoneSearchDigits`). Antes `(92) 99999` não encontrava ninguém, porque o
  telefone é gravado sem máscara. Sem dígito algum, a busca é só por nome.
- **Cadastro sem clubinho**: só o administrador cria criança sem `clubId`;
  professor e coordenador recebem `403 CHILD_7002`. Uma criança sem clubinho
  aparece para todos os papéis.
- **Recorte por papel**: contexto sem papel ou sem usuário não devolve criança
  alguma (antes devolvia todas).
- **Criança desativada**: não recebe pagela nem decisão (`409 CHILD_7003`).
- **Autoria**: `ChildResponseDto` traz `createdBy` e `updatedBy`
  (`{ id, name } | null`): quem cadastrou e quem alterou por último — edição,
  ativar ou desativar. As decisões trazem `createdBy`, tanto em
  `AcceptedChristResponseDto` quanto no recorte curto de `/children/simple`.
  O autor vem do token da sessão, nunca do corpo.
