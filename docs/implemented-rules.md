# 📋 Compilation of Implemented Rules

## Notification center (bell)

`/notifications/me` is a facade over existing notice sources, gated by
`notification_center_v2` (seeded for admins). The recipient always comes from
the session; foreign/missing notices return 404. Lists are lean (no comment
text or reason), filters run in SQL before pagination, and `unreadCount` is
independent of filters. Bulk read updates only a locked snapshot of unread ids
in one transaction. A disabled source flag omits the source. Sound and browser
notification flags (`notification_sound`, `browser_notifications`) start off.
See [notifications.md](notifications.md).

## Feed photo comments

Active users can submit comments on individual feed photos and videos. Every new comment
is pending until an active admin approves it; only approved rows are public.
Authors see their own statuses and private rejection reasons. Retries are
idempotent, submissions are rate-limited, and moderation uses conditional version
checks. See [the full rules and API contract](feed-photo-comments.md).

Rejection requires a reason and atomically stores an owner-only notification
snapshot. Concurrent/repeated decisions cannot duplicate notices. The author sees
the reason in their comments and mobile/desktop bell; acknowledgment persists
across sessions. Email alone uses `email_feed_photo_comment_rejected`, through
shared dispatch, and cannot suppress the in-app notice if disabled or failing.

> **Date**: Today
> **Affected Modules**: Club Control and Statistics
> **Version**: 1.8.2 (Control) | 2.8.0 (Statistics)

---

## 🎯 Index

1. [Children Rules (isActive and joinedAt)](#1-children-rules-isactive-and-joinedat)
2. [Academic Period Rules](#2-academic-period-rules)
3. [Academic Week vs ISO Week Rules](#3-academic-week-vs-iso-week-rules)
4. [Indicators and Status Rules](#4-indicators-and-status-rules)
5. [Pagela (Report Card) Rules](#5-pagela-report-card-rules)
6. [Data Return Rules](#6-data-return-rules)
7. [Sorting Rules](#7-sorting-rules)
8. [Pagination Rules](#8-pagination-rules)

---

## 1. Children Rules (isActive and joinedAt)

### 1.0. `deactivatedAt` and history (2026-11-11)

**Rule**: deactivating a child must not erase her past. `children.deactivatedAt`
(date, nullable) is stamped with today's date (America/Sao_Paulo) when the child
is deactivated and cleared when she is reactivated. Historical statistics count
a child in a period when she had already joined and had not yet been
deactivated at that date; legacy inactive children without the stamp use the
day of `updatedAt`. Section 1.1's "never appear" now applies to **current**
totals only.

- ✅ Inactive children do not receive pagelas or decisions (`409 CHILD_7003`)
- ⚠️ The column exists locally through `DB_SYNCHRONIZE=true`; the versioned
  migration still has to be generated (`migration:generate`) from a database
  that does not have the column yet.

### 1.0.1. Authorship of records (2026-11-11)

**Rule**: the database records who wrote each record, taken from the session
token — never from the request body.

| Table | Columns | Filled when |
|---|---|---|
| `pagelas` | `created_by_user_id`, `updated_by_user_id` | created / edited |
| `accepted_christs` | `created_by_user_id` | decision registered |
| `children` | `created_by_user_id`, `updated_by_user_id` | created / edited, activated or deactivated |

All are nullable FKs to `users` with `ON DELETE SET NULL`: records older than
the columns have no author, and deleting a user does not delete what she wrote.
Responses expose `createdBy` / `updatedBy` as `{ id, name } | null`
(`RecordAuthorDto`, `src/shared/record-author`); only id and name are selected.

- ⚠️ Like `deactivatedAt`, these columns exist locally through
  `DB_SYNCHRONIZE=true`; the versioned migration still has to be generated.

### 1.1. `isActive` Field in Child Entity

**Rule**: All children must have an `isActive` field (boolean) indicating if the child is still active in the club.

**Implementation**:

- ✅ Field added to `ChildEntity`
- ✅ Default value: `true` (existing children are considered active)
- ✅ Mandatory field in the database

**Impact**:

- Inactive children (`isActive = false`) **NEVER** appear in:
  - Statistics
  - Rankings
  - Club control
  - Attendance analysis
  - Metric calculations

### 1.2. `joinedAt` Field in Child Entity

**Rule**: All children must have a `joinedAt` field (date) indicating when the child joined the club.

**Implementation**:

- ✅ Field added to `ChildEntity`
- ✅ Optional field (can be `NULL`)
- ✅ If `NULL`, considered active since the beginning

**Impact**:

- If a child joined in the middle of the academic year:
  - ✅ Weeks **after** joining → Counted
  - ❌ Weeks **before** joining → **NOT** counted
  - ❌ Does not generate negative indicators for previous weeks
  - ❌ Does not appear in statistics for previous weeks

**Example**:

```
Child joined on 06/15/2024 (week 20 of the academic year)
- Week 1-19: ❌ NOT counted (was not in the club)
- Week 20+: ✅ Counted (was already in the club)
```

---

## 2. Academic Period Rules

### 2.1. Global Academic Period

**Rule**: There is a single GLOBAL academic period applicable to ALL clubs.

**Structure**:

- `year`: Academic Year (e.g., 2024)
- `startDate`: Start Date (e.g., "2024-03-01")
- `endDate`: End Date (e.g., "2024-11-30")
- `isActive`: If the period is active

### 2.2. Empty Return When No Period Exists

**Rule**: If there is no registered academic period, endpoints return empty arrays.

**Applied in**:

- ✅ `/club-control/check/week` → `clubs: []`
- ✅ `/club-control/dashboard` → `clubs: []`
- ✅ `/statistics/attendance/week` → `clubs: []`
- ✅ `/statistics/attendance/club/:id` → `missingWeeks: []`

**Response when no period exists**:

```json
{
  "year": 2025,
  "week": 39,
  "clubs": [], // ⭐ EMPTY ARRAY
  "summary": {
    "totalClubs": 0,
    "clubsOk": 0,
    "clubsMissing": 0,
    // ...
  },
  "note": "Academic period not registered - no clubs returned"
}
```

### 2.3. Empty Return When Week Is Outside Period

**Rule**: If the queried week is outside the academic period, returns empty arrays.

**Applied in**:

- ✅ `/club-control/check/week?year=2025&week=50` (if period ends at week 39)
- ✅ `/statistics/attendance/week?year=2025&week=50`

**Response when week is outside**:

```json
{
  "year": 2025,
  "week": 50,
  "clubs": [], // ⭐ EMPTY ARRAY
  "summary": {
    "totalClubs": 0,
    // ...
  },
  "period": {
    "year": 2025,
    "startDate": "2025-03-01",
    "endDate": "2025-11-30"
  },
  "note": "Week outside academic period (03/01/2025 to 11/30/2025) - no clubs returned"
}
```

### 2.4. Indicators Only Within Period

**Rule**: Indicators (positive or negative) are only generated if:

1. There is a registered academic period
2. The week is within the academic period

**Implementation**:

- ✅ If no period → `indicators: []` (empty)
- ✅ If week outside → `indicators: []` (empty)
- ✅ If inside → Indicators generated normally

---

## 3. Academic Week vs ISO Week Rules

### 3.1. Two Different Week Rulers

**IMPORTANT**: There are **TWO** different week "rulers":

#### 📅 ISO Week (Calendar Year)

- Based on the Gregorian calendar
- Week 1 starts on the first Monday of the year
- Year can have 52 or 53 weeks
- Example: 01/05/2024 can be week 1 of 2024

#### 🎓 Academic Week

- Based on the **registered academic period**
- The first week within the academic period is **"week 1"** of the academic year
- Counting starts when the academic period begins
- Example: Academic period 2024 starts on 02/05/2024 → this is week 1 of academic year 2024

### 3.2. Rule for All Queries

**Rule**: **ALL parameters** `year` and `week` in endpoints are for **ACADEMIC YEAR**, not ISO week.

**Applied in**:

- ✅ `/club-control/check/week?year=2025&week=39` → week 39 of academic year
- ✅ `/statistics/attendance/week?year=2025&week=39` → week 39 of academic year
- ✅ `/statistics/attendance/club/:id?year=2025` → academic year 2025

### 3.3. Pagelas Stored with Academic Week

**Rule**: **ALL pagelas** are explicitly stored with **ACADEMIC WEEK**, not ISO week.

**Pagela Fields**:

- `year`: Academic Period Year (e.g., 2024)
- `week`: Academic Week (1-N, where N = total weeks of period)

**Example**:

```
Academic Period 2024:
- Start: 02/05/2024
- End: 12/15/2024

Dates and their weeks:
| Date       | ISO Week   | Academic Week | Academic Year |
|------------|------------|---------------|---------------|
| 02/05/2024 | Week 6     | Week 1 ✅     | 2024          |
| 02/12/2024 | Week 6     | Week 1 ✅     | 2024          |
| 02/19/2024 | Week 7     | Week 2 ✅     | 2024          |
| 12/15/2024 | Week 50    | Week 44 ✅    | 2024          |
```

### 3.4. Academic Period Week Limit

**Rule**: If an academic year has N weeks, **ONLY** weeks 1 to N are counted.

**Implementation**:

1. **Pagelas from week N+1+ are NOT counted**
   - If period has 30 weeks, pagelas with `week > 30` are **IGNORED**
   - Do not appear in statistics
   - Do not appear in control
   - Considered "outside academic period"

2. **Missing weeks within period ARE detected**
   - If period has 30 weeks and no pagela for week 1 to 30
   - Counts as missing week (`missingWeeks`)
   - Appears in control as "missing" (`status: 'missing'`)
   - Generates negative alert

**Example**:

```
Academic Period 2024:
- Start: 02/05/2024
- End: 12/15/2024
- Total: 30 weeks (week 1 to week 30)

Scenario 1: Pagela for week 31
- Pagela created with week = 31
- ✅ NOT counted in statistics
- ✅ NOT counted in control
- System returns clubs: [] if querying week 31

Scenario 2: Week 1 to 30 without pagela
- Period has 30 weeks
- Club has no pagela from week 1 to week 30
- ✅ YES appears in statistics as missing week (missingWeeks)
- ✅ YES enters control as "missing" (status: 'missing')
- ✅ Generates negative alert (missing_weeks)
```

---

## 4. Indicators and Status Rules

### 4.1. Club Statuses

**Possible Statuses**:

- `ok`: All children have pagela
- `partial`: Some children have pagela
- `missing`: No children have pagela
- `exception`: Global exception registered for the date
- `inactive`: Club inactive
- `out_of_period`: Week is outside academic period
- `pending`: ⭐ **NEW** - Pagelas not submitted, but club day hasn't passed yet

### 4.2. `pending` Status (NEW)

**Rule**: `pending` status represents a club where:

- Pagelas have not been submitted yet
- The club day of the current week has not passed yet
- Is not considered "late" or "missing"

**Application**:

- ✅ **ONLY** for the **CURRENT** academic week
- ✅ **ONLY** if the club day has **NOT** passed yet
- ✅ For past weeks, always uses `ok`, `partial` or `missing`

**Example**:

```
Today: Friday, 11/21/2025
Club: Saturday (clubNumber: 47)
Week: 39 (current week)

Status: pending (club day is Saturday, hasn't passed)
Indicators: [] (empty, no negative alerts)

If today were Sunday (11/22/2025):
Status: missing (club day passed and no pagelas)
Indicators: [no_pagela] (shows negative alert)
```

### 4.3. Negative Indicators Only After Club Day

**Rule**: Negative indicators are only returned if:

1. The queried week is the **CURRENT** academic week
2. **AND** the club day of the current week **HAS PASSED**

**Implementation**:

- ✅ If club is on Saturday and today is Friday → **NO** negative indicators
- ✅ If club is on Saturday and today is Sunday → **YES** negative indicators
- ✅ For past weeks → Always shows indicators (if applicable)

**Example**:

```
Club: Saturday (clubNumber: 47)
Week: 39 (current week)
Today: Friday, 11/21/2025

Result:
- status: "pending"
- indicators: [] (empty)
- No negative alerts

If today were Sunday, 11/23/2025:
- status: "missing"
- indicators: [{ type: "no_pagela", severity: "critical", ... }]
- Shows negative alerts
```

### 4.4. Indicators Only Within Period

**Rule**: Indicators (positive or negative) are only generated if:

1. There is a registered academic period
2. The week is within the academic period

**Implementation**:

- ✅ If no period → `indicators: []` (empty)
- ✅ If week outside → `indicators: []` (empty)
- ✅ If inside → Indicators generated normally

---

## 5. Pagela Rules

### 5.1. Pagelas with Academic Week

**Rule**: All pagelas are stored with **ACADEMIC YEAR** week, not ISO week.

**Fields**:

- `year`: Academic Period Year
- `week`: Academic Week (1-N)

### 5.1.1. Pagelas Only Inside the Academic Period (2026-11-11)

**Rule**: A pagela is only created or edited while **today** (America/Sao_Paulo) is inside an active academic period.

**Implementation** (`PagelaLaunchWindowService`):

- ✅ Outside the period (not registered, not started, ended): `400 VAL_4007`
- ✅ Only weeks that already happened: `1 ≤ week ≤ current academic week`
- ✅ `referenceDate` cannot be in the future nor outside the period
- ✅ `GET /pagelas/launch-window` tells the app whether launching is open
- ✅ Deleting a pagela is still allowed outside the period
- ⚠️ Weekday exceptions do not block a pagela

### 5.2. Pagela Filtering by Period

**Rule**: Pagelas outside the academic period are ignored.

**Implementation**:

- ✅ If period has 30 weeks, pagelas with `week > 30` are ignored
- ✅ Pagelas from another academic year are ignored
- ✅ Only pagelas within the period are counted

### 5.3. Pagelas Only for Active Children

**Rule**: Only pagelas for **ACTIVE** children (`isActive = true`) are counted.

**Implementation**:

- ✅ All queries filter `child.isActive = true`
- ✅ Inactive children do not appear in statistics
- ✅ Inactive children do not generate indicators

### 5.4. Pagelas Respecting Join Date

**Rule**: Pagelas are only expected for children who had already joined the club.

**Implementation**:

- ✅ If child joined in week 20, weeks 1-19 are not expected
- ✅ Only weeks after `joinedAt` are counted
- ✅ Does not generate negative indicators for previous weeks

---

## 6. Data Return Rules

### 6.1. Empty `clubs` Array

**Rule**: The `clubs` array returns empty (`[]`) when:

1. There is no registered academic period
2. The week is outside the academic period

**Applied in**:

- ✅ `/club-control/check/week`
- ✅ `/club-control/dashboard`
- ✅ `/statistics/attendance/week`

### 6.2. Empty `missingWeeks` Array

**Rule**: The `missingWeeks` array returns empty (`[]`) when:

1. There is no registered academic period
2. There are no missing weeks within the period

**Applied in**:

- ✅ `/statistics/attendance/club/:id`

### 6.3. Empty `indicators` Array

**Rule**: The `indicators` array returns empty (`[]`) when:

1. There is no registered academic period
2. The week is outside the academic period
3. Status is `pending` (day hasn't passed)
4. Status is `ok` and there are no positive indicators to show

---

## 7. Sorting Rules

### 7.1. Club Sorting in Control

**Rule**: Clubs with negative indicators appear **FIRST** in the list.

**Priority Order**:

1. `missing` (most critical)
2. `partial` (critical)
3. `exception` (informative)
4. `inactive` (informative)
5. `out_of_period` (informative)
6. `pending` (pending, but within deadline)
7. `ok` (OK, appears last)

**Implementation**:

- ✅ Clubs sorted by `statusPriority`
- ✅ Clubs with issues appear first
- ✅ Facilitates identification of clubs needing attention

---

## 8. Pagination Rules

### 8.1. Standard Pagination

**Rule**: All listing endpoints apply pagination.

**Default Values**:

- `page`: 1 (if not provided)
- `limit`: 50 (if not provided)

**Applied in**:

- ✅ `/club-control/check/week?page=1&limit=50`
- ✅ `/club-control/dashboard?page=1&limit=20`
- ✅ `/statistics/attendance/week?page=1&limit=50`

### 8.2. `pagination` Object Always Present

**Rule**: The `pagination` object is always present in the response, even when `clubs: []`.

**Structure**:

```json
{
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

## 9. Automatic Calculation Rules

### 9.1. Automatic Current Week Calculation

**Rule**: If `year` and `week` are not provided, the system automatically calculates the current academic week.

**Applied in**:

- ✅ `/club-control/check/week` (no parameters)
- ✅ `/club-control/dashboard` (no parameters)

**Behavior**:

- If no academic period → Returns `clubs: []` and `note`
- If outside period → Returns `clubs: []` and `note`
- If inside → Returns data for the current week

---

## 10. Week Rules (Monday to Saturday)

### 10.1. Week Definition

**Rule**: The week starts on **Monday** and ends on **Saturday**. **Sunday does not count**.

**Implementation**:

- ✅ Week calculated based on Monday to Saturday
- ✅ Sunday is not considered part of the week
- ✅ Academic week calculated correctly

---

## 📊 Summary of Critical Rules

### ✅ Implemented Rules

1. ✅ Inactive children (`isActive = false`) do not appear in statistics
2. ✅ Join date (`joinedAt`) is respected - previous weeks are not counted
3. ✅ Academic period is mandatory - returns empty arrays if no period
4. ✅ Week outside period returns empty arrays
5. ✅ Pagelas with `week > maxAcademicWeek` are ignored
6. ✅ Academic weeks are used (not ISO)
7. ✅ Negative indicators only appear after club day (current week)
8. ✅ `pending` status for current week before day passes
9. ✅ Sorting: clubs with issues appear first
10. ✅ Pagination always applied with default values

### ⚠️ Implementation Considerations

1. **Always use academic year week** in `year` and `week` parameters
2. **Check if there is an academic period** before displaying data on frontend
3. **`pending` status** only appears for current week before the day passes
4. **Empty arrays** indicate no data or period not configured

---

## 🔄 Compatibility

### Affected Endpoints

**Control Module**:

- `GET /club-control/check/week`
- `GET /club-control/dashboard`
- `GET /club-control/indicators/detailed`

**Statistics Module**:

- `GET /statistics/attendance/week`
- `GET /statistics/attendance/club/:id`
- `GET /statistics/children`
- `GET /statistics/clubs`
- `GET /statistics/teachers`

### Breaking Changes

⚠️ **ATTENTION**: Some behaviors have changed:

- Arrays may return empty where they previously returned data
- `pending` status was added
- Club sorting changed
- Weeks are now academic, not ISO

---

## 📝 Final Notes

- All rules have been implemented and tested
- Documentation updated in each module's MD
- Debug logs removed from production code
- Code compiling without errors

---

**Last Update**: Today
**Document Version**: 1.0

---
⬅️ [Back to Documentation Hub](README.md)

## Estúdio Clubinho — regras vigentes

Referência completa: [api-ai-lessons.md](api-ai-lessons.md). Regras anteriores
(visuais por trecho literal em lições regulares, mínimos de palavras e artes
opcionais do item 7, reconciliação manual de publicação) foram substituídas e
estão resumidas na seção "Histórico" daquele documento.

### Pacotes e acesso

- Todas as rotas exigem JWT e papel de administrador; a API é a autoridade.
- Material Semanal (`REGULAR`): oito itens. Material Especial (`SPECIAL`): três
  itens (lição, visuais da história, visuais do versículo), semana opcional.
- Cada etapa tem versões imutáveis. Na produção inicial, gerar ou salvar uma
  etapa marca as posteriores já iniciadas como `STALE`; salvar conteúdo
  idêntico não cria versão nem invalida nada.
- Em um ciclo de revisão (alguma etapa em revisão, aprovada ou devolvida),
  corrigir um item não invalida nenhum outro.
- Item aprovado é blindado: não é salvo, regenerado nem invalidado; só o
  revisor o reabre. Item em revisão só é regenerado depois de devolvido.

### Fluxo e concorrência

- O status da lição é derivado das etapas por uma única função; `PUBLISHING`,
  `PUBLISHED` e `ARCHIVED` são transições explícitas.
- Enquanto há publicação ou geração em andamento, salvar, concluir, aprovar,
  devolver, reabrir e excluir são recusados.
- Concluir, aprovar, devolver e reabrir exigem o `lockVersion` exibido ao
  usuário; a versão é lida sob o lock da lição.
- Concluir exige a etapa anterior concluída e o conteúdo pronto. Item `STALE`
  ou `FAILED` produzido a partir de versões anteriores dos itens precedentes
  só é concluído com confirmação explícita (`acknowledgeStale`).
- Aprovar valida a prontidão e gera o PDF do item antes de aprovar; se o PDF
  não sai, a aprovação é recusada com o nome do item (422 ou 503). Devolver
  não valida, para que um item quebrado possa ser devolvido. A nota de devolução/reabertura é obrigatória e vira
  observação, que pode ser marcada como resolvida.
- Pacote pronto para publicação pode ter um item aprovado reaberto.
- Lição publicada pode ser arquivada e restaurada; lição publicada ou
  arquivada não pode ser excluída.
- Tema, semana e referência não são editáveis após a criação.

### Geração

- O pedido é persistido antes da resposta; a IA roda em segundo plano.
- Provedor, modelos, parâmetros e prompt do administrador são congelados no
  servidor no momento do pedido; o cliente não pode informá-los.
- A lease de cada tentativa usa um UUID próprio e o relógio do banco. Lease
  perdida aborta a tentativa; o desligamento libera as leases.
- Cada pedido tem no máximo 3 tentativas. Texto e imagens já produzidos são
  reaproveitados na retomada enquanto os itens anteriores não mudaram.
- Falha de geração preserva a versão anterior e restaura o status anterior da
  etapa; sem versão anterior, a etapa vai a `FAILED`. Uma tentativa sem posse nunca grava versão.
- Imagens do provedor são validadas (PNG/JPEG, até 15 MiB) antes do upload.
- Brincadeira e fixação têm no máximo 8 passos, um visual por passo.
- Lições regulares geram kit de recortes nos visuais da história; lições
  especiais geram cartazes de cena por trecho literal da narrativa.
- A meditação dos maiores (8 a 12 anos) segue o modelo das folhas impressas:
  relatos entre parênteses abaixo do tema, de 2 a 4 questões (a IA escolhe pela
  soma do tamanho dos exercícios, para preencher a página A4 inteira), cada uma
  com contexto da história e comando no mesmo parágrafo, de 1 a 6 subitens,
  imagem só nas questões com `visualRequired` (no máximo uma por questão) e
  revisão separada de texto e de artes. A questão 1 recorda a história e ao
  menos uma questão é de compreensão ou aplicação.
- O trabalho manual gera uma única arte para colorir.
- As regras editoriais do prompt orientam a IA e exigem autorrevisão; não
  substituem a revisão humana.

### Provedores e prompts

- Configurações vêm exclusivamente de `ai_provider_settings`; nada é lido do
  ambiente e não há fallback entre provedores.
- Chaves de API nunca são devolvidas; são criptografadas quando a chave mestra
  está configurada, e em produção uma chave nova não é salva sem ela.
- Ativar um provedor sem chave é recusado. Qualidade, esforço e tamanho de
  imagem são valores enumerados; retries do Gemini vão de 0 a 5.
- O prompt personalizado é complemento do prompt-base, por administrador,
  categoria e etapa, com escrita condicional por versão.
- Toda chamada a provedor passa pela fila de IA.

### Conteúdo editado e exportação

- O AST editado é a fonte da prévia e da exportação. Na reconciliação, a base é
  o dado estruturado do servidor; o JSON enviado pelo cliente não é persistido.
- Visuais da história, visuais do versículo e trabalho manual são
  integralmente autoritativos do servidor.
- Remover o título de uma seção da lição esvazia o campo correspondente.
- A edição não adiciona, remove nem troca URLs de artes.
- Formatação manual (fontes, tamanhos, cores, links, espaçamento, tabelas) é
  convertida para DOCX antes do PDF.
- Conteúdo que não cabe na folha (meditações, trabalho manual) é rejeitado com
  422 em vez de ser cortado.
- Imagens são lidas do bucket pelo SDK; o download HTTP de contingência bloqueia
  destinos internos, redirecionamentos e arquivos acima de 15 MiB.

### Publicação e arquivos

- A publicação reserva a lição com lease, renderiza um PDF por etapa aprovada
  antes de criar o material e vincula a página criada.
- `sourceLessonId` é único no material semanal; publicar duas vezes devolve o
  mesmo vínculo. Publicações interrompidas são reconciliadas a cada 5 s.
- Material apagado em Materiais Semanais: publicar de novo recria o material.
  Lição arquivada não é publicada.
- Falha antes de criar o material devolve a lição a `READY_FOR_PUBLICATION`;
  falha de PDF informa o item que falhou.
- Depois que a página existe, a lição é sempre marcada como publicada.
- O Material Especial é um material semanal com título e descrição próprios
  (marca `[tipo:especial]` na descrição); não existe coluna de tipo. A
  descrição não leva marcador de origem.
- O material semanal publicado pelo Estúdio é endereçado só pela semana
  (`materiais_semanal_semana_27`); duplicatas recebem sufixo numérico
  sequencial (`_1`, `_2`). O Material Especial deriva o endereço do título.
- Antes de publicar, a prévia avisa sobre materiais existentes da mesma semana
  (ou de mesmo título, no especial); o aviso nunca bloqueia.
- Publicar cria o material e dispara o aviso por e-mail ("material da semana"
  ou "material especial"); não define a semana atual.
- Na exclusão, só objetos da própria lição e não referenciados em outro lugar
  são removidos do S3, depois do commit.
- O auditor de órfãos é dry-run por padrão, ignora objetos recentes e nunca
  apaga órfãos do Estúdio.

## Clubinho photos, videos and authorship

Shared idea submissions require a title (up to 120 characters), description
(up to 2000 characters), and 1–20 media items. Documents are PDF/DOC/DOCX up to
20 MB; images are JPG/JPEG/PNG/WEBP/GIF up to 10 MB; videos are MP4/WEBM up to
100 MB or valid YouTube links. MIME type, extension, actual byte size and
multipart field binding are checked before S3 writes. Document/image links and
non-YouTube video links are rejected. The API ignores per-media title and
description on create, generating a type label and per-type sequence number
followed by the idea title; media descriptions are empty. Admin flows retain
unchanged legacy links and generate metadata for new media.

`POST /image-sections` accepts 1–20 photos or exactly one uploaded video, never a
mixed collection. Photo uploads allow JPG/PNG/WebP/GIF up to 10 MB each; videos
allow MP4/WebM up to 100 MB. The server validates MIME/extension, initial file
signature, size, count, multipart binding and existing-media ownership before
storage changes. New video links are not accepted. Existing photo links remain
supported. Caption and description are trimmed and required; caption is limited
to 255 characters. Create payloads cannot include visibility or author fields.

JWT `userId` is persisted as nullable `image_sections.authorId` (FK to users,
ON DELETE SET NULL). The TypeORM-generated AddClubinhoMediaAuthor migration must
run before deploying this code. Legacy posts retain a null author. Feed and
moderation responses add `author: { name: string } | null`, with no email,
password or other user fields. Review never replaces the submitting author.

Create remains authenticated; list/detail/update/delete remain admin-only.
New submissions are private and detached. Saving without publication detaches
from the feed; approval attaches to FEED_CLUBINHO_PAGE_ID. Pending queries count
private or detached sections. Media rows and section changes share a transaction.
On replacement, old files are cleaned only after commit; failed writes discard
unreferenced new uploads. Photos and videos use the same moderated per-media comment flow; documents remain unsupported.

Invalid selection or ownership uses VALIDATION_ERROR/INVALID_INPUT; invalid
files use INVALID_FILE, and missing uploads use MEDIA_FILE_NOT_FOUND. The global
error envelope is unchanged. No production migration was executed.


### Production compatibility for existing photos

Apply `AddClubinhoMediaAuthor1793841264523` before starting the new API. Its `up`
only adds the nullable `authorId` column and an `ON DELETE SET NULL` FK: no photo,
section, media URL or existing row is deleted or rewritten, and no authorship
backfill is attempted. Old API versions ignore the additive column. Deploy the
API before the updated frontend; `author` remains optional/null-safe in the UI.
Old albums display `Autor não informado`; reviewing them does not attribute them
to the administrator. Existing albums above the new 20-photo upload limit can
still be reviewed while preserving or reducing their count. Their stored images
are reused without upload or deletion when only text/approval changes.
The local database had already auto-created the exact schema during hot reload;
TypeORM's `migration:generate --check` verified equality before the local history
was reconciled using `migration:run --fake`. **Do not use `--fake` for production**:
run the generated migration normally against the existing production schema.

### Shared idea AI review

- Original submissions are captured once; legacy capture is explicitly labelled. Every retry reads that snapshot.
- `idea_ai_enhancement` turns the whole AI flow on or off: automatic enqueue at submission, manual requests/regenerations (`403 FEATURE_DISABLED` when off) and worker processing. Review, cancellation, restore and publishing existing results do not depend on it. Locally, `./run.sh local` ensures it exists and is on.
- Automatic enqueue requires a configured provider (otherwise skipped and logged). Manual admin enqueue requires a configured provider (`400 IDEA_AI_8623`), enforces one active job and up to five counted attempts, and is refused for published ideas.
- Cancellations and infrastructure failures (missing provider, queue outage, stalled worker, missing snapshot) never consume an attempt.
- Admins can regenerate everything, only the text, chosen documents/images, or only what failed, with optional instructions subordinate to the essence rules. Untargeted items are carried over from the current result without new LLM calls; a redone item that fails keeps the previous approved version; a partial attempt replaces the current result only if something it redid succeeded.
- Admins can cancel the active attempt and restore an earlier finished result as current.
- A crashed attempt is reclaimed at most three times, then closed as `STALLED`. Lease times use the database clock. Progress per item is exposed.
- Text guard verdicts are per field: a rejected description no longer discards an approved title.
- Enhancement is an upgrade, never a replacement: prompts keep the teacher's words, idea and tone; text and documents must keep at least 70% of the original keywords (60% for titles), otherwise the proposal is rejected and the original kept; the judge rejects lost central idea or originality.
- Failed retries retain the previous completed result. Every publication decision identifies the current attempt; removed materials stay removed from publication and preserved in the original.
- The published title/description are the reviewed text sent by the admin (edits to the chosen version are kept and recorded as `edited`).
- Publishing during processing requires explicit confirmation, cancels the attempt (uncounted) and publishes the reviewed draft as sent, preventing late application. No AI operation publishes automatically.
- The admin queue can be filtered by AI state (ready, processing, failed, none).
- People receive no generative image edits; videos are skipped. Essential document visuals stay original. Guard failures are visible to administrators.
- Original and historical artifacts survive edits and publication. Deleting the idea or its containing page cleans history transactionally, with reference-checked S3 cleanup after commit.
- See [API, worker and rollout details](api-ideas-enhancement.md).

## Fila compartilhada de requisições de IA

Todas as chamadas de lição, revisão, imagem, melhoria/reprocessamento de ideias
compartilhadas e catálogo de modelos ao vivo passam por uma única fila
Redis/BullMQ. A concorrência global padrão é um, somadas todas as réplicas da
API. Cada retry de feature reentra na fila; falha do Redis nunca dispara HTTP
direto ao provedor, e a API continua subindo sem Redis, com as rotas de IA
degradadas. Jobs de um processo que deixou de existir são descartados. As
leases de domínio e as decisões de publicação permanecem no MySQL. Ver
[regras da fila](ai-request-queue.md).
