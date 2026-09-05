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
| `presenceRate` | pagelas com presença | pagelas da criança (ou do clubinho) no recorte |
| `meditationRate` | pagelas com meditação | idem |
| `verseRecitationRate` | pagelas com versículo recitado | idem |

Denominador zero devolve `0`, e não `NaN`: quem nunca registrou pagela aparece
com 0%, que é o que a tela deve mostrar.

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

- `activityRate` = crianças ativas ÷ crianças do clubinho
- `decisionRate` = crianças com decisão ÷ crianças ativas

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

`GET /statistics/attendance/week` devolve seis situações possíveis:

| Situação | Quando |
|---|---|
| `ok` | pagelas ≥ crianças esperadas |
| `partial` | tem pagela, mas menos que o esperado |
| `missing` | data já passou e não há pagela |
| `pending` | a data ainda não chegou |
| `vacation` | a data cai numa exceção de calendário |
| `inactive` | o clubinho não tem criança esperada |

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
