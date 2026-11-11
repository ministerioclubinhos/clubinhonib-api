# Estatísticas — o que cada número conta

Referência das onze rotas de `/statistics`. Para cada métrica: **numerador**,
**denominador**, o que acontece quando o denominador é zero, e de onde vem a
data. É o que a §11.3 de `docs/CLUBINHO_BACKEND_BEST_PRACTICES.md` exige antes
de qualquer mudança de fórmula.

Todas as rotas exigem sessão e papel de administração
(`@UseGuards(JwtAuthGuard, AdminRoleGuard)`).

## Onde mora cada coisa

| Camada | Arquivo |
|---|---|
| Fórmulas puras | `src/modules/statistics/utils/metrics.utils.ts` |
| Fixtures das fórmulas | `src/modules/statistics/utils/metrics.utils.spec.ts` |
| Quem era esperado, e quando | `src/modules/statistics/utils/enrollment.utils.ts` (+ `.spec.ts`) |
| Regras em SQL e limiares | `src/modules/statistics/constants.ts` |
| Regra de fuso | `src/modules/statistics/utils/date.utils.ts` |
| Consultas | `src/modules/statistics/repositories/` (um arquivo por assunto) |
| Montagem das respostas | `src/modules/statistics/statistics.service.ts` |

Os repositórios por assunto:

| Arquivo | Assunto |
|---|---|
| `pagelas-statistics.repository.ts` | pagelas |
| `accepted-christs-statistics.repository.ts` | decisões |
| `overview-statistics.repository.ts` | totais e distribuições da visão geral |
| `children-statistics.repository.ts` | crianças e ranking de clubinhos |
| `clubs-teachers-statistics.repository.ts` | clubinhos e professores |
| `attendance-statistics.repository.ts` | frequência |
| `expected-children.repository.ts` | presenças esperadas (o denominador da presença) |

Nenhuma fórmula deve ser reescrita à mão dentro do service ou do repositório: as
que existem estão nas utils e são cobertas por fixture exata.

## Fuso horário

As colunas de data (`pagela.date`, `child.birthDate`, `child.joinedAt`) guardam
**data de calendário**, sem horário. Duas armadilhas, ambas já resolvidas nas
utils:

- `new Date('2016-09-06')` é meia-noite **UTC**. Em fuso negativo — o Brasil
  inteiro — isso vira o dia 5 local. Quem lê data de calendário usa
  `parseDateOnly`, nunca o construtor direto.
- `toISOString().slice(0, 10)` sobre uma data local converte para UTC antes de
  recortar, e desloca a janela um dia. A formatação usa `toDateOnly`, que lê os
  componentes locais.

O projeto não fixa `TZ`; sem essas duas regras o resultado dependeria de onde a
API estivesse rodando.

## Fórmulas

### Taxas de pagela

| Métrica | Numerador | Denominador |
|---|---|---|
| `presenceRate` | pagelas com presença | presenças **esperadas** no recorte — ver [Regras de 2026-11-11](#regras-de-2026-11-11) |
| `meditationRate` | pagelas com meditação | pagelas lançadas no recorte |
| `verseRecitationRate` | pagelas com versículo recitado | pagelas lançadas no recorte |

Denominador zero devolve `0`, e não `NaN`. A presença tem teto de 100.

### `engagementScore` — engajamento de uma criança

```
(presenças × 0,30 + meditações × 0,35 + versículos × 0,35) ÷ total de pagelas × 100
```

Escala de 0 a 100. Presença pesa menos porque é o pré-requisito, não o
objetivo. Sem pagela no recorte o índice é `0` — a criança não tem histórico
para pontuar, e não um engajamento ruim.

### `clubPerformanceScore` — desempenho de um clubinho

```
presenceRate × 0,30 + meditationRate × 0,30 + activityRate × 0,20 + decisionRate × 0,20
```

As quatro parcelas já vêm em pontos de 0 a 100 e os pesos somam 1, então o
resultado fica na mesma escala.

- `presenceRate` = presenças ÷ presenças esperadas
- `meditationRate` = meditações ÷ pagelas lançadas
- `activityRate` = crianças com presença no recorte ÷ crianças esperadas no recorte
- `decisionRate` = crianças distintas com decisão no recorte ÷ crianças com presença

Cada parcela tem teto de 100, e o índice também. A conta mora em
`clubPerformance` e é a **única**: o ranking (`/statistics/insights`, panorama)
e a listagem de `/statistics/clubs` — inclusive a ordenação e os filtros por
índice — usam o mesmo valor.

### `growthRate` — variação de crescimento

```
(valor atual − valor de três meses atrás) ÷ valor de três meses atrás × 100
```

Sem base anterior devolve `0`, não infinito: sair de zero para dez não é
"crescimento infinito", é ausência de base. Queda a zero devolve `-100`.

### `consecutiveAcademicWeeks` — sequência de presença

Conta as semanas letivas seguidas a partir da mais recente, e para na primeira
que falta. A virada de ano quebra a sequência de propósito: sem saber quantas
semanas teve o ano anterior, encadear `2025-52` com `2026-1` seria chute.

A sequência é **ancorada na semana letiva corrente**: só vale se a semana mais
recente for a corrente ou a anterior (o clubinho desta semana pode ainda não ter
acontecido). Quem veio cinco semanas em março e sumiu tem `0`, não `5`. Fora do
período letivo não há sequência em curso, e o valor é `0`.

### Faixas

| Faixa etária | Tempo de participação |
|---|---|
| `0-5`, `6-10`, `11-15`, `16+` | `0-3 meses`, `3-6 meses`, `6-12 meses`, `1+ ano` |

Idade é contada em anos completos na data de referência. Tempo de participação
é contado em meses de calendário e nunca é negativo — data de entrada no futuro
(digitação errada) vale `0`, não "-2 meses".

### Arredondamento

Todos os índices e taxas saem com **uma casa decimal**, arredondados só no fim.
Arredondar cada parcela acumularia erro na média.

## As onze rotas

| Rota | O que devolve |
|---|---|
| `GET /statistics/overview` | Totais gerais, taxas da semana e do mês, variação de crescimento de crianças e decisões |
| `GET /statistics/pagelas` | Estatísticas de pagela no recorte de filtros |
| `GET /statistics/pagelas/charts` | As mesmas, no formato que os gráficos consomem |
| `GET /statistics/accepted-christs` | Decisões por período, gênero, faixa etária, clubinho e cidade |
| `GET /statistics/accepted-christs/charts` | As mesmas, no formato dos gráficos |
| `GET /statistics/insights` | Combinação de pagelas e decisões num recorte só |
| `GET /statistics/children` | Uma linha por criança, com taxas, engajamento e decisões |
| `GET /statistics/clubs` | Uma linha por clubinho, com desempenho e distribuições |
| `GET /statistics/teachers` | Uma linha por professor, com os clubinhos sob responsabilidade |
| `GET /statistics/attendance/club/:clubId` | Linha do tempo de frequência de um clubinho e semanas em falta |
| `GET /statistics/attendance/week` | Situação de todos os clubinhos numa semana |

Os contratos de resposta estão em `src/modules/statistics/dto/`. Desde setembro
de 2026 os onze métodos do controller declaram tipo de retorno explícito, então
uma mudança no service quebra a compilação em vez de trocar o contrato HTTP em
silêncio.

## Situações de um clubinho na semana

`GET /statistics/attendance/week` devolve sete situações possíveis
(`out_of_period` entrou em 2026-11-11):

| Situação | Quando |
|---|---|
| `out_of_period` | o dia do clubinho nessa semana cai fora do período letivo (semana em que o período abre ou fecha) — nada a cobrar |
| `ok` | pagelas ≥ crianças esperadas |
| `partial` | tem pagela, mas menos que o esperado |
| `missing` | data já passou e não há pagela |
| `pending` | a data ainda não chegou |
| `vacation` | a data cai numa exceção de calendário |
| `inactive` | o clubinho não tem criança esperada |

## Regras de 2026-11-11

Revisão das contas depois de uma auditoria. Os nomes dos campos não mudaram; o
que mudou foi o que alguns números significam. O que o front precisa
acompanhar está no fim da seção.

### 1. Presença é sobre quem era esperado

```
presenceRate = pagelas com presença ÷ presenças esperadas × 100   (teto: 100)
```

Antes o denominador eram as pagelas **lançadas**: um clubinho que só lançava
pagela de quem veio tinha 100%, e uma semana sem lançamento sumia da conta.
Agora **criança esperada sem pagela conta como ausente**.

Uma *presença esperada* é um par (criança, dia de clubinho) em que:

- a criança pertence a um clubinho ativo e estava **matriculada naquele dia**
  (regra 2);
- o dia é o dia da semana do clubinho, dentro do período letivo ativo;
- o dia não é exceção de calendário (feriado, recesso; recorrentes inclusive);
- o dia **já chegou** (≤ hoje, no fuso `America/Sao_Paulo`) e está dentro do
  recorte de datas pedido.

Semana fora do período letivo ou no futuro não tem presença esperada — não é
"pagela faltando". Sem período letivo cadastrado no recorte ninguém é esperado:
a taxa é `0` e `expectedPresences` é `0`.

Vale para: `overall.averagePresenceRate` e `byWeek[].presenceRate`
(`/statistics/pagelas`); `byGender`, `byAgeGroup`, `byClub`, `byCity` e
`byParticipationTime` (`/statistics/pagelas/charts`); `stats.presenceRate` e
`summary.avgPresenceRate` (`/statistics/children`), inclusive os filtros
`minPresenceRate`/`maxPresenceRate` e a ordenação por presença;
`performance.presenceRate` (`/statistics/clubs`); `avgPresenceRate` do ranking e
`presenceRate` de `topEngagedChildren` (`/statistics/insights`); as taxas de
pagela e `indicators.clubsWithLowAttendance` do panorama.

**Exceção — recorte por professor.** Com `teacherId` no filtro, e em
`byTeacher` e `/statistics/teachers`, a taxa continua sendo presenças ÷ pagelas
lançadas: quem lança a pagela não define quem devia estar lá, então não existe
"esperado do professor".

`meditationRate`, `verseRecitationRate` e `engagementScore` continuam sobre as
pagelas lançadas.

A regra é a função pura `summarizeExpected`
(`utils/enrollment.utils.ts`), coberta por fixture exata.

### 2. Histórico usa "matriculada na data", não "ativa hoje"

Uma criança estava matriculada numa data quando:

- `joinedAt` é nulo ou ≤ a data; **e**
- está ativa, ou foi desativada naquela data ou depois.

O dia da desativação é `child.deactivatedAt`. Para quem foi desativada antes de
a coluna existir (`deactivatedAt` nulo), vale `DATE(child.updatedAt)`.

Toda agregação **histórica** de pagelas e decisões usa essa regra no lugar do
filtro `child.isActive = true`. Com o filtro antigo, desativar uma criança em
novembro apagava as pagelas e decisões dela de março a outubro.
`getPagelasTimeSeries`, que não tinha filtro nenhum de criança, passou a seguir
a mesma regra das demais.

Os totais de **hoje** continuam usando `isActive`, e "criança" tem uma
definição só — criança ativa em clubinho ativo — em `summary.totalChildren` e
`quickStats.childrenByGender` (panorama), `summary.totalChildren`
(`/statistics/children`) e `children.total` (`/statistics/clubs`).

### 3. Decisões: um escopo, por criança distinta

- **Escopo único** para panorama, `/statistics/accepted-christs`, gráficos,
  ranking e `/statistics/clubs`: clubinho ativo e criança matriculada no dia da
  decisão (`DATE(createdAt)`).
- **Decisão sem tipo** (`decision` nulo, registro legado) fica **fora de todo
  total**: `totalDecisions`, `total`, `thisWeek`/`thisMonth`/`thisYear` e
  `hasDecision` são sempre aceitou + reconciliou. Elas aparecem à parte em
  `overall.unspecifiedDecisions` (`/statistics/accepted-christs`) e continuam
  listadas em `recentDecisions`, com `decision: null`.
- **Contagem por criança distinta dentro de cada tipo.** `ACCEPTED: 9` são nove
  crianças que aceitaram, não nove linhas — um registro duplicado não conta
  duas vezes. `totalDecisions` é a soma dos tipos; uma criança que aceitou e
  reconciliou no recorte conta uma vez em cada.
- `byPeriod[].uniqueChildren` vem de uma consulta própria por período. Antes
  herdava o valor da linha de um dos tipos.
- **Crescimento** (`indicators.growthRate`): as duas janelas comparadas saem da
  mesma consulta. Crianças: matriculadas hoje × matriculadas três meses atrás.
  Decisões: últimos três meses × os três anteriores, sem dia em comum.

### 4. Ativo, médias e indicadores

- **Criança ativa** (`isActive`, `activeChildren`, `activeChildrenThisMonth`,
  `children.active`): teve **presença** registrada na janela, pela data da
  pagela (`referenceDate`) — não pela data do lançamento (`createdAt`), e não
  por ter uma pagela de falta. Professor ativo: lançou pagela na janela, pela
  data da pagela.
- **Médias** só contam quem tem o que medir. Presença: quem tinha presença
  esperada no recorte. Engajamento e eficácia de professor: quem tem pagela.
  Desempenho de clubinho: quem tinha esperado ou pagela. Quem fica de fora não
  entra como 0%.
- `indicators.clubsMissingPagelas` usa a **semana letiva corrente** e a mesma
  análise de `/statistics/attendance/week` (`summary.clubsMissing`): não conta
  clubinho de férias, cujo dia ainda não chegou ou sem criança esperada. Fora
  do período letivo o valor é `0` e `indicators.currentAcademicWeek` é `null` —
  a tela deve mostrar "não se aplica", e não "0 clubinhos em falta".
- `indicators.clubsWithLowAttendance`: clubinhos com presença do mês abaixo de
  70% sobre os esperados; inclui o clubinho esperado que não lançou nada (0%).

### 5. Frequência (`/statistics/attendance/...`)

- **Ano sem período letivo** (`/attendance/club/:clubId`): resposta explícita —
  `period.hasAcademicPeriod: false`, contagens zeradas, `timeline` vazia,
  `alerts` vazio e um `note` explicando. Não há mais alerta crítico de "0%".
- `weeksExpected` (e `period.activeWeeks`) deixa de contar semana **sem criança
  esperada**; as sequências (`consecutiveWeeks*`) também as pulam. O alerta
  `low_attendance` só existe com `weeksExpected > 0`.
- `expectedChildren` de cada semana usa a regra 2 — inclui quem era matriculada
  na época e foi desativada depois.
- Clubinho cujo dia cai fora do período na semana pedida recebe
  `out_of_period`, e não `missing`.
- As datas deixaram de passar por `new Date('YYYY-MM-DD')` (meia-noite UTC):
  no Brasil o dia do clubinho saía um dia antes. `firstDate` e
  `lastPagelaDate` saem sempre como `YYYY-MM-DD`.
- Clubinho inexistente responde `404` com `CLUB_6001` (`CLUB_NOT_FOUND`), no
  envelope padrão.

### 6. Semana letiva corrente

`AcademicWeekService.calculateCurrentAcademicWeek` procura o período que
**contém** hoje (ano corrente e os dois vizinhos), e não o que leva o número do
ano civil — um período que atravessa a virada continua valendo em janeiro.
"Hoje" vem de `todayInAppTimezone()`.

### 7. Outras correções

- Filtro de `city`/`state`/`district` em `/statistics/pagelas` e
  `/statistics/accepted-christs` respondia erro de SQL ("unknown column
  address.city"): as consultas não juntavam o endereço da criança.
- O último dia de `endDate` ficava de fora em `/statistics/children`,
  `/statistics/clubs` e `/statistics/teachers` quando o servidor rodava em fuso
  negativo.

### O que o front precisa acompanhar

| Rota | Mudança |
|---|---|
| `GET /statistics/overview` | **campo novo** `indicators.currentAcademicWeek: { year, week } \| null` |
| `GET /statistics/pagelas` | **campos novos** `overall.expectedPresences` e `byWeek[].expectedPresences` |
| `GET /statistics/accepted-christs` | **campo novo** `overall.unspecifiedDecisions` |
| `GET /statistics/attendance/week` | **valor novo** de `clubs[].status`: `out_of_period` |
| `GET /statistics/attendance/club/:clubId` | **campo novo opcional** `note`; `timeline[].firstDate` é sempre texto `YYYY-MM-DD` |

Nenhum campo foi renomeado ou removido.

### Limites conhecidos destas regras

- O dia esperado é o dia da semana **atual** do clubinho, e a criança conta no
  clubinho **atual** dela: mudança de dia ou de clubinho no meio do ano não é
  reconstituída.
- `byWeek` lista só as semanas que têm ao menos uma pagela; uma semana inteira
  sem lançamento pesa em `overall`, mas não aparece como linha.
- No dia do clubinho a presença já é esperada: até a pagela ser lançada, a taxa
  do dia aparece mais baixa.
- `consecutiveWeeks` conta semanas com pagela, de presença ou de falta.

## Pendências conhecidas

- **Agregação em memória.** Doze consultas carregam a tabela inteira para o
  Node e somam lá — `getMany()` sem teto, distribuídas assim: decisões 3,
  crianças 3, clubinhos e professores 3, pagelas 2, frequência 1. A §11.3 pede
  agregação no banco. Hoje o volume é pequeno; a conta cresce linearmente com a
  base e é o primeiro lugar a olhar quando alguma dessas rotas começar a
  demorar.
- **`newUser` × `isNewUser`.** Fora daqui, mas na mesma família de contratos:
  `POST /auth/google` marca conta nova com `newUser` em três das quatro formas
  de resposta e com `isNewUser` na quarta. Está documentado em
  `src/core/auth/dto/auth-response.dto.ts`; unificar é mudança de contrato e
  precisa sair combinada com o front.
