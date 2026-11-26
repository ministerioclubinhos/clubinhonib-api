# Pendências técnicas — `clubinhonib-api`

Levantamento de 4 de setembro de 2026, com as duas árvores limpas em `main`
(`be951ab`). Cada item traz onde está, por que importa e como resolver.

Marque `[x]` conforme for implementando. As caixas aninhadas existem para os
itens grandes darem progresso parcial.

> As pendências do front ficam no outro repositório, em
> `clubinhonib-app/docs/pendencias-tecnicas.md`.

## Estado dos gates na data do levantamento

| Gate | Resultado |
|---|---|
| `npm run build` | ✅ |
| `npx jest --runInBand` | ✅ 825 / 825, 107 suítes |
| `npx eslint src` | ✅ (era ❌ 6 erros; item 4.2 resolvido) |

## Índice

Uma caixa por item; os passos de cada um ficam na seção correspondente.

- [x] **1.1** `POST /accepted-christs` é rota pública — *crítico, pequeno* ✅ 4 set 2026
- [x] **2.1** Services falam com o banco direto — *alto, grande* ✅ 4 set 2026
- [x] **2.2** Injeções de repositório entre módulos — *alto, médio* ✅ 4 set 2026
- [x] **2.3** Statistics: 4.737 linhas sem teste de fórmula — *alto, grande* ✅ 5 set 2026
- [x] **2.4** Quarenta e um controllers sem tipo de retorno — *alto, médio* ✅ 5 set 2026
- [x] **2.5** Dois controllers devolvem entidade crua — *alto, pequeno* ✅ 5 set 2026
- [ ] **3.1** Módulos sem nenhum teste — 2 restantes de 3 — *médio*
- [ ] **3.2** Papel comparado como texto solto — *médio, pequeno*
- [ ] **3.3** Paginação de clubinhos sem teto — *médio, pequeno*
- [ ] **3.4** Módulos fora do formato de services — 2 restantes de 3 — *médio*
- [ ] **4.1** `any` fora dos testes — 16 restantes de 22 — *baixo*
- [x] **4.2** Seis erros de prettier — *baixo, pequeno* ✅ 4 set 2026

---

## 1. Crítico

### 1.1 `POST /accepted-christs` é rota pública

**Onde**: `src/modules/accepted-christs/controllers/accepted-christ.controller.ts`

```
:6   @Controller('accepted-christs')   ← nenhum @UseGuards
:14  console.log('Creating AcceptedChrist with DTO:', dto);
:13  Promise<AcceptedChristEntity>     ← entidade crua
```

**Por que importa**: qualquer pessoa na internet grava que uma criança aceitou a
Jesus, sem autenticação. O `console.log` imprime o corpo inteiro da requisição —
dado de criança — no log da aplicação, o que a regra de privacidade proíbe
explicitamente. E a resposta devolve a entidade do TypeORM, não um DTO.

**Resolvido em 4 de setembro de 2026.**

- [x] `@UseGuards(JwtAuthGuard)` no controller
- [x] Recorte por clubinho: o caso de uso pede a criança ao
      `GetChildrenService.findEntityForContextOrFail`, que já aplica o filtro de
      papel — professor só alcança a turma dele. Criança fora do alcance
      responde 404 com a mesma mensagem de "não existe", sem contar em que
      clubinho ela está
- [x] `console.log` removido; no lugar, `Logger` com id da decisão, id da
      criança e id de quem registrou — nunca a decisão nem a observação
- [x] `AcceptedChristResponseDto` + `mappers.ts`; a criança sai só pelo id
- [x] Testes: 14 novos no módulo, cobrindo papel, escopo, ausência de gravação
      quando o acesso falha e o conjunto de campos da resposta

**Passou junto** (fechou parte de outros itens):

- [x] Fim da injeção do `Repository<ChildEntity>` no service — era uma das 11
      injeções entre módulos do item 2.2
- [x] Service dividido por operação: `services/create-accepted-christ.service.ts`
      — fecha a linha de `accepted-christs` no item 3.4
- [x] `notes` ganhou `@IsString` e `@MaxLength(500)`; sem isso, texto maior que
      a coluna derrubava a gravação com erro interno
- [x] `toAcceptedChristShort` passou a ser o único lugar que monta o recorte
      curto — o mapper de crianças tinha uma cópia
- [x] **Rede contra a próxima**: `src/app.module.spec.ts` agora falha se um
      controller nascer sem `@UseGuards`, com uma lista explícita dos públicos
      deliberados e o motivo de cada um

---

## 2. Alto

### 2.1 Vinte e sete services falam com o banco direto — resolvido em 4 set 2026

**Por que importa**: `CLAUDE.md` e `docs/CLUBINHO_BACKEND_BEST_PRACTICES.md` §4.2
tratam isto como obrigatório — *"services MUST NEVER manipulate the database
directly"*. Com a consulta dentro do caso de uso não dá para testar a regra sem
subir o TypeORM, e a mesma consulta acaba reescrita em cada operação.

**Como resolver**: para cada módulo, criar `repositories/<feature>.repository.ts`
e mover o `DataSource`/`Repository<>` para lá, deixando o service com a
orquestração. O módulo de `children` e o de `clubs` já estão nesse formato e
servem de referência. Os que usam `DataSource.transaction` mantêm a transação no
repositório, recebendo o `EntityManager`.

- [x] `modules/meditations` — 3 services (`create`, `update`, `delete`) · `DataSource`
- [x] `modules/documents` — 2 services (`create`, `update`) · `DataSource`
- [x] `modules/informatives` — 2 services (`create`, `update`) · `DataSource`
- [x] `modules/pages/ideas-page` — 3 services · `DataSource`
- [x] `modules/pages/ideas-section` — 4 services (`attach`, `create`, `update`, `delete`) · `DataSource`
- [x] `modules/pages/image-page` — 3 services · `DataSource`
- [x] `modules/pages/image-section` — 3 services · `DataSource`
- [x] `modules/pages/video-page` — 3 services · `DataSource`
- [x] `modules/pages/week-material-page` — 3 services · `DataSource`
- [x] `modules/accepted-christs` — resolvido no item 1.1
- [x] `modules/club-control/services/academic-week.service.ts` · `InjectRepository`

**Esforço**: grande. Vale fatiar por módulo — cada um é uma entrega fechada.

**O que ficou**: cada repositório ganhou `runInTransaction(work)`, que abre e
fecha a transação e entrega o `EntityManager` ao caso de uso; o service decide o
que é atômico e não conhece mais `QueryRunner`, commit nem rollback. As escritas
viraram métodos `…InTransaction(manager, …)` no repositório. O módulo de mídia
ganhou as mesmas variantes (`findMediaItemsByTargetInTransaction`,
`saveMediaItemInTransaction`, `deleteMediaItemByIdInTransaction`,
`deleteMediaItemsByTargetInTransaction`) para quem grava mídia dentro da
transação de outro agregado, e `findMediaItemById` para quem só precisa
consultar. `ideas-section-media.service.ts`, que era o colaborador que carregava
o `QueryRunner` para dentro de quatro casos de uso, passou a receber
`EntityManager`.

Duas garantias que a conversão precisava preservar e que agora estão cobertas
por teste: o aviso aos administradores sai **depois** do commit, e os arquivos
só saem do bucket **depois** que o banco confirma a remoção.

`image-section` e `ideas-section` não tinham nenhum teste de service — ganharam
sete suítes novas (27 casos) junto com a conversão. Verificação:
`npm run build` ✅, `npx jest` ✅ 750/750 em 101 suítes, `npx eslint src` ✅.

---

### 2.2 Dez injeções de repositório entre módulos — resolvido em 4 set 2026

**Por que importa**: §4.2 — *"A service in module A MUST NEVER inject or call a
repository from module B; cross-module interaction MUST ALWAYS consume module
B's service contract."* Hoje um módulo alcança a persistência do outro por
dentro: mudar o repositório de um quebra o outro sem aviso de compilação.

| Origem | Alcança |
|---|---|
| `core/auth/services/auth.service.ts` | `core/user/user.repository` |
| `core/profile/services/profile/create-profile.service.ts` | `core/user/user.repository`, `shared/media/media-item-repository` |
| `core/profile/services/profile/get-all-profiles.service.ts` | `shared/media/media-item-repository` |
| `core/profile/services/profile/get-one-profile.service.ts` | `core/user/user.repository`, `shared/media/media-item-repository` |
| `core/profile/services/profile/update-profile.service.ts` | `core/user/user.repository`, `shared/media/media-item-repository` |
| `core/user/services/get-user.service.ts` | `core/profile/personal-data.repository`, `core/profile/user-preferences.repository` |
| `shared/providers/notification/notification.service.ts` | `core/user/user.repository` |

**Como resolver**: já existe precedente nesta sessão — `auth.service` deixou de
injetar `TeacherProfilesRepository` e passou a consumir
`UpdateTeacherProfilesService.linkOwnClubByNumber`. Repetir o padrão: expor no
módulo dono um método de serviço com o contrato que o consumidor precisa.

- [x] `auth` → consumir `GetUsersService` em vez de `UserRepository`
- [x] `profile` → um serviço de leitura de usuário no módulo `user`
- [x] `profile` → um serviço de mídia no módulo `media` (hoje o repositório é
      injetado direto em 4 services)
- [x] `user` → um serviço no módulo `profile` para dados pessoais e preferências
- [x] `notification` → consumir `GetUsersService`

**Cuidado**: `core/user` e `core/profile` se consomem nos dois sentidos. Resolver
com `forwardRef` nos dois lados, e conferir com `src/app.module.spec.ts`, que já
tem um teste que derruba a build se um import ficar `undefined`.

**Esforço**: médio.

**O que ficou**

- `auth` grava o refresh token por `UpdateUserService.updateRefreshToken`.
- `notification` lê administradores e autor por `GetUsersService`
  (`findAdminEmails`, `findByEmail`).
- Os quatro services de `profile` trocaram `MediaItemRepository` por
  `MediaItemProcessor`, que é o contrato que o módulo de mídia já exportava.
- Os cinco services de `profile` que buscavam o usuário passaram a usar
  `GetUsersService.findOne`, que lança exatamente o mesmo
  `USER_NOT_FOUND`/"Usuário não encontrado" que a checagem local fazia à mão.
- `user` lê os blocos de perfil por `GetProfileBlocksService.findByUserId`.
  Esse serviço nasceu separado de `GetOneProfileService` de propósito: como
  `GetOneProfileService` consome o `user` de volta, mantê-los no mesmo arquivo
  criaria um ciclo **entre arquivos**, em que uma das classes chega `undefined`
  na hora de resolver a injeção. Separado, o ciclo fica só entre os módulos e
  `forwardRef` nos dois `imports` resolve.
- Três módulos redeclaravam provider de outro como se fosse seu — o que cria uma
  segunda instância que diverge em silêncio: `image-section` (`ImagePageRepository`),
  `documents` e `informatives` (`RouteService` + `RouteRepository`). Todos passaram
  a importar o módulo dono. `image-section` também deixou de injetar
  `ImagePageRepository`: agora consome `ImagePageGetService.findEntity`.

**Dois bugs de boot encontrados no caminho** — regressões do item 2.1 que nenhum
gate pegava, porque teste unitário troca todo colaborador por mock e nunca sobe
o grafo de injeção:

1. `AcademicWeekService` passou a injetar `ClubControlRepository`, mas o
   repositório importa esse serviço de volta. Sem `forwardRef` no construtor, a
   classe chega `undefined` e **a aplicação não subia**.
2. `StatisticsModule` redeclarava `AcademicWeekService` sem as dependências que
   ele passou a ter. Agora importa `ClubControlModule`.

Para isso não voltar, `src/app.module.di.spec.ts` sobe o `AppModule` inteiro em
modo *preview* do Nest: o container monta e resolve as dependências de todos os
providers sem instanciar nenhum, então nada conecta em banco, S3 ou SMTP, e
mesmo assim um `forwardRef` faltando ou um provider redeclarado reprova o teste.
Conferido que ele morde: removendo o `forwardRef` de um lado do ciclo
`user`↔`profile`, o teste falha com a mensagem do Nest.

---

### 2.3 Statistics: 4.737 linhas sem um teste de fórmula — resolvido em 5 set 2026

**Onde**:

```
src/modules/statistics/statistics.repository.ts   3456 linhas, 5 any
src/modules/statistics/statistics.service.ts      1281 linhas
src/modules/statistics/*.spec.ts                     0 arquivos
```

**Por que importa**: §11.3 exige que cada métrica declare numerador,
denominador, status incluídos, campo de data, fuso e recorte de papel — e que
qualquer mudança de fórmula venha com teste de fixture exata. Hoje não há
nenhum: uma conta errada só aparece quando alguém desconfia do número na tela.

**Como resolver**:

- [x] Mapear as métricas expostas por `statistics.controller.ts` (11 rotas) e
      escrever, para cada uma, o que ela conta — vira o cabeçalho de
      `docs/api-statistics.md`
- [x] Extrair as funções puras de cálculo do service para `utils/` e cobrir com
      fixture exata (esta é a parte que dá mais retorno por hora)
- [x] Quebrar `statistics.repository.ts` por assunto (crianças, pagelas,
      decisões, clubinhos) — hoje é um arquivo só
- [x] Trocar os 5 `any` por tipos de linha das consultas raw
- [x] Conferir os limites: §11.3 pede agregação no banco, não carregar registro
      sem fronteira para o Node

**Esforço**: grande. Comece pelas funções puras.

**O que ficou**

- `utils/metrics.utils.ts` reúne as fórmulas, cada uma declarando numerador,
  denominador e o que vale quando o denominador é zero.
  `utils/metrics.utils.spec.ts` cobre todas com fixture exata — 50 casos,
  incluindo as bordas de cada faixa e os denominadores zerados. O service e os
  repositórios passaram a chamar essas funções em vez de reescrever a conta: a
  taxa de presença aparecia quatro vezes escrita à mão, o arredondamento
  quinze.
- `StatisticsCalculationsService` deixou de existir. Eram quatro funções puras
  passando pelo Nest sem motivo; viraram funções em `utils`.
- `statistics.repository.ts` (3.456 linhas, sete assuntos) virou seis
  repositórios por assunto em `repositories/`, o maior com 797 linhas. A classe
  original ficou vazia e foi removida.
- Os cinco `any` viraram tipos reais. Foi o que expôs as divergências abaixo.
- `docs/api-statistics.md` documenta as onze rotas, as fórmulas, a regra de
  fuso e as seis situações de clubinho na semana.

**Um bug de fuso, achado pela fixture**

`calculateAge` e `calculateMonthsParticipating` liam a data com
`new Date('2016-09-06')`, que é meia-noite **UTC**. Num processo em fuso
negativo — o Brasil inteiro — isso vira o dia 5 local: **toda criança ficava um
ano mais velha na véspera do aniversário**, e quem entrou no dia 1º de um mês
ganhava um mês a mais de participação. As funções passaram a usar
`parseDateOnly`, e há teste travando os dois casos.

**Três contratos que já divergiam do que a rota devolvia**

Estavam escondidos atrás do `any` — nada conferia:

1. `analyzeClubAttendance` devolve `timelinePagination`, `missingWeeksPagination`,
   `period.exceptionsCount` e `period.hasAcademicPeriod`, nenhum deles no DTO.
2. Os alertas de frequência emitem `low_attendance` e `info`, que não constavam
   na união declarada.
3. `attendance/week` devolve seis situações de clubinho; o DTO declarava
   quatro. `pending` e `partial` chegavam à tela sem nunca terem sido
   declarados.

Os DTOs foram corrigidos para descrever a realidade — mudar o que a rota
devolve quebraria o front, que já consome esses campos.

**O que foi conferido e não resolvido**

Doze consultas ainda agregam em memória (`getMany()` sem teto). Está
quantificado e localizado em `docs/api-statistics.md`; a reescrita para
agregação no banco é trabalho próprio, não cabia junto da cobertura.

---

### 2.4 Quarenta e um métodos de controller sem tipo de retorno — resolvido em 5 set 2026

**Por que importa**: §4.1 — *"Every public controller method MUST declare an
explicit return type."* Sem ele o tipo vem inferido do service, e uma mudança lá
troca o contrato HTTP em silêncio: sem erro de compilação e sem teste quebrando.

- [x] `core/auth/auth.controller.ts` — 15 métodos (`login`, `googleLogin`,
      `refresh`, `logout`, `getMe`, `completeRegister`, `register`,
      `forgotPassword`, `verifyEmail`, `resendVerification`,
      `validateResetToken`, `resetPassword`, `linkClub`)
- [x] `modules/club-control/controllers/club-control.controller.ts` — 15 métodos
- [x] `modules/statistics/statistics.controller.ts` — 11 métodos
- [x] `src/app.controller.ts` — `getHello`, `getHealth`

Em vários casos o DTO de resposta ainda não existe e precisa ser criado junto.

**Esforço**: médio.

**O que ficou**

Nenhum método de controller no projeto fica sem tipo de retorno declarado. Os
DTOs que faltavam foram criados junto:

- `src/core/auth/dto/auth-response.dto.ts` — os onze contratos de `/auth`.
- `src/modules/club-control/dto/club-control-contracts.dto.ts` +
  `mappers.ts` — período letivo e exceção de calendário saíam como entidade
  crua; agora passam por mapper.
- `src/dto/health-response.dto.ts` — a sonda de saúde.

Tipar o `auth` expôs duas coisas: `buildMeResponse` estava morto desde que
`/auth/me` passou a delegar (64 linhas removidas), e `POST /auth/google`
devolve quatro formas diferentes que marcam conta nova com `newUser` em três
delas e `isNewUser` na quarta. A inconsistência está documentada no DTO;
unificar é mudança de contrato e precisa sair combinada com o front.

---

### 2.5 Dois controllers devolvem entidade crua — resolvido em 5 set 2026

**Onde**: `modules/routes/route.controller.ts` (2 métodos),
`modules/accepted-christs/controllers/accepted-christ.controller.ts` (1 — já
coberto pelo item 1.1).

**Por que importa**: §4.1 — a entidade carrega colunas internas e ciclos de
relação que o contrato público não deve expor. Foi exatamente assim que
`/users` vazava hash de senha e refresh token antes da correção de setembro.

- [x] `RouteResponseDto` + mapper, e o controller devolvendo o DTO
- [x] Teste travando o conjunto de campos da resposta

**Esforço**: pequeno.

**O que ficou**: `/routes` é pública — o site monta o mapa de navegação antes de
qualquer login — então o teste de `mappers.spec.ts` trava a lista exata de
campos da resposta. Uma coluna nova na entidade passa a reprovar o teste em vez
de vazar sozinha.

---

## 3. Médio

### 3.1 Dois módulos sem nenhum teste

- [ ] `modules/club-control/` — decide o que é semana letiva e o que conta como
      falta; é a regra mais delicada do sistema e não tem rede nenhuma
- [x] `modules/accepted-christs/` — 14 testes, resolvido no item 1.1
- [ ] `modules/addresses/`

**Esforço**: médio (`club-control` sozinho é meio dia).

---

### 3.2 Papel comparado como texto solto

**Por que importa**: o enum `UserRole` existe; comparar com string abre espaço
para erro de digitação virar permissão liberada, e o `eslint` não acusa.

- [ ] `modules/clubs/utils.ts:62` — `'coordinator'`
- [ ] `modules/clubs/services/create-clubs.service.ts:31`
- [ ] `modules/clubs/services/update-clubs.service.ts:38` e `:85`
- [ ] `modules/clubs/services/delete-clubs.service.ts:24`
- [ ] `modules/teacher-profiles/repositories/teacher-profiles.repository.ts:473` — `'admin'`
- [ ] `modules/teacher-profiles/repositories/teacher-profiles.repository.ts:480` — `'coordinator'`

`normalizedRole()` devolve `string`; tipá-lo como `UserRole | undefined` resolve
a raiz e faz o compilador achar o resto.

**Esforço**: pequeno.

---

### 3.3 Paginação de clubinhos sem teto

**Onde**: `src/modules/clubs/dto/query-clubs.dto.ts`

É o único DTO de listagem sem `@Max` no `limit` — dá para pedir a tabela inteira
numa requisição. §11.2 pede máximo limitado em toda paginação.

- [ ] Adicionar `CLUBS_MAX_LIMIT` em `modules/clubs/constants.ts` e `@Max(...)` no DTO
- [ ] Aplicar o mesmo teto no repositório, como fazem `users` e `children`

**Esforço**: pequeno.

---

### 3.4 Módulos fora do formato de services

Serviços devem ser divididos por operação em arquivos separados
(`create-`, `get-`, `update-`, `delete-`).

- [x] `modules/accepted-christs/` — resolvido no item 1.1
- [ ] `modules/addresses/` — sem pasta `services/`
- [ ] `modules/routes/` — sem pasta `services/`

**Esforço**: médio.

---

## 4. Baixo

### 4.1 Vinte e dois `any` fora dos testes

- [ ] `modules/club-control/dto/detailed-indicators-result.dto.ts` — 11
- [ ] `modules/statistics/statistics.repository.ts` — 5 (ver item 2.3)
- [ ] `modules/club-control/services/club-control.service.ts` — 1
- [ ] `modules/club-control/repositories/club-control.repository.ts` — 1
- [ ] `modules/club-control/dto/club-check-result.dto.ts` — 1
- [ ] `core/auth/services/auth.service.ts` — 1
- [ ] `shared/providers/aws/aws-s3.service.ts` — 1
- [ ] `shared/media/media-item-processor.ts` — 1

---

### 4.2 Seis erros de prettier — resolvido em 4 set 2026

**Onde**: `src/modules/pagelas/repositories/pagelas.repository.ts`, linhas 76–78
e 210–212. Pré-existentes, todos no mesmo arquivo, todos com correção
automática.

- [x] `npx eslint --fix src/modules/pagelas/repositories/pagelas.repository.ts`

---

## Operacional em aberto

Não é dívida de código, mas está pendente desde a entrega do descadastro por
e-mail:

- [ ] Definir `EMAIL_UNSUBSCRIBE_SECRET` em staging e produção — sem ela cai no
      `JWT_SECRET`, e trocar o JWT invalidaria os links já enviados
- [ ] Rodar a migration `AddUserNoticesUnsubscribedAt1788487683714` fora do
      ambiente local (só foi aplicada no banco de desenvolvimento)
- [ ] Avisar a equipe que `DB_SYNCHRONIZE` agora nasce `false`: entidade nova
      exige migration gerada pelo CLI, conforme
      [`AI_DATABASE_CHANGE_REQUIREMENTS.md`](../AI_DATABASE_CHANGE_REQUIREMENTS.md)
- [ ] Acompanhar o volume de envio: os avisos passaram a sair um por
      destinatário, e o SMTP do Gmail limita 500/dia em conta comum e 2000 no
      Workspace
