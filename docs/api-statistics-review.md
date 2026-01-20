# 📋 Endpoint Review - Statistics Module

> **Date**: Today
> **Objective**: Verify if all endpoints are applying the new rules

---

## ✅ Rules to Verify

1. **Active Children**: Only `isActive = true` are counted
2. **Join Date**: Respect `joinedAt` - previous weeks not counted
3. **Academic Period**: Return empty arrays when there is no period
4. **Academic Week**: Use academic year week (not ISO)
5. **Pagelas Outside Period**: Ignore pagelas with `week > maxAcademicWeek`

---

## 📊 Status of Each Endpoint

### ✅ ALREADY UPDATED ENDPOINTS

#### 1. `/statistics/attendance/club/:clubId`

- ✅ **Status**: Correctly implemented
- ✅ **isActive**: Filters only active children
- ✅ **joinedAt**: Respects join date
- ✅ **Academic Period**: Returns `missingWeeks: []` when no period
- ✅ **maxAcademicWeek**: Filters pagelas outside period
- ✅ **Academic Week**: Uses `getAcademicWeekYear`

#### 2. `/statistics/attendance/week`

- ✅ **Status**: Correctly implemented
- ✅ **Academic Period**: Returns `clubs: []` when no period or week is outside
- ✅ **Academic Week**: Uses calculation based on academic period

#### 3. `/statistics/children`

- ✅ **Status**: Correctly implemented
- ✅ **isActive**: Filters only active children (line 252, 1256)
- ✅ **joinedAt**: Filters `joinedAfter` and `joinedBefore` available
- ⚠️ **Note**: Method `getChildrenWithStats` already filters by `isActive`

#### 4. `/statistics/clubs`

- ✅ **Status**: Correctly implemented
- ✅ **isActive**: Filters only active children (lines 1609, 1628)
- ✅ **Pagelas**: Only from active children (line 1628)

#### 5. `/statistics/teachers`

- ✅ **Status**: Verified - uses queries that already filter by `isActive`
- ✅ **isActive**: Pagelas queries already filter active children

---

### ⚠️ ENDPOINTS NEEDING VERIFICATION

#### 6. `/statistics/pagelas/charts`

- ⚠️ **Status**: Uses `getPagelasWeeklyStats` which already filters by `isActive` (line 252)
- ✅ **isActive**: Already implemented
- ⚠️ **Verify**: If it respects academic period and academic week for `year` and `week` filters
- **Action**: Verify if `year` and `week` filters are treated as academic week

#### 7. `/statistics/accepted-christs/charts`

- ⚠️ **Status**: Need to verify if filters only active children
- **Action**: Verify `AcceptedChrists` queries

#### 8. `/statistics/insights`

- ⚠️ **Status**: Uses methods that already filter by `isActive`
- **Action**: Verify if respects academic period in rankings

#### 9. `/statistics/overview`

- ⚠️ **Status**: General Dashboard
- **Action**: Verify if respects academic period and filters only active children

#### 10. `/statistics/pagelas` (Legacy)

- ✅ **Status**: Uses `getPagelasWeeklyStats` which already filters by `isActive` (line 252)
- ✅ **isActive**: Already implemented

#### 11. `/statistics/accepted-christs` (Legacy)

- ⚠️ **Status**: Need to verify if filters only active children
- **Action**: Verify `applyAcceptedChristsFilters` method

#### 12. `/statistics/clubs/:clubId`

- ⚠️ **Status**: Uses `PagelasStatsQueryDto` filters
- **Action**: Verify if applies all rules in detailed data

#### 13. `/statistics/children/:childId`

- ⚠️ **Status**: Individual child view
- **Action**: Verify if shows only pagelas within academic period

#### 14. `/statistics/cities/:city`

- ⚠️ **Status**: Analysis by city
- **Action**: Verify if filters only active children and respects academic period

#### 15. `/statistics/teachers/:teacherId`

- ⚠️ **Status**: Individual teacher view
- **Action**: Verify if shows only active children

#### 16. `/statistics/compare`

- ⚠️ **Status**: Comparison between entities
- **Action**: Verify if applies all rules

#### 17. `/statistics/trends`

- ⚠️ **Status**: Trend analysis
- **Action**: Verify if respects academic period

#### 18. `/statistics/reports/consolidated`

- ⚠️ **Status**: Consolidated report
- **Action**: Verify if applies all rules

#### 19. `/statistics/rankings/:type`

- ⚠️ **Status**: Rankings
- **Action**: Verify if filters only active children and respects academic period

#### 20. `/statistics/dashboard/:role`

- ⚠️ **Status**: Personalized dashboard
- **Action**: Verify if applies all rules

---

## 🔍 Required Verifications

### Verify Method `applyPagelasFilters`

**Location**: `statistics.repository.ts`

**Rules to verify**:

1. ✅ Already filters by `isActive` (applied before calling `applyPagelasFilters`)
2. ⚠️ Verify if filters by academic period when `year` is provided
3. ⚠️ Verify if `week` is treated as academic week
4. ⚠️ Verify if ignores pagelas with `week > maxAcademicWeek`

### Verify Method `applyAcceptedChristsFilters`

**Location**: `statistics.repository.ts`

**Rules to verify**:

1. ⚠️ Verify if filters by `isActive`
2. ⚠️ Verify if respects academic period

### Verify Chart Data Methods

**Methods**:

- `getPagelasChartData`
- `getAcceptedChristsChartData`

**Rules to verify**:

1. ✅ Filter by `isActive` (via `applyPagelasFilters`)
2. ⚠️ Verify if respect academic period
3. ⚠️ Verify if use academic week for `year` and `week` filters

---

## 📝 Recommendations

### HIGH Priority

1. **Verify `applyAcceptedChristsFilters`**
   - Add `isActive = true` filter if not present

2. **Verify methods using `year` and `week`**
   - Ensure they are treated as academic week
   - Ensure they respect `maxAcademicWeek`

3. **Verify individual view endpoints**
   - `/statistics/children/:childId`
   - `/statistics/clubs/:clubId`
   - `/statistics/teachers/:teacherId`
   - Ensure they show only data within academic period

### MEDIUM Priority

1. **Verify comparison and report endpoints**
   - Ensure they apply all rules

2. **Verify dashboard endpoints**
   - Ensure they respect academic period

### LOW Priority

1. **Documentation**
   - Update endpoint documentation to mention rules

---

## ✅ Implementation Checklist

For each method working with pagelas or children:

- [ ] Filters only children with `isActive = true`
- [ ] Respects `joinedAt` (does not count weeks before joining)
- [ ] Respects academic period (returns empty when no period)
- [ ] Uses academic week (not ISO) when applicable
- [ ] Ignores pagelas with `week > maxAcademicWeek`
- [ ] Documentation updated

---

**Last Update**: Today
**Next Steps**: Verify listed methods and apply necessary corrections

---
⬅️ [Back to Documentation Hub](README.md)
