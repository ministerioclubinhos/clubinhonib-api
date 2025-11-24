# 📋 Compilado de Todas as Regras Implementadas

> **Data**: Hoje  
> **Módulos Afetados**: Controle de Clubinho e Estatísticas  
> **Versão**: 1.8.2 (Controle) | 2.8.0 (Estatísticas)

---

## 🎯 Índice

1. [Regras de Crianças (isActive e joinedAt)](#1-regras-de-crianças-isactive-e-joinedat)
2. [Regras de Período Letivo](#2-regras-de-período-letivo)
3. [Regras de Semana Acadêmica vs ISO](#3-regras-de-semana-acadêmica-vs-iso)
4. [Regras de Indicadores e Status](#4-regras-de-indicadores-e-status)
5. [Regras de Pagelas](#5-regras-de-pagelas)
6. [Regras de Retorno de Dados](#6-regras-de-retorno-de-dados)
7. [Regras de Ordenação](#7-regras-de-ordenação)
8. [Regras de Paginação](#8-regras-de-paginação)

---

## 1. Regras de Crianças (isActive e joinedAt)

### 1.1. Campo `isActive` na Entidade Child

**Regra**: Todas as crianças devem ter um campo `isActive` (boolean) que indica se a criança ainda está ativa no clubinho.

**Implementação**:
- ✅ Campo adicionado na `ChildEntity`
- ✅ Valor padrão: `true` (crianças existentes são consideradas ativas)
- ✅ Campo obrigatório no banco de dados

**Impacto**:
- Crianças inativas (`isActive = false`) **NUNCA** aparecem em:
  - Estatísticas
  - Rankings
  - Controle de clubinho
  - Análises de frequência
  - Cálculos de métricas

### 1.2. Campo `joinedAt` na Entidade Child

**Regra**: Todas as crianças devem ter um campo `joinedAt` (date) que indica quando a criança entrou no clubinho.

**Implementação**:
- ✅ Campo adicionado na `ChildEntity`
- ✅ Campo opcional (pode ser `NULL`)
- ✅ Se `NULL`, considera como se sempre estivesse no clube

**Impacto**:
- Se uma criança entrou no meio do ano letivo:
  - ✅ Semanas **após** a entrada → Contabilizadas
  - ❌ Semanas **anteriores** à entrada → **NÃO** contabilizadas
  - ❌ Não gera indicadores negativos para semanas anteriores
  - ❌ Não aparece em estatísticas de semanas anteriores

**Exemplo**:
```
Criança entrou em 15/06/2024 (semana 20 do ano letivo)
- Semana 1-19: ❌ NÃO contabilizada (não estava no clube)
- Semana 20+: ✅ Contabilizada (já estava no clube)
```

---

## 2. Regras de Período Letivo

### 2.1. Período Letivo Global

**Regra**: Existe um único período letivo GLOBAL que se aplica a TODOS os clubes.

**Estrutura**:
- `year`: Ano do período letivo (ex: 2024)
- `startDate`: Data de início (ex: "2024-03-01")
- `endDate`: Data de fim (ex: "2024-11-30")
- `isActive`: Se o período está ativo

### 2.2. Retorno Vazio quando Não Há Período

**Regra**: Se não há período letivo cadastrado, os endpoints retornam arrays vazios.

**Aplicado em**:
- ✅ `/club-control/check/week` → `clubs: []`
- ✅ `/club-control/dashboard` → `clubs: []`
- ✅ `/statistics/attendance/week` → `clubs: []`
- ✅ `/statistics/attendance/club/:id` → `missingWeeks: []`

**Resposta quando não há período**:
```json
{
  "year": 2025,
  "week": 39,
  "clubs": [], // ⭐ ARRAY VAZIO
  "summary": {
    "totalClubs": 0,
    "clubsOk": 0,
    "clubsMissing": 0,
    // ...
  },
  "note": "Período letivo não cadastrado - nenhum clube retornado"
}
```

### 2.3. Retorno Vazio quando Semana Está Fora do Período

**Regra**: Se a semana consultada está fora do período letivo, retorna arrays vazios.

**Aplicado em**:
- ✅ `/club-control/check/week?year=2025&week=50` (se período vai até semana 39)
- ✅ `/statistics/attendance/week?year=2025&week=50`

**Resposta quando semana está fora**:
```json
{
  "year": 2025,
  "week": 50,
  "clubs": [], // ⭐ ARRAY VAZIO
  "summary": {
    "totalClubs": 0,
    // ...
  },
  "period": {
    "year": 2025,
    "startDate": "2025-03-01",
    "endDate": "2025-11-30"
  },
  "note": "Semana fora do período letivo (01/03/2025 a 30/11/2025) - nenhum clube retornado"
}
```

### 2.4. Indicadores Apenas Dentro do Período

**Regra**: Indicadores (positivos ou negativos) só são gerados se:
1. Há período letivo cadastrado
2. A semana está dentro do período letivo

**Implementação**:
- ✅ Se não há período → `indicators: []` (vazio)
- ✅ Se semana está fora → `indicators: []` (vazio)
- ✅ Se está dentro → Indicadores são gerados normalmente

---

## 3. Regras de Semana Acadêmica vs ISO

### 3.1. Duas Réguas de Semanas

**IMPORTANTE**: Existem **DUAS** "réguas" de semanas diferentes:

#### 📅 Semana ISO (Ano Calendário)
- Baseada no calendário gregoriano
- Semana 1 começa na primeira segunda-feira do ano
- Ano pode ter 52 ou 53 semanas
- Exemplo: 05/01/2024 pode ser semana 1 de 2024

#### 🎓 Semana do Ano Letivo
- Baseada no **período letivo cadastrado**
- A primeira semana dentro do período letivo é a **"semana 1"** do ano letivo
- Contagem começa quando o período letivo inicia
- Exemplo: Período letivo 2024 inicia em 05/02/2024 → essa é a semana 1 do ano letivo 2024

### 3.2. Regra para Todas as Consultas

**Regra**: **TODOS os parâmetros** `year` e `week` nos endpoints são do **ANO LETIVO**, não semana ISO.

**Aplicado em**:
- ✅ `/club-control/check/week?year=2025&week=39` → semana 39 do ano letivo
- ✅ `/statistics/attendance/week?year=2025&week=39` → semana 39 do ano letivo
- ✅ `/statistics/attendance/club/:id?year=2025` → ano letivo 2025

### 3.3. Pagelas Armazenadas com Semana Acadêmica

**Regra**: **TODAS as pagelas** são armazenadas com **semana do ANO LETIVO**, não semana ISO.

**Campos da Pagela**:
- `year`: Ano do período letivo (ex: 2024)
- `week`: Semana do ano letivo (1-N, onde N = total de semanas do período)

**Exemplo**:
```
Período Letivo 2024:
- Início: 05/02/2024
- Fim: 15/12/2024

Datas e suas semanas:
| Data       | Semana ISO | Semana Ano Letivo | Ano Letivo |
|------------|------------|-------------------|------------|
| 05/02/2024 | Semana 6   | Semana 1 ✅       | 2024       |
| 12/02/2024 | Semana 6   | Semana 1 ✅       | 2024       |
| 19/02/2024 | Semana 7   | Semana 2 ✅       | 2024       |
| 15/12/2024 | Semana 50  | Semana 44 ✅      | 2024       |
```

### 3.4. Limite de Semanas do Período Letivo

**Regra**: Se um ano letivo tem N semanas, **APENAS** as semanas 1 até N são contabilizadas.

**Implementação**:
1. **Pagelas da semana N+1+ NÃO são contabilizadas**
   - Se período tem 30 semanas, pagelas com `week > 30` são **IGNORADAS**
   - Não aparecem nas estatísticas
   - Não aparecem no controle
   - São consideradas "fora do período letivo"

2. **Semanas faltantes dentro do período SÃO detectadas**
   - Se período tem 30 semanas e não há pagela da semana 1 até 30
   - Entra nas estatísticas como semana faltante (`missingWeeks`)
   - Aparece no controle como "falta" (`status: 'missing'`)
   - Gera alerta negativo

**Exemplo**:
```
Período Letivo 2024:
- Início: 05/02/2024
- Fim: 15/12/2024
- Total: 30 semanas (semana 1 até semana 30)

Cenário 1: Pagela da semana 31
- Pagela criada com week = 31
- ✅ NÃO é contabilizada nas estatísticas
- ✅ NÃO é contabilizada no controle
- Sistema retorna clubs: [] se buscar semana 31

Cenário 2: Semana 1 até 30 sem pagela
- Período tem 30 semanas
- Clube não tem pagela da semana 1 até semana 30
- ✅ SIM aparece nas estatísticas como semana faltante (missingWeeks)
- ✅ SIM entra no controle como "falta" (status: 'missing')
- ✅ Gera alerta negativo (missing_weeks)
```

---

## 4. Regras de Indicadores e Status

### 4.1. Status de Clubes

**Status possíveis**:
- `ok`: Todas as crianças têm pagela
- `partial`: Algumas crianças têm pagela
- `missing`: Nenhuma criança tem pagela
- `exception`: Há exceção global cadastrada para a data
- `inactive`: Clube inativo
- `out_of_period`: Semana está fora do período letivo
- `pending`: ⭐ **NOVO** - Pagelas não foram lançadas, mas o dia do clubinho ainda não passou

### 4.2. Status `pending` (NOVO)

**Regra**: Status `pending` representa um clube onde:
- Pagelas ainda não foram lançadas
- O dia do clubinho da semana atual ainda não passou
- Não é considerado "atrasado" ou "faltante"

**Aplicação**:
- ✅ **APENAS** para a semana **ATUAL** do ano letivo
- ✅ **APENAS** se o dia do clubinho ainda **NÃO** passou
- ✅ Para semanas passadas, sempre usa `ok`, `partial` ou `missing`

**Exemplo**:
```
Hoje: Sexta-feira, 21/11/2025
Clube: Sábado (clubNumber: 47)
Semana: 39 (semana atual)

Status: pending (dia do clubinho é sábado, ainda não passou)
Indicadores: [] (vazio, não mostra alertas negativos)

Se hoje fosse domingo (22/11/2025):
Status: missing (dia do clubinho já passou e não tem pagelas)
Indicadores: [no_pagela] (mostra alerta negativo)
```

### 4.3. Indicadores Negativos Apenas Após o Dia do Clubinho

**Regra**: Indicadores negativos só são retornados se:
1. A semana consultada é a **SEMANA ATUAL** do ano letivo
2. **E** o dia do clubinho da semana atual **JÁ PASSOU**

**Implementação**:
- ✅ Se clube é no sábado e hoje é sexta → **NÃO** mostra indicadores negativos
- ✅ Se clube é no sábado e hoje é domingo → **SIM** mostra indicadores negativos
- ✅ Para semanas passadas → Sempre mostra indicadores (se aplicável)

**Exemplo**:
```
Clube: Sábado (clubNumber: 47)
Semana: 39 (semana atual)
Hoje: Sexta-feira, 21/11/2025

Resultado:
- status: "pending"
- indicators: [] (vazio)
- Não mostra alertas negativos

Se hoje fosse domingo, 23/11/2025:
- status: "missing"
- indicators: [{ type: "no_pagela", severity: "critical", ... }]
- Mostra alertas negativos
```

### 4.4. Indicadores Apenas Dentro do Período

**Regra**: Indicadores (positivos ou negativos) só são gerados se:
1. Há período letivo cadastrado
2. A semana está dentro do período letivo

**Implementação**:
- ✅ Se não há período → `indicators: []` (vazio)
- ✅ Se semana está fora → `indicators: []` (vazio)
- ✅ Se está dentro → Indicadores são gerados normalmente

---

## 5. Regras de Pagelas

### 5.1. Pagelas com Semana Acadêmica

**Regra**: Todas as pagelas são armazenadas com semana do **ANO LETIVO**, não semana ISO.

**Campos**:
- `year`: Ano do período letivo
- `week`: Semana do ano letivo (1-N)

### 5.2. Filtragem de Pagelas por Período

**Regra**: Pagelas fora do período letivo são ignoradas.

**Implementação**:
- ✅ Se período tem 30 semanas, pagelas com `week > 30` são ignoradas
- ✅ Pagelas de outro ano letivo são ignoradas
- ✅ Apenas pagelas dentro do período são contabilizadas

### 5.3. Pagelas Apenas para Crianças Ativas

**Regra**: Apenas pagelas de crianças **ATIVAS** (`isActive = true`) são contabilizadas.

**Implementação**:
- ✅ Todas as queries filtram `child.isActive = true`
- ✅ Crianças inativas não aparecem em estatísticas
- ✅ Crianças inativas não geram indicadores

### 5.4. Pagelas Respeitando Data de Entrada

**Regra**: Pagelas só são esperadas para crianças que já tinham entrado no clube.

**Implementação**:
- ✅ Se criança entrou na semana 20, semanas 1-19 não são esperadas
- ✅ Apenas semanas após `joinedAt` são contabilizadas
- ✅ Não gera indicadores negativos para semanas anteriores

---

## 6. Regras de Retorno de Dados

### 6.1. Array `clubs` Vazio

**Regra**: O array `clubs` retorna vazio (`[]`) quando:
1. Não há período letivo cadastrado
2. A semana está fora do período letivo

**Aplicado em**:
- ✅ `/club-control/check/week`
- ✅ `/club-control/dashboard`
- ✅ `/statistics/attendance/week`

### 6.2. Array `missingWeeks` Vazio

**Regra**: O array `missingWeeks` retorna vazio (`[]`) quando:
1. Não há período letivo cadastrado
2. Não há semanas faltantes dentro do período

**Aplicado em**:
- ✅ `/statistics/attendance/club/:id`

### 6.3. Array `indicators` Vazio

**Regra**: O array `indicators` retorna vazio (`[]`) quando:
1. Não há período letivo cadastrado
2. A semana está fora do período letivo
3. Status é `pending` (dia ainda não passou)
4. Status é `ok` e não há indicadores positivos a mostrar

---

## 7. Regras de Ordenação

### 7.1. Ordenação de Clubes no Controle

**Regra**: Clubes com indicadores negativos aparecem **PRIMEIRO** na lista.

**Ordem de Prioridade**:
1. `missing` (mais crítico)
2. `partial` (crítico)
3. `exception` (informativo)
4. `inactive` (informativo)
5. `out_of_period` (informativo)
6. `pending` (pendente, mas dentro do prazo)
7. `ok` (OK, aparece por último)

**Implementação**:
- ✅ Clubes ordenados por `statusPriority`
- ✅ Clubes com problemas aparecem primeiro
- ✅ Facilita identificação de clubes que precisam atenção

---

## 8. Regras de Paginação

### 8.1. Paginação Padrão

**Regra**: Todos os endpoints de listagem aplicam paginação.

**Valores Padrão**:
- `page`: 1 (se não fornecido)
- `limit`: 50 (se não fornecido)

**Aplicado em**:
- ✅ `/club-control/check/week?page=1&limit=50`
- ✅ `/club-control/dashboard?page=1&limit=20`
- ✅ `/statistics/attendance/week?page=1&limit=50`

### 8.2. Objeto `pagination` Sempre Presente

**Regra**: O objeto `pagination` sempre está presente na resposta, mesmo quando `clubs: []`.

**Estrutura**:
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

## 9. Regras de Cálculo Automático

### 9.1. Cálculo Automático da Semana Atual

**Regra**: Se `year` e `week` não são fornecidos, o sistema calcula automaticamente a semana atual do ano letivo.

**Aplicado em**:
- ✅ `/club-control/check/week` (sem parâmetros)
- ✅ `/club-control/dashboard` (sem parâmetros)

**Comportamento**:
- Se não há período letivo → Retorna `clubs: []` e `note`
- Se está fora do período → Retorna `clubs: []` e `note`
- Se está dentro → Retorna dados da semana atual

---

## 10. Regras de Semana (Segunda a Sábado)

### 10.1. Definição de Semana

**Regra**: A semana começa na **segunda-feira** e termina no **sábado**. **Domingo não conta**.

**Implementação**:
- ✅ Cálculo de semanas baseado em segunda a sábado
- ✅ Domingo não é considerado parte da semana
- ✅ Semana acadêmica calculada corretamente

---

## 📊 Resumo das Regras Críticas

### ✅ Regras Implementadas

1. ✅ Crianças inativas (`isActive = false`) não aparecem em estatísticas
2. ✅ Data de entrada (`joinedAt`) é respeitada - semanas anteriores não são contabilizadas
3. ✅ Período letivo é obrigatório - retorna arrays vazios se não há período
4. ✅ Semana fora do período retorna arrays vazios
5. ✅ Pagelas com `week > maxAcademicWeek` são ignoradas
6. ✅ Semanas acadêmicas são usadas (não ISO)
7. ✅ Indicadores negativos só aparecem após o dia do clubinho (semana atual)
8. ✅ Status `pending` para semana atual antes do dia passar
9. ✅ Ordenação: clubes com problemas aparecem primeiro
10. ✅ Paginação sempre aplicada com valores padrão

### ⚠️ Pontos de Atenção

1. **Sempre usar semana do ano letivo** nos parâmetros `year` e `week`
2. **Verificar se há período letivo** antes de exibir dados no frontend
3. **Status `pending`** só aparece para semana atual antes do dia passar
4. **Arrays vazios** indicam que não há dados ou período não configurado

---

## 🔄 Compatibilidade

### Endpoints Afetados

**Módulo de Controle**:
- `GET /club-control/check/week`
- `GET /club-control/dashboard`
- `GET /club-control/indicators/detailed`

**Módulo de Estatísticas**:
- `GET /statistics/attendance/week`
- `GET /statistics/attendance/club/:id`
- `GET /statistics/children`
- `GET /statistics/clubs`
- `GET /statistics/teachers`

### Breaking Changes

⚠️ **ATENÇÃO**: Alguns comportamentos mudaram:
- Arrays podem retornar vazios quando antes retornavam dados
- Status `pending` foi adicionado
- Ordenação de clubes mudou
- Semanas agora são acadêmicas, não ISO

---

## 📝 Notas Finais

- Todas as regras foram implementadas e testadas
- Documentação atualizada nos MDs de cada módulo
- Logs de debug removidos do código de produção
- Código compilando sem erros

---

**Última Atualização**: Hoje  
**Versão do Documento**: 1.0

