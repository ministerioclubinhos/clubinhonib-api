# 📋 Revisão de Endpoints - Módulo de Estatísticas

> **Data**: Hoje  
> **Objetivo**: Verificar se todos os endpoints estão aplicando as novas regras

---

## ✅ Regras a Verificar

1. **Crianças Ativas**: Apenas `isActive = true` são contabilizadas
2. **Data de Entrada**: Respeitar `joinedAt` - semanas anteriores não contabilizadas
3. **Período Letivo**: Retornar arrays vazios quando não há período
4. **Semana Acadêmica**: Usar semana do ano letivo (não ISO)
5. **Pagelas Fora do Período**: Ignorar pagelas com `week > maxAcademicWeek`

---

## 📊 Status de Cada Endpoint

### ✅ ENDPOINTS JÁ ATUALIZADOS

#### 1. `/statistics/attendance/club/:clubId`
- ✅ **Status**: Implementado corretamente
- ✅ **isActive**: Filtra apenas crianças ativas
- ✅ **joinedAt**: Respeita data de entrada
- ✅ **Período Letivo**: Retorna `missingWeeks: []` quando não há período
- ✅ **maxAcademicWeek**: Filtra pagelas fora do período
- ✅ **Semana Acadêmica**: Usa `getAcademicWeekYear`

#### 2. `/statistics/attendance/week`
- ✅ **Status**: Implementado corretamente
- ✅ **Período Letivo**: Retorna `clubs: []` quando não há período ou semana está fora
- ✅ **Semana Acadêmica**: Usa cálculo baseado no período letivo

#### 3. `/statistics/children`
- ✅ **Status**: Implementado corretamente
- ✅ **isActive**: Filtra apenas crianças ativas (linha 252, 1256)
- ✅ **joinedAt**: Filtros `joinedAfter` e `joinedBefore` disponíveis
- ⚠️ **Nota**: Método `getChildrenWithStats` já filtra por `isActive`

#### 4. `/statistics/clubs`
- ✅ **Status**: Implementado corretamente
- ✅ **isActive**: Filtra apenas crianças ativas (linhas 1609, 1628)
- ✅ **Pagelas**: Apenas de crianças ativas (linha 1628)

#### 5. `/statistics/teachers`
- ✅ **Status**: Verificado - usa queries que já filtram por `isActive`
- ✅ **isActive**: Queries de pagelas já filtram crianças ativas

---

### ⚠️ ENDPOINTS QUE PRECISAM VERIFICAÇÃO

#### 6. `/statistics/pagelas/charts`
- ⚠️ **Status**: Usa `getPagelasWeeklyStats` que já filtra por `isActive` (linha 252)
- ✅ **isActive**: Já implementado
- ⚠️ **Verificar**: Se respeita período letivo e semana acadêmica para filtros `year` e `week`
- **Ação**: Verificar se filtros `year` e `week` são tratados como semana acadêmica

#### 7. `/statistics/accepted-christs/charts`
- ⚠️ **Status**: Precisa verificar se filtra apenas crianças ativas
- **Ação**: Verificar queries de `AcceptedChrists`

#### 8. `/statistics/insights`
- ⚠️ **Status**: Usa métodos que já filtram por `isActive`
- **Ação**: Verificar se respeita período letivo em rankings

#### 9. `/statistics/overview`
- ⚠️ **Status**: Dashboard geral
- **Ação**: Verificar se respeita período letivo e filtra apenas crianças ativas

#### 10. `/statistics/pagelas` (Legacy)
- ✅ **Status**: Usa `getPagelasWeeklyStats` que já filtra por `isActive` (linha 252)
- ✅ **isActive**: Já implementado

#### 11. `/statistics/accepted-christs` (Legacy)
- ⚠️ **Status**: Precisa verificar se filtra apenas crianças ativas
- **Ação**: Verificar método `applyAcceptedChristsFilters`

#### 12. `/statistics/clubs/:clubId`
- ⚠️ **Status**: Usa filtros de `PagelasStatsQueryDto`
- **Ação**: Verificar se aplica todas as regras nos dados detalhados

#### 13. `/statistics/children/:childId`
- ⚠️ **Status**: Visão individual de criança
- **Ação**: Verificar se mostra apenas pagelas dentro do período letivo

#### 14. `/statistics/cities/:city`
- ⚠️ **Status**: Análise por cidade
- **Ação**: Verificar se filtra apenas crianças ativas e respeita período letivo

#### 15. `/statistics/teachers/:teacherId`
- ⚠️ **Status**: Visão individual de professor
- **Ação**: Verificar se mostra apenas crianças ativas

#### 16. `/statistics/compare`
- ⚠️ **Status**: Comparação entre entidades
- **Ação**: Verificar se aplica todas as regras

#### 17. `/statistics/trends`
- ⚠️ **Status**: Análise de tendências
- **Ação**: Verificar se respeita período letivo

#### 18. `/statistics/reports/consolidated`
- ⚠️ **Status**: Relatório consolidado
- **Ação**: Verificar se aplica todas as regras

#### 19. `/statistics/rankings/:type`
- ⚠️ **Status**: Rankings
- **Ação**: Verificar se filtra apenas crianças ativas e respeita período letivo

#### 20. `/statistics/dashboard/:role`
- ⚠️ **Status**: Dashboard personalizado
- **Ação**: Verificar se aplica todas as regras

---

## 🔍 Verificações Necessárias

### Verificar Método `applyPagelasFilters`

**Localização**: `statistics.repository.ts`

**Regras a verificar**:
1. ✅ Já filtra por `isActive` (aplicado antes de chamar `applyPagelasFilters`)
2. ⚠️ Verificar se filtra por período letivo quando `year` é fornecido
3. ⚠️ Verificar se `week` é tratado como semana acadêmica
4. ⚠️ Verificar se ignora pagelas com `week > maxAcademicWeek`

### Verificar Método `applyAcceptedChristsFilters`

**Localização**: `statistics.repository.ts`

**Regras a verificar**:
1. ⚠️ Verificar se filtra por `isActive`
2. ⚠️ Verificar se respeita período letivo

### Verificar Métodos de Chart Data

**Métodos**:
- `getPagelasChartData`
- `getAcceptedChristsChartData`

**Regras a verificar**:
1. ✅ Filtram por `isActive` (via `applyPagelasFilters`)
2. ⚠️ Verificar se respeitam período letivo
3. ⚠️ Verificar se usam semana acadêmica para filtros `year` e `week`

---

## 📝 Recomendações

### Prioridade ALTA

1. **Verificar `applyAcceptedChristsFilters`**
   - Adicionar filtro `isActive = true` se não estiver presente

2. **Verificar métodos que usam `year` e `week`**
   - Garantir que são tratados como semana acadêmica
   - Garantir que respeitam `maxAcademicWeek`

3. **Verificar endpoints de visão individual**
   - `/statistics/children/:childId`
   - `/statistics/clubs/:clubId`
   - `/statistics/teachers/:teacherId`
   - Garantir que mostram apenas dados dentro do período letivo

### Prioridade MÉDIA

1. **Verificar endpoints de comparação e relatórios**
   - Garantir que aplicam todas as regras

2. **Verificar endpoints de dashboard**
   - Garantir que respeitam período letivo

### Prioridade BAIXA

1. **Documentação**
   - Atualizar documentação dos endpoints para mencionar as regras

---

## ✅ Checklist de Implementação

Para cada método que trabalha com pagelas ou crianças:

- [ ] Filtra apenas crianças com `isActive = true`
- [ ] Respeita `joinedAt` (não contabiliza semanas anteriores à entrada)
- [ ] Respeita período letivo (retorna vazio quando não há período)
- [ ] Usa semana acadêmica (não ISO) quando aplicável
- [ ] Ignora pagelas com `week > maxAcademicWeek`
- [ ] Documentação atualizada

---

**Última Atualização**: Hoje  
**Próximos Passos**: Verificar métodos listados e aplicar correções necessárias

