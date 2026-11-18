# Observabilidade e Auditoria

Como a API registra **erros técnicos** (observabilidade) e **ações**
(auditoria), onde isso é persistido, o que nunca entra nos registros e como o
administrador consulta.

Plano de origem:
[`implementation-plan/observability-audit-implementation-plan.md`](implementation-plan/observability-audit-implementation-plan.md).
As decisões D-001 a D-022 adotadas pela implementação estão na seção 21 dele.

## 1. Visão geral

```text
Request
  -> RequestContextMiddleware      requestId (UUID do servidor) + AsyncLocalStorage
  -> AutomaticActionContextGuard   módulo/controller/handler/rota/resourceId (APP_GUARD)
  -> guards de autenticação        request.user
  -> AuditInterceptor              sucesso -> WriteAuditEventService (APP_INTERCEPTOR)
  -> controller -> service -> repository/provider
  -> GlobalExceptionFilter         falha -> auditoria + Logger.error (APP_FILTER)

Logger (todo `new Logger(...)` da aplicação)
  -> StructuredLoggerService       imprime como sempre e, para error/fatal,
  -> WriteTechnicalLogService      monta o registro, redige e enfileira
  -> ObservabilityStoragePort      file | dynamodb

JobRunnerService -> ActionBoundaryService  contexto próprio + auditoria do job
process.on(unhandledRejection|uncaughtException) -> WriteTechnicalLogService
bootstrap().catch -> writeBootstrapFailure (sem DI: JSONL local + stderr)
```

Nenhum controller, service ou repository chama auditoria ou storage. A
cobertura é do boundary: módulo novo entra pelo container e o teste
arquitetural (`components.registry.architecture.spec.ts`) confere que todo
controller do código está no grafo descoberto.

### Módulos

| Módulo | Pasta | Papel |
| --- | --- | --- |
| `RequestContextModule` | `src/core/request-context` | contexto por execução, middleware, `ComponentsRegistry` (mapa classe → módulo) |
| `LogStorageModule` | `src/shared/providers/log-storage` | configuração validada, fila de entrega, providers `file` e `dynamodb`, portas |
| `ObservabilityModule` | `src/core/observability` | logger estruturado, escrita técnica, listeners de processo, writer de bootstrap |
| `AuditModule` | `src/core/audit` | guard, interceptor, filtro global (`APP_FILTER`), dedup, boundary de jobs |
| `LogRecordsModule` | `src/core/log-records` | API somente leitura para administradores |

## 2. Configuração

| Variável | Padrão | Regra |
| --- | --- | --- |
| `OBS_STORAGE` | `file` | `file` ou `dynamodb` |
| `OBS_LOCAL_DIR` | `logs` | pasta relativa à raiz do processo; caminho que escapa da raiz é recusado |
| `OBS_TTL_DAYS` | `1` | inteiro 1..3650 |
| `AUDIT_STORAGE` | `file` | `file` ou `dynamodb` |
| `AUDIT_LOCAL_DIR` | `audit` | idem; precisa ser diferente de `OBS_LOCAL_DIR` |
| `AUDIT_TTL_DAYS` | `1` | inteiro 1..3650 |
| `AUDIT_DEDUP_SECONDS` | `60` | inteiro 0..86400; `0` desliga |
| `LOG_DYNAMODB_TABLE_NAME` | — | obrigatória quando algum fluxo é `dynamodb` |
| `LOG_DYNAMODB_ENDPOINT` | — | só para DynamoDB Local |
| `AWS_REGION` | — | obrigatória quando algum fluxo é `dynamodb` |

Regras de boot (`parseLogStorageConfig`):

- variável ausente recebe o padrão; presente e inválida derruba a subida com
  mensagem sem segredo;
- `file` **explícito** com `ENVIRONMENT` em `staging`, `prod` ou `production`
  é recusado (o container não tem volume). Sem as variáveis, o padrão `file`
  ainda vale para não derrubar um deploy que não as recebeu; isso está
  registrado como risco em D-021;
- os fluxos são independentes: `file`/`dynamodb` em qualquer combinação.

## 3. Contratos dos registros

### 3.1 Campos comuns (`LogRecordBase`, `schemaVersion = "1"`)

| Campo | Tipo | Observação |
| --- | --- | --- |
| `eventId` | UUID | gerado no servidor |
| `recordType` | `observability` \| `audit` \| `audit_repeat` \| `audit_dedup` | os dois últimos são internos e não saem na API |
| `environment`, `service` | string | `ENVIRONMENT` e `clubinhonib-api` |
| `occurredAt` | ISO-8601 UTC | relógio injetável |
| `expiresAtEpochSeconds` | inteiro | `occurredAt + TTL` do fluxo; atributo TTL no DynamoDB |
| `requestId` | UUID \| null | nulo em bootstrap e processo; jobs recebem um id de execução |
| `sourceType` | `http` \| `job` \| `provider` \| `process` \| `bootstrap` | |
| `actorType` | `user` \| `anonymous` \| `system` | |
| `actorId`, `actorRole` | UUID \| null, `UserRole` \| null | apenas identidade validada pelo Passport ou anunciada pelo login/cadastro |

### 3.2 Registro técnico (`ObservabilityRecord`)

`level` (`error`/`fatal`, e `warn` para respostas 4xx; ver 5.1), `occurrenceCount`
(1 no registro normal; N no resumo de repetições), `context` (classe do logger),
`moduleName` (pelo registry; `unknown-module` fora do grafo), `operation`,
`message`, `errorName`, `errorCode` (catálogo `ErrorCode`; `INT_9001` para
erro desconhecido), `errorMessage`, `stack` (sanitizada, caminhos relativos,
20 frames), `sourceFile`/`sourceLine`/`sourceColumn` (primeiro frame fora de
`node_modules`), `errorFingerprint`, `httpMethod`, `routeTemplate`,
`statusCode`, `durationMs`, `providerName`, `jobName`, `metadata` (só chaves
allowlisted).

### 3.3 Evento de auditoria (`AuditRecord`)

`actorName` (nome de exibição de quem agiu) e `actorNameSearch` (o mesmo nome
em minúsculas e sem acento, só para o filtro; não sai na API),
`actionType` (`http_request`/`scheduled_job`/`system_operation`), `actionName`
(`<Module>.<Controller>.<handler>` gerado; `http.unmatched.<METHOD> <rota>`
para 404 sem handler), `moduleName`, `controllerName`, `handlerName`,
`resourceType` (primeiro segmento da rota), `resourceId` (só params
allowlisted ou `id` do resultado em `POST`), `outcome`
(`succeeded`/`failed`/`denied`/`rejected`/`not_found`), `httpMethod`,
`routeTemplate`, `statusCode`, `durationMs`, `errorCode`, `dedupFingerprint`,
`occurrenceCount`, `jobName`.

Um `audit_repeat` carrega os campos comuns mais `repeatsEventId`,
`repeatsOccurredAt`, `dedupFingerprint`, `actionName` e `outcome`.

### 3.4 O que nunca é gravado

Body, response, DTO, entidade ou `Error` brutos; authorization, cookies,
senhas, tokens (Bearer e JWT são substituídos no texto), códigos de
recuperação/verificação, e-mail, CPF, telefone, nomes (com a exceção abaixo),
notas, conteúdo e nome
original de upload, query string de URL, caminho absoluto da máquina, IP e
User-Agent. Denylist e limites em `src/core/observability/constants.ts`;
testes em `redaction.utils.spec.ts` e no `audit.integration.spec.ts`.

**Exceção (decisão do solicitante, 2026-11-11):** o evento de auditoria grava o
nome de exibição do usuário que agiu (`actorName`, até 120 caracteres), para o
administrador saber quem é sem procurar o UUID. O nome vem do token (campo
`name`, incluído no login/refresh) ou do próprio caso de uso de login; tokens
emitidos antes disso geram eventos com `actorName` nulo até a próxima
renovação. O registro técnico (observabilidade) continua sem nome.

## 4. Storage

### 4.1 `file`

Só grava: os arquivos existem para análise fora da aplicação (grep, jq,
planilha). Com `file`, `GET`/`DELETE /log-records/*` respondem
`409 LOG_9101` e a tela de observabilidade mostra esse aviso em vez de listar.

- JSONL (`.jsonl`): um objeto por linha, arquivo `YYYY-MM-DD.<pid>.jsonl`
  por dia UTC e por processo; pasta `0700`, arquivo `0600`, sempre `append`;
- retenção no boot e a cada hora: apaga só arquivos no padrão do provider com
  dia anterior a `hoje − TTL`; nunca remove a pasta;
- linha corrompida (crash no meio) é pulada com sinal em stderr;
- desduplicação em memória, por processo;
- consulta lê os arquivos do intervalo, ordena e recorta a página pedida.

### 4.2 `dynamodb` (tabela única)

```text
pk     = STREAM#<recordType>#DAY#<yyyy-mm-dd>      sk     = <occurredAt>#<eventId>
gsi1pk = REQUEST#<requestId>  (esparso)            gsi1sk = <occurredAt>#<recordType>#<eventId>
dedup  : pk = DEDUP#<fingerprint>, sk = DEDUP, windowEndsAtEpochMs, firstEventId, firstOccurredAt
TTL    : expiresAtEpochSeconds
```

- `PutItem` com `attribute_not_exists(pk)`; condição violada em retry é
  sucesso (o item já entrou);
- repetição: `UpdateItem ADD occurrenceCount SET lastOccurredAt` no primeiro
  evento; se ele não existir, a repetição vira item próprio;
- dedup: `PutItem` condicional (`attribute_not_exists OR windowEndsAtEpochMs <
  :now`); falha de condição lê o marcador; indisponibilidade **falha aberta**
  (o evento é gravado);
- consulta: cada dia UTC do intervalo é uma partição (ou uma só, no GSI por
  `requestId`). Primeiro `Query` com `Select: COUNT` em cada partição (já com
  `FilterExpression` para TTL e filtros) para obter o `total`; depois lê só as
  partições que contêm a página pedida, pulando o offset. O custo cresce com o
  offset, aceitável para uma consulta administrativa limitada a 31 dias;
- cliente único (`DynamoDBDocumentClient`), 3 tentativas do SDK, timeout de
  3 s, credenciais da cadeia padrão.

Infraestrutura (tabela, GSI `gsi1-request`, TTL, IAM `PutItem`/`UpdateItem`/
`GetItem`/`Query` no ARN da tabela e do índice) **não foi provisionada** nesta
entrega; ver D-021/D-022 no plano.

### 4.2.1 DynamoDB Local no desenvolvimento

`env/local.env` e `env/dev.env` usam `dynamodb` com
`LOG_DYNAMODB_ENDPOINT=http://localhost:8000`. O `run.sh` da pasta pai sobe
(ou reaproveita) o container Docker `clubinho-dynamodb-local`
(`amazon/dynamodb-local`, dados em `.dynamodb-local/`) e roda
`npm run dynamodb:local:ensure-table`, que cria a tabela, o índice
`gsi1-request` e o TTL quando não existem e não toca no que já existe. A API
repete a mesma verificação no boot (`DynamoDbLocalTableProvisioner`) — apenas
quando há endpoint configurado; em staging/produção a tabela vem da
infraestrutura e a aplicação não tem `CreateTable`.

### 4.3 Entrega (D-006: best effort)

`LogDeliveryQueue` por fluxo: fila limitada (1000), escrita sequencial,
timeout 3 s, uma nova tentativa em erro transitório, descarte contado com
sinal em stderr quando a fila enche, drenagem com limite de 5 s no shutdown. A
request nunca espera o storage nem falha por causa dele. Falha do próprio
storage sai por `emergencyWrite` (stderr), nunca pelo `Logger` — isso evita
recursão.

## 5. Auditoria

- **só mutações**: `POST`, `PUT`, `PATCH` e `DELETE` geram evento; `GET`,
  `HEAD` e `OPTIONS` não (decisão do solicitante em 2026-09-05). Erros de
  leitura continuam no fluxo técnico;
- **uma ação lógica por request**: interceptor grava o sucesso; o filtro
  grava a falha; a flag `auditWritten` no contexto impede as duas;
- **tentativas também**: 401/403 → `denied`, 400/409/422 → `rejected`, 404 →
  `not_found`, 5xx → `failed`;
- **ator**: `request.user` (Passport) após os guards; `AuthService` anuncia
  o UUID no login, Google, refresh, cadastro e complemento de cadastro. Nunca
  se confia em `userId` de body/query/param;
- **404 sem handler** recebe `http.unmatched.<METHOD> <rota sanitizada>`
  (UUIDs e números viram `:id`, query string cai);
- **preflight `OPTIONS`** é respondido pelo CORS antes do roteador e não é
  auditado (D-019);
- **jobs**: `JobRunnerService` executa dentro de `ActionBoundaryService`;
  `completed` → `succeeded`, `failed` → `failed`, dispensado → sem evento;
- **dedup (D-004, agregação)**: o primeiro evento de um fingerprint
  (ator, ação, recurso, resultado, status, método, rota, código) abre a
  janela; os iguais dentro dela viram `audit_repeat` apontando para ele.
  Nenhuma ação deixa de ser registrada.

### 5.1 Filtro de ruído (gravação)

O que é erro vai para a observabilidade; o que é ação vai para a auditoria. O
filtro decide, na gravação, o que não vale uma linha. As regras ficam em
`src/core/observability/constants.ts` e `src/core/audit/constants.ts`.

Observabilidade:

- todo `Logger.error`/`fatal`, exceção 5xx, falha de job, de integração e de
  processo entra como `error`/`fatal`;
- toda resposta 4xx entra como `warn` (qualquer método, inclusive `GET`),
  **menos** `401` (token ausente/expirado, senha errada) e `404` sem handler
  (varredura de rota inexistente);
- eco: se um serviço já registrou o erro da request, o registro genérico do
  `GlobalExceptionFilter` para a mesma request não é gravado;
- repetição: o primeiro registro de uma assinatura (nível, contexto, código,
  fingerprint, rota, job e a mensagem sem ids/números) é gravado na hora; os
  iguais nos 60 s seguintes são contados em memória e viram **um** resumo com
  `occurrenceCount = N` e a mensagem prefixada por `[repetido Nx em 60s]`. O
  resumo sai quando a janela fecha ou no encerramento. `fatal` nunca é
  agregado. A contagem é por processo.

Auditoria (só o **sucesso** é silenciado; falha, negação e rejeição das mesmas
ações continuam gravadas):

- leituras (`GET`) não são ações;
- `scheduler-heartbeat` (batimento do agendador);
- `AuthController.refresh` (renovação automática de token);
- `FeedPhotoCommentsController.readNotification` (marcar notificação como lida).

## 6. API de consulta

`GET /log-records/observability` e `GET /log-records/audit` — `JwtAuthGuard` +
`AdminRoleGuard` (`401` sem token, `403` para qualquer papel que não seja
`admin`). Com storage `file`, todas as rotas respondem `409 LOG_9101`.

Exclusão (a pedido do solicitante em 2026-09-05, revendo a decisão inicial):

- `DELETE /log-records/observability/:eventId?occurredAt=<ISO>` e
  `DELETE /log-records/audit/:eventId?occurredAt=<ISO>` — apagam um item;
  `404 RES_5001` se não existir. `occurredAt` faz parte da chave física.
- `DELETE /log-records/observability?from&to` e
  `DELETE /log-records/audit?from&to` — apagam o intervalo (mesmas regras de
  `from`/`to`, até 31 dias); na auditoria levam junto as repetições
  (`audit_repeat`). Resposta `{ "deleted": n }`.

A própria chamada `DELETE` é auditada pelo interceptor, então apagar deixa
rastro: quem, quando, qual `eventId` (`resourceId`) ou qual intervalo (rota).
No DynamoDB a policy da aplicação passa a precisar de `DeleteItem` e
`BatchWriteItem`.

Query comum: `from` e `to` (ISO-8601, obrigatórios, `from < to`, máximo de
31 dias, senão `422 VAL_4005`), `page` (≥ 1, padrão 1), `limit` (1..100,
padrão 25), `requestId` (UUID).

Filtros específicos: observabilidade `level`, `errorCode` (código do catálogo
ou do driver, `^[A-Z][A-Z0-9_]*$`), `sourceType`; auditoria `actorId`,
`actorName` (trecho do nome, 2 a 120 caracteres, sem diferenciar maiúsculas ou
acentos), `actorRole`, `outcome`, `actionName` (trecho, diferencia maiúsculas),
`sourceType`. Os dois filtros por trecho usam `contains` no DynamoDB.
Campo fora da allowlist é recusado pelo `ValidationPipe` (`400`).

Resposta:

```json
{ "data": [ { "eventId": "...", "occurredAt": "...", "...": "..." } ], "total": 240, "page": 1, "limit": 25, "pageCount": 10 }
```

É o mesmo envelope `Paginated<T>` das demais listagens da API. Ordenação:
`occurredAt` decrescente. Os DTOs
(`ObservabilityRecordResponseDto`, `AuditRecordResponseDto`) são montados
campo a campo; `stack`, `metadata`, `dedupFingerprint` e
`expiresAtEpochSeconds` não saem. A própria consulta é auditada como qualquer
`GET`; não há recursão porque gravar auditoria não consulta nada.

## 7. Operação

- **Correlação**: toda resposta traz `X-Request-Id`; consulte os dois
  endpoints com `requestId=<valor>`.
- **Storage indisponível**: procure `[log-storage]` no stderr da instância;
  `WriteTechnicalLogService.stats()`/`WriteAuditEventService.stats()` expõem
  `written`/`dropped`/`failed` da fila.
- **Disco cheio** (`ENOSPC`) é erro permanente: o evento é descartado e
  contado; libere espaço ou mude o fluxo para `dynamodb`.
- **Encerramento**: `enableShutdownHooks` drena as filas (5 s) e remove os
  listeners de processo. `uncaughtException` registra, drena e encerra com
  código 1.
- **Bootstrap**: erro antes do container vira uma linha em `OBS_LOCAL_DIR`
  (quando `file`) e um sinal em stderr.
- **Rollback**: voltar `OBS_STORAGE`/`AUDIT_STORAGE` para `file` em
  staging/produção é recusado no boot; o rollback é entre tabelas ou para a
  versão anterior da aplicação. A tabela DynamoDB não deve ser removida no
  mesmo deploy em que deixa de ser usada.

## 8. Testes

Unitários em cada pasta (`*.spec.ts`), integração HTTP sem serviços reais em
`src/core/audit/audit.integration.spec.ts`, arquitetura e privacidade em
`src/core/request-context/discovery/components.registry.architecture.spec.ts`.
Nenhum teste acessa disco fora de pasta temporária, AWS ou banco.
