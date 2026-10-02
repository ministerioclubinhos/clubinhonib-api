# 📋 Compilation of Implemented Rules

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

## Estúdio: padrão editorial da lição bíblica

A etapa LESSON usa template 4.1.0 e prompt com notas curadas das Semanas 14,
15, 25 e 26: narrativa participativa, orientações ao professor, preservação das
escolhas do exemplo correspondente e sinalização de referências incompletas.
Cenas ficam em visualScenes, fora da história; o schema admite 8 a 10 perguntas.
A oração final separada é opcional (string vazia por padrão), e sua seção vazia
não é renderizada. A oração do apelo permanece. Editor ordena as seções
independentemente da ordem das propriedades do JSON. Ver api-ai-lessons.md.

## Estúdio: configuração de provedores

O documento da etapa de lição separa o cabeçalho em `LIÇÃO <semana>`,
`TÍTULO` e o tema. A semana cadastrada prevalece sobre números produzidos
pelo modelo; referências e propósito permanecem em suas seções próprias.
O detalhe retorna as versões antigas com esse mesmo cabeçalho no editor,
preservando o restante do documento e sem escrever no banco durante a leitura.

A geração resolve o provedor ativo e todos os parâmetros de LLM exclusivamente
na tabela ai_provider_settings, gerenciada pela página de configurações.
GET/PUT /api/v1/lessons/providers/settings requerem administrador; o PUT salva
ambos os provedores e a escolha ativa atomicamente. Não há leitura de env,
credenciais embutidas, fallback entre provedores ou sucesso simulado em falhas
de persistência. maxRetries e retryBaseDelayMs são inteiros não negativos.

## Estúdio: formatação manual na exportação

A versão Tiptap salva prevalece na lição, brincadeira, fixação e meditações
editadas manualmente. Marcas de fonte, tamanho, cores e links, atributos de
espaçamento e células mescladas são convertidos para DOCX antes do PDF.
A normalização do cabeçalho já separado preserva suas marcas. A prévia e a
exportação recebem a origem da versão para identificar meditações editadas,
que substituem a imposição baseada no JSON estruturado antigo.

## Estúdio: sub-histórias da lição

Temas e orientações com múltiplos relatos exigem subtítulos separados no
prompt compartilhado pelos provedores. O marcador de linha `###` em story
vira título H3 no editor e na exportação, inclusive no fallback estruturado.
A extração da narrativa editada mantém esses marcadores para preservar a
separação nos produtos posteriores. Não há mudanças no schema ou endpoints.
