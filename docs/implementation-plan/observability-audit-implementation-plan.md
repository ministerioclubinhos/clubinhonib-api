# Plano de Implementação — Observabilidade e Auditoria

**Status:** plano de implementação; nenhuma alteração de código, infraestrutura,
ambiente ou banco de dados está autorizada por este documento.

**Última revisão:** 2026-09-05

**Escopo do repositório:** `clubinhonib-api`

## 1. Como este plano deve ser usado

Este documento separa rigorosamente:

1. requisitos confirmados pelo solicitante;
2. fatos verificados no repositório;
3. decisões ainda não fornecidas;
4. trabalho de implementação condicionado a essas decisões.

Nenhum item marcado como **DECISÃO PENDENTE** pode ser transformado em código,
configuração ou infraestrutura por escolha implícita do implementador. Isso é
necessário para cumprir o requisito de **zero suposições**.

## 2. Requisitos confirmados

### 2.1 Observabilidade

- O destino é selecionado por `OBS_STORAGE`:
  - `file`: persistência local em arquivo;
  - `dynamodb`: persistência em DynamoDB.
- O diretório local é configurado por `OBS_LOCAL_DIR`.
- A retenção é configurada em dias por `OBS_TTL_DAYS`.
- **Todos os erros que acontecerem devem ser capturados**, incluindo erros que
  não chegam ao filtro HTTP porque foram capturados e tratados em outro ponto.
- Deve-se tentar associar ao erro o contexto disponível, incluindo usuário e
  origem no código/arquivo, sem registrar conteúdo sensível.
- A captura deve alcançar todos os módulos Nest atuais e futuros: core,
  domínios, banco, providers compartilhados, jobs e módulo raiz.

Configuração fornecida:

```dotenv
OBS_STORAGE=file
OBS_LOCAL_DIR=logs
OBS_TTL_DAYS=1
```

### 2.2 Auditoria

- O destino é selecionado por `AUDIT_STORAGE`:
  - `file`: persistência local em arquivo;
  - `dynamodb`: persistência em DynamoDB.
- O diretório local é configurado por `AUDIT_LOCAL_DIR`.
- A retenção é configurada em dias por `AUDIT_TTL_DAYS`.
- A janela de desduplicação é configurada em segundos por
  `AUDIT_DEDUP_SECONDS`; `0` desativa a função.
- **Todas as ações devem ser auditadas**, inclusive leituras e mutações.
- Cada ação deve ser associada ao usuário que a realizou quando houver uma
  identidade autenticada e verificável.
- A cobertura deve alcançar todos os módulos, e não apenas os controllers que
  hoje possuem logs manuais.
- A implementação deve ser transversal e concisa: não adicionar decorator,
  chamada de auditoria ou bloco repetitivo em cada handler/service/repository.
  A descoberta de módulo, controller, handler e rota deve ser automática.
- Observabilidade e auditoria usarão uma tabela DynamoDB compartilhada. A
  separação lógica será feita pelo tipo de registro e cada item terá sua própria
  expiração, permitindo TTLs diferentes.

Configuração fornecida:

```dotenv
AUDIT_STORAGE=file
AUDIT_LOCAL_DIR=audit
AUDIT_TTL_DAYS=1
AUDIT_DEDUP_SECONDS=60
```

### 2.3 Restrições obrigatórias do repositório

- DynamoDB é uma integração externa e deve ficar atrás de provider injetável;
  serviços de domínio não podem conhecer o SDK da AWS.
- Não será criada entidade TypeORM para logs e não haverá tabela MySQL de logs.
- Se uma garantia futura exigir outbox MySQL, essa alternativa passa a ser uma
  mudança de schema e só poderá ser executada com migration gerada pelo CLI
  oficial do TypeORM, conforme `AI_DATABASE_CHANGE_REQUIREMENTS.md`.
- Nenhum `any`; contratos, enums, tipos, constantes e utilitários ficam em
  arquivos dedicados.
- Tokens, senhas, cabeçalhos de autorização, refresh tokens, códigos de
  recuperação/verificação, corpos completos, dados de crianças/responsáveis e
  conteúdo de arquivos enviados nunca podem ser persistidos nos logs.
- Testes não podem acessar DynamoDB, MySQL ou outro serviço real.
- Não modificar arquivos reais `env/*.env`, ambientes, stacks, roles, serviços
  ou dados remotos sem autorização explícita.

## 3. Diagnóstico confirmado do estado atual

O inventário abaixo foi levantado no código existente e deve ser revalidado no
início da implementação porque o worktree já contém alterações do usuário.

- Existem 29 controllers, 92 handlers `GET` e 97 handlers de mutação
  (`POST`, `PUT`, `PATCH` e `DELETE`).
- Existem 38 módulos Nest versionados. Todos estão explicitamente inventariados
  na seção 9.4 e entram na cobertura transversal.
- Existem pelo menos 93 chamadas explícitas de `logger.error` e 114 blocos
  `catch`.
- Não existe middleware de correlation/request ID, `AsyncLocalStorage`,
  interceptor global de requisição nem logger estruturado da aplicação.
- `src/main.ts` instancia `GlobalExceptionFilter` com `new`, portanto o filtro
  atual não pode receber o serviço de auditoria/observabilidade por injeção de
  dependência.
- O filtro global atual vê exceções HTTP não tratadas, mas não vê erros
  capturados e recuperados dentro de services/providers/jobs.
- `JobRunnerService` captura falhas de jobs, registra `logger.error` e não
  propaga a exceção. Essas falhas precisam chegar ao storage técnico pelo
  logger estruturado.
- A identidade autenticada é colocada em `request.user` pelo Passport somente
  quando `JwtAuthGuard` executa com sucesso.
- Há rotas deliberadamente públicas e fluxos anteriores à autenticação. Em
  especial: `/`, `/health`, `/routes`, `/email-preferences/unsubscribe`, login,
  cadastro, refresh, recuperação e verificação de conta, além de
  `POST /contact`. Esses fluxos podem não ter um `userId` verificável.
- `ConfigModule` é global, mas ainda não possui validação central das novas
  variáveis.
- O projeto usa `@aws-sdk/client-s3`, mas não possui os clientes DynamoDB no
  `package.json`.
- Produção é implantada por ECS e declara usar IAM Task Role. A definição dessa
  role não está versionada neste repositório.
- Staging é implantado em EC2 e atualmente injeta credenciais AWS no arquivo de
  ambiente. A role EC2 versionada possui permissões de S3/ECR/SSM, mas não de
  DynamoDB.
- A imagem Docker não monta volume para logs. Portanto `file` dentro de staging
  ou produção seria efêmero e não atende auditoria durável.
- `.gitignore` já ignora `logs`, mas não ignora o diretório literal `audit`.
- O contrato de erro HTTP já é centralizado em
  `GlobalExceptionFilter` e usa `{ success: false, error: ... }`; ele deve ser
  preservado.

## 4. Trava de decisões — zero suposições

Antes de implementar, registrar a resposta e o responsável por cada decisão.
As decisões críticas bloqueiam as fases indicadas.

| ID | Decisão exigida | Por que não pode ser inferida | Bloqueia |
| --- | --- | --- | --- |
| D-001 | Como representar ações sem usuário autenticado: `anonymous` com `actorId=null`, identidade posteriormente resolvida, rejeitar a ação ou outra regra? | Login, cadastro, recuperação, health check e rotas públicas podem ocorrer sem usuário. É impossível atribuir com segurança um UUID de usuário inexistente ou ainda não autenticado. | Auditoria |
| D-002 | Todos os 38 módulos Nest já estão incluídos. Falta definir se scripts CLI/automations executados fora do Nest também entram como ações auditáveis. | Scripts externos não passam pelo interceptor, logger ou container Nest e exigem um wrapper próprio com `actorType=system` ou operador identificado. | Fronteira externa de auditoria |
| D-003 | Auditar apenas ações concluídas ou também tentativas que falharam, foram negadas pelo guard, falharam na validação ou atingiram rota inexistente? | O termo “ação” não define o tratamento de tentativas e falhas. | Interceptor/filtro |
| D-004 | Como conciliar “todas as ações” com `AUDIT_DEDUP_SECONDS=60`: deduplicar apenas emissão duplicada da mesma request, agregar repetições com contador ou suprimir requests repetidas? | Suprimir uma request repetida elimina um registro individual e contradiz literalmente “todas”. | Desduplicação/schema |
| D-005 | A auditoria guardará somente metadados e nomes de campos alterados ou também valores anteriores/posteriores? | Snapshots ampliam risco LGPD e podem conter dados de criança, responsável, senha e tokens. | Contrato do evento |
| D-006 | O que uma falha do storage de auditoria faz: bloqueia a ação antes da execução, não bloqueia e gera alerta, usa fallback durável, ou exige outbox? | DynamoDB e MySQL não compartilham transação. Não existe garantia atômica de “mudança de negócio + auditoria” sem desenho adicional. | Arquitetura de entrega |
| D-007 | Qual é o nome físico da tabela por ambiente e qual nova variável conterá esse nome? | As variáveis fornecidas não informam a tabela. Um nome não deve ser hardcoded nem derivado silenciosamente. | Provider/infra |
| D-008 | Quem poderá consultar auditoria/observabilidade e por qual meio: API administrativa, console/CLI AWS, exportação ou nenhum acesso nesta entrega? | Os access patterns determinam chaves e índices do DynamoDB. | Schema DynamoDB |
| D-009 | `AUDIT_TTL_DAYS=1` é a retenção de compliance aprovada para staging e produção ou apenas valor local inicial? | Um dia pode ser insuficiente para investigação/compliance; a decisão precisa de responsável do negócio/privacidade. | Infra/rollout |
| D-010 | O formato local será JSONL com extensão `.jsonl`, JSONL com extensão `.json` ou um array JSON reescrito? | O comentário fornecido diz JSONL, enquanto a solicitação também menciona “.json”. São formatos operacionais diferentes. | File provider |
| D-011 | Observabilidade persistirá somente nível `error` ou também `warn`, `log`, `debug` e `verbose`? | Foi confirmado que todos os erros são obrigatórios, não que os demais níveis devam ser persistidos. | Logger/custo |
| D-012 | Stack trace completo pode ser armazenado? Por quantos dias e em quais ambientes? | Stack ajuda a localizar arquivo/linha, mas mensagens/causas de vendors podem carregar dados sensíveis. | Sanitização/schema |
| D-013 | Registrar IP e User-Agent é permitido? Se IP for necessário, será bruto, truncado ou hash com segredo rotacionável? | IP/User-Agent são dados pessoais ou identificadores e não foram autorizados. | Contexto HTTP |
| D-014 | “Contexto de arquivos” significa arquivo/linha do stack, metadados de upload ou ambos? | Nome original, conteúdo e URL de upload podem identificar usuário/criança e estão proibidos sem regra explícita. | Contrato técnico |
| D-015 | Logs técnicos continuam saindo em stdout/stderr além do storage escolhido? | ECS/EC2 normalmente dependem do stdout para diagnóstico do próprio storage, mas `OBS_STORAGE` foi descrito como destino singular. | Logger/fallback |
| D-016 | Qual volume máximo e taxa de requests/erros por ambiente, tamanho máximo por evento e SLO de latência adicional? | Capacidade, sharding, fila, batch e custo não podem ser dimensionados sem volume/SLO. | Schema/performance |
| D-017 | Criptografia com chave AWS-managed ou customer-managed KMS, PITR, deletion protection e tags obrigatórias? | São controles de segurança/custo que exigem decisão operacional. | CloudFormation |
| D-018 | Quais alarmes/canais e responsáveis receberão falha de escrita, throttling, fila cheia e perda de eventos? | Um alerta sem destinatário não é operacional. | Operação |
| D-019 | `/health`, CORS `OPTIONS`, 404 e tráfego de load balancer devem gerar auditoria individual? | São requests sem usuário e podem dominar volume/custo. Excluí-las violaria “todas” se não houver autorização explícita. | Cobertura/custo |
| D-020 | IDs de criança, responsável, mídia e contato podem aparecer como `resourceId` pseudonimizado ou devem ser hash/omitidos? | A política proíbe dados de crianças; o limite entre identificador seguro e dado pessoal precisa ser aprovado. | Catálogo/sanitização |
| D-021 | A implementação de infraestrutura e workflows será incluída na mesma entrega de código ou em entrega separada? | Alterar/deployar infraestrutura precisa de autorização explícita e a role ECS não está no repositório. | Rollout |
| D-022 | A tabela será criada em qual conta/região para cada ambiente e os ambientes compartilharão tabela ou terão tabelas físicas separadas? | `AWS_REGION` existe, mas conta e isolamento não estão confirmados. | CloudFormation/IAM |

### 4.1 Limite técnico que precisa ser aceito explicitamente

“Capturar todos os erros” só pode significar **tentar persistir todos os erros que
alcançam o processo da aplicação**. Nenhum software consegue garantir gravação
quando, por exemplo, o processo recebe `SIGKILL`, o host perde energia, o disco
está cheio e o DynamoDB está indisponível ao mesmo tempo, ou a falha acontece
antes da inicialização do runtime. O desenho deve documentar:

- nível de garantia escolhido para auditoria e observabilidade;
- timeout e retry;
- fallback;
- contador de eventos descartados;
- comportamento no encerramento;
- procedimento de reconciliação.

Sem a decisão D-006, não existe promessa correta de durabilidade.

## 5. Critérios de aceite funcionais

Os critérios abaixo ficam condicionados às decisões da seção 4.

1. Cada request coberta produz exatamente um resultado de auditoria lógico, com
   `requestId`, método, rota normalizada, instante, duração, status, resultado e
   ator verificável quando disponível.
2. Requests bem-sucedidas, negadas por guard, rejeitadas pelo pipe, rotas 404 e
   exceções de controller/service são cobertas conforme D-003/D-019.
3. Uma request autenticada grava somente o UUID e o papel do ator; não grava
   e-mail, nome, CPF, telefone ou token.
4. Login/cadastro bem-sucedido pode enriquecer o contexto com o UUID resolvido
   pelo caso de uso, sem extrair nem persistir os tokens da resposta.
5. Todo `Logger.error` da aplicação é estruturado, sanitizado e encaminhado ao
   provider técnico configurado.
6. Todo erro HTTP não tratado é registrado uma vez pelo filtro global, mantendo
   inalterado o envelope público atual.
7. Erros capturados e deliberadamente recuperados em providers/services/jobs
   também são persistidos, e não apenas exibidos no console.
8. Rejeições não tratadas, exceções fatais, erros de bootstrap e falhas de
   shutdown seguem a política de captura/fallback definida.
9. `file` cria arquivos no diretório configurado sem permitir path traversal,
   com um objeto JSON válido por registro no formato decidido em D-010.
10. `dynamodb` grava observabilidade e auditoria na tabela compartilhada, com
    discriminador de tipo e TTL individual correto.
11. A desduplicação é concorrente e consistente entre réplicas em DynamoDB, de
    acordo com D-004; não pode ser somente um `Map` em memória em produção.
12. Nenhum evento persiste segredos, authorization header, cookies, query
    tokens, senhas, refresh tokens, payload Google, código de recuperação,
    conteúdo de upload ou corpo/resposta completos.
13. Uma falha do próprio logger não entra em loop recursivo.
14. O provider ativo e todas as variáveis condicionais são validados no boot.
15. Os testes unitários/e2e não acessam AWS nem banco real.

## 6. Arquitetura-alvo condicionada às decisões

### 6.1 Fluxo transversal

```text
Request
  -> RequestContextMiddleware (requestId + contexto isolado por AsyncLocalStorage)
  -> AutomaticActionContextGuard global (descobre módulo/controller/handler/rota)
  -> OptionalIdentity global (conforme D-001/D-019)
  -> guards existentes
  -> AuditInterceptor (resultado de sucesso)
  -> controller -> service -> repository/provider
  -> GlobalExceptionFilter injetável (resultado de falha + erro técnico)

Nest Logger / jobs / providers / process handlers
  -> StructuredTechnicalLogger
  -> Sanitizer
  -> ObservabilityStoragePort
      -> File storage OU DynamoDB storage

AuditInterceptor / GlobalExceptionFilter / contexto de autenticação
  -> AuditEventBuilder
  -> Sanitizer + Deduplicator
  -> AuditStoragePort
      -> File storage OU DynamoDB storage
```

O fluxo usa um contexto por request. Providers Nest são singleton e não podem
armazenar `requestId`/usuário em propriedades mutáveis.

### 6.2 Módulos e responsabilidades

Estrutura planejada; nomes finais só mudam por decisão documentada:

```text
src/core/request-context/
├── request-context.module.ts
├── request-context.middleware.ts
├── request-context.service.ts
├── constants.ts
├── types.ts
└── utils.ts

src/core/observability/
├── observability.module.ts
├── services/write-technical-log.service.ts
├── providers/structured-logger.service.ts
├── process/process-error-listeners.service.ts
├── enums.ts
├── constants.ts
├── types.ts
└── utils/
    ├── error-normalizer.utils.ts
    ├── redaction.utils.ts
    └── stack-location.utils.ts

src/core/audit/
├── audit.module.ts
├── discovery/auditable-components.registry.ts
├── guards/automatic-action-context.guard.ts
├── interceptors/audit.interceptor.ts
├── services/write-audit-event.service.ts
├── services/audit-deduplication.service.ts
├── enums.ts
├── constants.ts
├── types.ts
└── utils/
    ├── audit-fingerprint.utils.ts
    └── audit-event.utils.ts

src/shared/providers/log-storage/
├── log-storage.module.ts
├── ports/observability-storage.port.ts
├── ports/audit-storage.port.ts
├── file/file-observability-storage.provider.ts
├── file/file-audit-storage.provider.ts
├── file/file-retention.provider.ts
├── dynamodb/dynamodb-client.provider.ts
├── dynamodb/dynamodb-observability-storage.provider.ts
├── dynamodb/dynamodb-audit-storage.provider.ts
├── dynamodb/dynamodb-deduplication.provider.ts
├── constants.ts
├── types.ts
└── utils.ts
```

Regras de camada:

- controllers continuam sem chamar DynamoDB;
- serviços de domínio não escrevem diretamente no storage;
- controllers, services e repositories não recebem chamadas repetidas de
  auditoria nem decorators por endpoint;
- interceptores/filtro chamam serviços de observabilidade/auditoria;
- providers implementam os ports e contêm todos os comandos do SDK/file system;
- factories selecionam providers a partir da configuração validada;
- `GlobalExceptionFilter` passa a ser registrado com `APP_FILTER`; remover a
  instanciação manual de `src/main.ts` evita duas execuções do filtro;
- o interceptor global é registrado com `APP_INTERCEPTOR`;
- o middleware de contexto é aplicado a todas as rotas no módulo raiz;
- um registry construído a partir de `ModulesContainer` descobre uma vez, no
  startup, todos os módulos, controllers e providers e cria os mapas de
  contexto; não existe lista manual duplicada no runtime;
- se forem necessários guards globais auxiliares, sua ordem é testada.

### 6.3 Contexto de request e correlação

O contexto mínimo planejado é:

```typescript
interface RequestExecutionContext {
  requestId: string;
  startedAtEpochMs: number;
  moduleName: string;
  controllerName: string;
  handlerName: string;
  routeTemplate: string;
  httpMethod: AuditHttpMethod;
  actorType: AuditActorType;
  actorId: string | null;
  actorRole: UserRole | null;
  auditWritten: boolean;
}
```

Implementação:

1. gerar no servidor um UUID para cada request;
2. nunca usar token, e-mail ou endereço como correlation ID;
3. manter o contexto em `AsyncLocalStorage`;
4. devolver `X-Request-Id` na resposta para suporte;
5. decidir se um ID vindo do cliente será ignorado ou guardado separadamente;
6. resolver módulo/controller/handler pelos metadados do `ExecutionContext` e
   pelo registry automático do container Nest;
7. após os guards, copiar somente `request.user.userId` e role normalizada;
8. nos fluxos de autenticação, permitir que o caso de uso informe ao contexto o
   UUID que acabou de resolver/criar, sem copiar a resposta completa;
9. marcar o evento gravado para impedir duplicação entre interceptor e filtro.

O `requestId` gerado pela aplicação é sempre a chave de correlação confiável.

### 6.4 Regras para evitar implementação verbosa

- Zero decorators de auditoria por endpoint.
- Zero chamadas de `audit(...)` em controllers, services ou repositories de
  domínio.
- Zero enum/constante manual para cada uma das 189 rotas.
- Um middleware de contexto, um guard de descoberta, um interceptor de sucesso
  e um filtro de falha cobrem o boundary HTTP inteiro.
- Um registry imutável, construído no startup, relaciona componentes e módulos.
- Um logger Nest global cobre todos os módulos que já usam `Logger`.
- Um único wrapper reutilizável cobre jobs/boundaries não HTTP aprovados.
- Somente fluxos em que a informação surge depois do boundary, como o UUID
  descoberto no login/cadastro, podem usar um hook explícito mínimo.
- `catch` silencioso precisa ser corrigido, mas usa o mesmo reporter tipado; não
  cria formatos de log diferentes por módulo.
- A tabela da seção 9.3 é documentação/teste, não código duplicado.

## 7. Contratos de dados

### 7.1 Campos comuns

Todo item técnico ou de auditoria terá contrato versionado:

| Campo | Tipo | Regra |
| --- | --- | --- |
| `schemaVersion` | string constante | Permite evolução do formato. |
| `eventId` | UUID | Gerado no servidor. |
| `recordType` | enum | `observability`, `audit` ou item interno de dedup. |
| `environment` | string validada | Valor explícito de ambiente. |
| `service` | string constante | `clubinhonib-api`. |
| `occurredAt` | ISO-8601 UTC | Relógio injetável nos testes. |
| `expiresAtEpochSeconds` | inteiro | `occurredAt + TTL` do respectivo stream. |
| `requestId` | UUID/null | Nulo em bootstrap/process/job sem request. |
| `sourceType` | enum | HTTP, job, provider, process, bootstrap ou CLI, conforme D-002. |
| `actorType` | enum | user, anonymous ou system, conforme D-001/D-002. |
| `actorId` | UUID/null | Apenas identidade verificada. |
| `actorRole` | `UserRole`/null | Papel normalizado no momento da ação. |

Não gravar o objeto `request`, `response`, DTO, entity ou `Error` bruto. Todos os
contratos são montados campo a campo.

### 7.2 Evento técnico de observabilidade

Campos planejados:

- `level`: enum de níveis habilitados por D-011;
- `context`: nome do logger/classe;
- `operation`: operação segura quando conhecida;
- `message`: texto sanitizado e limitado;
- `errorName`, `errorCode` e `errorMessage` sanitizados;
- `stack`: opcional conforme D-012;
- `sourceFile`, `sourceLine`, `sourceColumn`: extraídos do primeiro frame interno
  permitido e normalizados para caminho relativo, nunca caminho de usuário;
- `errorFingerprint`: hash estável de classe, código e frames sanitizados;
- `httpMethod`, `routeTemplate`, `statusCode` e `durationMs` quando HTTP;
- `providerName` e operação externa, sem request/response do vendor;
- `jobName` quando aplicável;
- `metadata`: objeto fechado e allowlisted, com limite de tamanho/profundidade.

Para exceções conhecidas, persistir `ErrorCode`. Para erros desconhecidos,
persistir `INT_9001` no evento sem alterar indevidamente o erro público.

### 7.3 Evento de auditoria

Campos planejados:

- `actionType`: enum do boundary (`http_request`, `scheduled_job`,
  `system_operation` ou `cli_command`, conforme D-002);
- `actionName`: identificador automático e estável no formato
  `<moduleName>.<controllerName>.<handlerName>` para HTTP; não haverá enum ou
  catálogo manual com uma constante por endpoint;
- `moduleName`, `controllerName` e `handlerName`: nomes descobertos do container
  Nest/`ExecutionContext`;
- `resourceType`: namespace normalizado da rota/controller, sem lista repetida;
- `resourceId`: string segura/null conforme D-020;
- `parentResourceType` e `parentResourceId` quando necessários para contexto;
- `outcome`: enum (`succeeded`, `failed`, `denied`, `rejected`, `not_found`),
  condicionado a D-003;
- `httpMethod` em enum, `routeTemplate`, `statusCode`, `durationMs`;
- `errorCode`: somente código catalogado, nunca `details` bruto;
- `changedFields`: somente nomes allowlisted, se D-005 aprovar;
- `dedupFingerprint`, `occurrenceCount`, `firstOccurredAt` e `lastOccurredAt`
  conforme a estratégia escolhida em D-004;
- IDs técnicos de operação transacional, se já existirem e forem seguros.

O evento não guarda resposta, body ou snapshots irrestritos.

Para actions HTTP, o método e o nome real do handler carregam a semântica sem
exigir manutenção duplicada. Exemplos gerados automaticamente:

```text
ClubsModule.ClubsController.create
ClubsModule.ClubsController.toggleActive
StatisticsModule.StatisticsController.getOverviewStatistics
```

Uma chamada interna entre módulos não gera outra “ação do usuário”: ela herda o
mesmo `requestId`, ator e ação de entrada. Seus erros e logs técnicos continuam
associados ao módulo/classe de origem. Isso cobre todos os módulos sem produzir
dezenas de eventos repetidos para uma única request.

### 7.4 Limites e sanitização

Definir e testar constantes para:

- tamanho máximo do evento e de cada string;
- profundidade e quantidade máxima de propriedades de metadata;
- quantidade máxima de frames/cadeia de causas;
- allowlist de chaves de metadata;
- denylist case-insensitive, no mínimo:
  `authorization`, `cookie`, `password`, `token`, `accessToken`, `refreshToken`,
  `secret`, `cpf`, `email`, `phone`, `guardianName`, `guardianPhone`, `name`,
  `notes`, `file.buffer`, conteúdo e nome original de upload;
- remoção de query string de URL; guardar rota template, não URL completa;
- truncamento explícito com marcador, jamais corte silencioso;
- tratamento de objetos circulares, `bigint`, símbolos e valores `unknown`.

O tamanho final precisa ficar abaixo do limite do DynamoDB com margem definida
em D-016; o provider deve rejeitar localmente item acima do limite operacional e
emitir fallback seguro.

## 8. Captura de todos os erros

### 8.1 Matriz de cobertura

| Origem | Mecanismo | Resultado obrigatório |
| --- | --- | --- |
| AppException/HttpException de handler | filtro global injetável | Erro técnico + auditoria de falha, sem mudar envelope. |
| Guard/role/validação/404 | filtro global + contexto inicializado antes dos guards | Evento com status/código e ator se já validado. |
| `Logger.error` existente | logger Nest estruturado | Persistência técnica sanitizada. |
| Erro capturado e recuperado em provider/service | logger estruturado; revisão de cada `catch` | Evento técnico mesmo sem resposta 5xx. |
| Job agendado | `JobRunnerService` + logger estruturado | Erro com `jobName`, duração e ator system conforme D-002. |
| Promise rejeitada sem tratamento | listener de processo | Registro/fallback, política de encerramento explícita. |
| Exceção não capturada | listener/monitor de processo | Tentativa de flush com timeout e encerramento seguro. |
| Falha de bootstrap | bootstrap boundary | Fallback independente do container Nest. |
| Falha no shutdown/flush | lifecycle hooks | Fallback não recursivo e contador de perda. |
| Falha do próprio Dynamo/file provider | emergency sink | stderr/alternativa definida em D-006/D-015, sem chamar a si mesmo. |

### 8.2 Logger Nest estruturado

1. Implementar `LoggerService` compatível com Nest.
2. Criar a aplicação com buffering de logs e, após resolver DI, instalar o
   logger com `app.useLogger(...)` e fazer flush.
3. Preservar `context`, nível, timestamp e stack separados.
4. Resolver automaticamente o módulo dono do `context` pelo registry do
   container; usar fallback explícito `unknown-module` apenas para código fora
   do grafo e contabilizar esse caso.
5. Buscar `requestId`/ator no `RequestContextService`, se existir.
6. Sanitizar antes de qualquer sink.
7. Nunca usar o próprio `Logger` Nest dentro do provider que implementa o
   logger; usar emergency writer para evitar recursão.
8. Revisar as 93 chamadas `logger.error` e os 114 `catch` atuais:
   - preservar exceções específicas;
   - substituir casts inseguros por narrowing de `unknown`;
   - garantir que todo erro deliberadamente engolido seja registrado;
   - remover valores sensíveis das mensagens;
   - não promover warnings normais a erro.
9. Adicionar verificação automática para impedir `console.error` e novos
   `catch` silenciosos dentro do escopo acordado.

### 8.3 Processo e lifecycle

- Habilitar shutdown hooks do Nest.
- Providers com buffer devem implementar lifecycle e flush com timeout.
- `unhandledRejection` é normalizada como `unknown`.
- `uncaughtException` é fatal; registrar em melhor esforço e encerrar, sem
  manter processo potencialmente corrompido vivo.
- Não iniciar promises fire-and-forget sem rastreamento.
- Manter fila limitada, backpressure e contador de descartes se a política
  escolhida permitir buffer.
- Erro de bootstrap precisa de um writer mínimo separado, pois DI pode não ter
  sido criada.

## 9. Auditoria de todas as ações

### 9.1 Cobertura automática e sem lacunas

1. Inicializar contexto antes dos guards.
2. Usar um guard global pass-through para coletar automaticamente
   módulo/controller/handler/rota antes dos guards de autenticação, permitindo
   que o filtro conheça a ação mesmo quando outro guard bloquear a request.
3. Usar interceptor global para conclusão de requests bem-sucedidas.
4. Usar o filtro global para requests com exceção.
5. Usar flag por request/event ID idempotente para não gravar duas vezes.
6. Descobrir módulos, controllers e providers com `ModulesContainer` no startup
   e guardar um mapa imutável `component class -> module`.
7. Construir `actionName` automaticamente a partir dos nomes reais resolvidos;
   não criar `@AuditAction`, enum por rota ou chamada manual em cada método.
8. Extrair `resourceId` apenas de route params com nomes seguros (`id`,
   `clubId`, `teacherId`, `coordinatorId`, `pageId`) e, em criação, apenas a
   propriedade tipada `id` do resultado depois de narrowing de `unknown`.
9. Nunca percorrer body ou response completos para produzir auditoria.
10. Para delete, capturar automaticamente os params antes do handler, pois a
    resposta pode conter só uma mensagem.
11. A única integração manual permitida é um hook pequeno e reutilizável quando
    o boundary não fornece informação impossível de inferir com segurança, por
    exemplo o `userId` descoberto durante login/cadastro ou um job sem HTTP.
12. Criar teste arquitetural que sobe o grafo e prova que todo controller/
    handler descoberto passa pelo mecanismo global, incluindo módulos futuros.

### 9.2 Identidade do ator

Ordem de resolução:

1. identidade validada em `request.user`;
2. identidade explicitamente registrada no contexto pelo fluxo de
   login/cadastro/refresh/verificação após resolução segura;
3. identidade opcional verificada em rota pública, se D-001 autorizar esse
   comportamento;
4. regra final de ator anônimo/sistema definida em D-001/D-002.

É proibido confiar em `userId` enviado em body/query/param como identidade do
ator. Ele pode ser `resourceId`, mas nunca prova quem realizou a ação.

### 9.3 Inventário de referência dos handlers HTTP

Todos os handlers existentes devem ser cobertos. Esta tabela é evidência do
escopo atual e checklist de teste, não configuração do runtime. A implementação
deve reextrair o inventário automaticamente no início e nos testes; não haverá
lista manual de rotas para o interceptor manter.

| Controller/base | Handlers que devem ser auditados |
| --- | --- |
| `/` | `GET /`, `GET /health` |
| `/auth` | `POST login`, `POST google`, `POST refresh`, `POST logout`, `GET me`, `POST complete-register`, `POST register`, `POST forgot-password`, `POST verify-email`, `POST resend-verification`, `GET reset-password/validate`, `POST reset-password`, `POST link-club` |
| `/users` | `POST /`, `GET /`, `GET :id`, `PUT :id`, `DELETE :id`, `PATCH :id/image` |
| `/profile` | `GET /`, `PATCH /`, `PATCH password`, `PATCH image` |
| `/profiles` | `POST /`, `GET /`, `GET birthdays`, `GET me`, `PUT me`, `GET :id`, `PUT :id`, `DELETE :id` |
| `/email-preferences` | `POST unsubscribe` |
| `/feature-flags` | `POST /`, `POST seed`, `GET /`, `GET stats`, `GET map`, `GET check/:key`, `GET :key`, `PATCH :key`, `PATCH :key/toggle`, `DELETE :key` |
| `/routes` | `GET /`, `GET :id` |
| `/teacher-profiles` | `GET /`, `GET simple`, `GET :id`, `GET by-club/:clubId`, `PATCH :teacherId/assign-club`, `PATCH :teacherId/unassign-club` |
| `/coordinator-profiles` | `GET /`, `GET simple`, `GET :id`, `GET by-club/:clubId`, `PATCH :coordinatorId/assign-club`, `PATCH :coordinatorId/unassign-club`, `PATCH :fromCoordinatorId/move-club` |
| `/clubs` | `POST /`, `GET simple-options`, `GET /`, `GET all`, `GET :id`, `PATCH :id`, `PATCH :id/toggle-active`, `DELETE :id` |
| `/children` | `GET /`, `GET simple`, `GET :id`, `POST /`, `PUT :id`, `DELETE :id`, `PATCH :id/toggle-active` |
| `/pagelas` | `POST /`, `GET paginated`, `GET /`, `GET :id`, `PATCH :id`, `DELETE :id` |
| `/accepted-christs` | `POST /` |
| `/club-control` | `POST periods`, `GET periods/:year`, `GET periods`, `PUT periods/:id`, `DELETE periods/:id`, `POST exceptions`, `PATCH exceptions/:id`, `GET exceptions/:date`, `GET exceptions`, `DELETE exceptions/:id`, `GET check/club/:clubId`, `GET check/week`, `GET dashboard`, `GET current-week`, `GET indicators/detailed` |
| `/statistics` | `GET pagelas/charts`, `GET accepted-christs/charts`, `GET insights`, `GET overview`, `GET pagelas`, `GET accepted-christs`, `GET children`, `GET clubs`, `GET teachers`, `GET attendance/club/:clubId`, `GET attendance/week` |
| `/contact` | `POST /`, `GET /`, `GET unread-count`, `GET :id`, `PATCH :id/read`, `PATCH :id/unread`, `DELETE :id` |
| `/comments` | `POST /`, `GET published`, `GET /`, `GET unpublished-count`, `GET :id`, `PUT :id`, `PATCH :id/publish`, `PATCH :id/unpublish`, `DELETE :id` |
| `/site-feedbacks` | `POST /`, `GET /`, `GET unread-count`, `GET :id`, `PUT :id`, `PATCH :id/read`, `PATCH :id/unread`, `DELETE :id` |
| `/documents` | `POST /`, `GET /`, `GET :id`, `PATCH :id`, `DELETE :id` |
| `/meditations` | `POST /`, `GET /`, `GET this-week`, `GET :id`, `PATCH :id`, `DELETE :id` |
| `/informatives` | `POST /`, `GET /`, `GET :id`, `PATCH :id`, `DELETE :id` |
| `/events` | `POST /`, `GET /`, `GET upcoming`, `GET :id`, `PATCH :id`, `DELETE :id` |
| `/video-pages` | `POST /`, `PATCH :id`, `GET /`, `GET :id`, `DELETE :id` |
| `/ideas-pages` | `POST /`, `PATCH :id`, `GET /`, `GET :id`, `DELETE :id` |
| `/image-pages` | `POST /`, `PATCH :id`, `GET /`, `GET :id/sections`, `GET :id`, `DELETE :id` |
| `/week-material-pages` | `POST /`, `PATCH :id`, `DELETE :id`, `GET /`, `GET current-week`, `GET :id`, `POST current-week/:id` |
| `/ideas-sections` | `POST /`, `GET /`, `GET pending-count`, `GET :id`, `PATCH :id`, `PATCH :id/attach/:pageId`, `DELETE :id` |
| `/image-sections` | `POST /`, `GET /`, `GET pending-count`, `GET :id`, `PATCH :id`, `DELETE :id` |

### 9.4 Inventário obrigatório de todos os módulos

O registry automático deve descobrir os 38 módulos abaixo. O teste
arquitetural compara o grafo real com o registry e falha se algum módulo,
controller ou provider ficar sem contexto. A tabela documenta o baseline; não é
uma lista que a implementação consultará a cada request.

| Camada | Módulos confirmados | Como entram na cobertura |
| --- | --- | --- |
| Raiz e persistência | `AppModule`, `DatabaseModule` | Bootstrap, health, inicialização, TypeORM e erros de conexão/transação. |
| Core | `AuthModule`, `UserModule`, `ProfileModule`, `FeatureFlagsCoreModule`, `FeatureFlagsModule` | Todas as rotas, services, repositories, guards, strategies e erros. |
| Domínio | `AcceptedChristsModule`, `AddressesModule`, `ChildrenModule`, `ClubControlModule`, `ClubsModule`, `CommentModule`, `ContactModule`, `CoordinatorProfilesModule`, `DocumentModule`, `SiteFeedbackModule`, `InformativeModule`, `MeditationModule`, `PagelasModule`, `EventModule`, `IdeasPageModule`, `IdeasSectionModule`, `ImageModule`, `ImageSectionModule`, `VideosPageModule`, `WeekMaterialsPageModule`, `RouteModule`, `StatisticsModule`, `TeacherProfilesModule` | Uma auditoria automática por ação de entrada e logs/erros correlacionados de todos os componentes internos envolvidos. |
| Compartilhado/integrações | `EmailModule`, `MediaModule`, `AwsModule`, `NotificationModule`, `SmtpModule`, `TwilioModule`, `SchedulingModule`, `SiteUrlModule` | Erros técnicos automáticos; ações sem HTTP usam wrapper transversal de boundary se D-002 as incluir. |
| Framework/dinâmicos | `ConfigModule`, `TypeOrmModule`, `ScheduleModule`, `JwtModule`, `PassportModule` e registros `forRoot`/`forFeature` | Falhas observáveis de bootstrap/runtime; não são tratadas como ação de usuário separada. |

Cobertura não significa inserir chamadas em cada arquivo. Significa:

1. toda ação HTTP recebe contexto antes de entrar no módulo;
2. todos os logs e erros emitidos por qualquer módulo usam o logger global;
3. cada log técnico recebe o módulo de origem pelo mapa automático de classes/
   contextos;
4. chamadas internas herdam `requestId` e ator da ação de entrada;
5. jobs usam o mesmo `JobRunnerService`/boundary wrapper;
6. módulo futuro entra automaticamente pelo container e o teste de descoberta;
7. módulo sem controller, como `AddressesModule`, continua coberto quando seus
   services/repositories participam de uma request ou job;
8. scripts fora do Nest seguem a decisão D-002.

Requests sem handler Nest, como 404 e eventualmente `OPTIONS`, não possuem
módulo/controller/handler real. Se D-019 os incluir, o middleware gera um nome
de boundary explícito a partir de método e rota sanitizada, sem atribuí-los
falsamente a um módulo.

Para boundaries não HTTP, após D-002, usar um único wrapper reutilizável para:

- scheduler heartbeat;
- lembrete de pagela faltante;
- resumo semanal de coordenador;
- notificações, e-mail, WhatsApp e S3 quando constituírem ação auditável;
- scripts administrativos/automations, se incluídos;
- ações de bootstrap/seed, se executadas fora de endpoint.

## 10. Provider local em arquivo

### 10.1 Formato e escrita

- O formato final depende de D-010.
- Se JSONL for aprovado: um objeto compacto por linha, UTF-8, terminando em
  newline; nunca reescrever um array inteiro.
- Separar diretórios de observabilidade e auditoria conforme as variáveis.
- Particionar arquivos por UTC e por processo, por exemplo
  `YYYY-MM-DD.<pid>.jsonl`, para evitar corrupção entre processos.
- Abrir com append e permissões restritas: diretório `0700`, arquivo `0600` onde
  o sistema operacional suportar.
- Serializar somente o DTO sanitizado.
- Ordenar escritas por arquivo por meio de fila/mutex controlado.
- Tratar partial line no crash; leitor/validador deve reportar e pular somente a
  linha inválida.
- Resolver o caminho absoluto a partir do working directory e rejeitar destino
  que escape da raiz autorizada.

### 10.2 Retenção local

- Executar limpeza no startup e em intervalo gerenciado pelo lifecycle.
- Calcular expiração usando UTC e o TTL específico.
- Apagar somente arquivos reconhecidos pelo padrão do provider e mais antigos
  que a retenção; nunca executar remoção recursiva sobre diretório configurável.
- Evitar `ScheduleModule` para esse housekeeping se ele depender de
  `SCHEDULER_ENABLED`; a retenção precisa funcionar independentemente dos jobs
  de negócio.
- Testar relógio e filesystem com diretório temporário.
- Adicionar os diretórios aprovados ao `.gitignore`; hoje `audit` não está
  coberto.

### 10.3 Restrição de ambiente

`file` foi solicitado como opção local. O validador deve impedir seu uso em
staging/produção, salvo autorização explícita com volume persistente, política
de backup e rotação. O container atual não possui volume e perderia arquivos ao
ser recriado.

## 11. Provider DynamoDB

### 11.1 Dependências e cliente

- Adicionar AWS SDK v3 DynamoDB e document client ao `package.json`/lockfile.
- Um único `DynamoDBClient` injetável, região via `ConfigService` e credential
  provider chain padrão.
- Não colocar access key/secret no código ou evento.
- Definir timeouts, retry mode e número máximo de tentativas após D-006/D-016.
- Mockar `send` em todos os testes.

### 11.2 Access patterns antes das chaves

Antes de criar a tabela, fechar D-008 e documentar no mínimo se serão exigidas
consultas:

1. por intervalo de tempo e tipo de registro;
2. por `requestId` para correlacionar auditoria e erro;
3. por ator e intervalo de tempo;
4. por recurso e intervalo de tempo;
5. por `actionName`, `outcome`, `errorCode` ou nível;
6. exportação paginada;
7. investigação de itens próximos da expiração.

Não criar GSI “por garantia”: cada índice aumenta custo, permissões e exposição.

### 11.3 Modelo candidato, pendente de D-008/D-016

O modelo de referência para uma única tabela é:

```text
PK = STREAM#<recordType>#DAY#<yyyy-mm-dd>#SHARD#<n>
SK = <occurredAt>#<eventId>

GSI request (esparso):
  GSI1PK = REQUEST#<requestId>
  GSI1SK = <occurredAt>#<recordType>#<eventId>

GSI actor (somente auditoria com ator):
  GSI2PK = ACTOR#<actorId>#MONTH#<yyyy-mm>
  GSI2SK = <occurredAt>#<actionName>#<eventId>
```

- A quantidade de shards só será definida com D-016.
- Se consulta por recurso for aprovada, decidir entre GSI adicional ou item de
  projeção; não reutilizar índice de ator com semântica ambígua.
- `environment` deve estar na chave ou cada ambiente deve ter tabela separada,
  conforme D-022.
- O item terá `expiresAtEpochSeconds` configurado como atributo TTL.
- TTL é retenção eventual, não exclusão instantânea; filtros de leitura devem
  ignorar itens logicamente expirados que ainda não foram removidos.
- Escrita normal usa ID único e condição que impeça sobrescrita acidental.

### 11.4 Desduplicação distribuída

Após D-004, implementar uma destas estratégias explicitamente:

1. **Idempotência da instrumentação por request:** chave condicionada por
   `requestId + actionName`; preserva uma linha lógica por ação do usuário.
2. **Agregação de requests idênticas:** `TransactWriteItems`/update condicional
   mantém `occurrenceCount`, primeiro/último instante e janela; não preserva uma
   linha por request e precisa de aprovação explícita.
3. **Supressão:** grava marcador `DEDUP#fingerprint` com expiração e só grava o
   primeiro evento; é incompatível com auditoria individual sem aprovação.

O fingerprint deve usar representação canônica e hash criptográfico de campos
allowlisted. Nunca incluir body bruto nem segredo. TTL do marcador não substitui
condição temporal, porque remoção TTL não é imediata.

Em `file`, documentar que dedup global entre processos só existe se houver lock
compartilhado; para desenvolvimento com múltiplos processos, usar arquivo por
processo ou aceitar escopo por processo somente mediante decisão explícita.

### 11.5 Infraestrutura e segurança

Entrega de infraestrutura, após autorização D-021:

- template CloudFormation dedicado e versionado;
- tabela(s) por ambiente conforme D-022;
- billing mode definido com base em D-016;
- TTL habilitado em `expiresAtEpochSeconds`;
- criptografia, PITR e deletion protection conforme D-017;
- tags de aplicação, ambiente, proprietário, dados e custo;
- outputs de nome/ARN da tabela;
- policy de aplicação com menor privilégio:
  `PutItem`, `UpdateItem`, `TransactWriteItems` e somente as ações de leitura
  aprovadas em D-008;
- aplicação não recebe `DeleteItem`, `DeleteTable` ou scan irrestrito sem caso
  de uso aprovado;
- policy limitada ao ARN da tabela e dos índices necessários;
- atualizar a EC2 instance role de staging;
- localizar e atualizar a ECS Task Role de produção no repositório/stack que
  realmente a controla; não confundir com execution role;
- atualizar deploy de staging e produção com o nome da tabela e as novas
  variáveis, sem incluir credenciais estáticas em produção;
- alarmes de throttling, system errors, user errors/falha do writer e custo,
  com destino definido em D-018.

Não executar deploy de stack ou alterar role remota como parte da implementação
de código sem autorização separada.

## 12. Configuração e validação de startup

### 12.1 Variáveis já solicitadas

| Variável | Tipo/regra |
| --- | --- |
| `OBS_STORAGE` | enum estrito `file` ou `dynamodb` |
| `OBS_LOCAL_DIR` | caminho obrigatório apenas quando `OBS_STORAGE=file` |
| `OBS_TTL_DAYS` | inteiro positivo; limite máximo pendente de política |
| `AUDIT_STORAGE` | enum estrito `file` ou `dynamodb` |
| `AUDIT_LOCAL_DIR` | caminho obrigatório apenas quando `AUDIT_STORAGE=file` |
| `AUDIT_TTL_DAYS` | inteiro positivo; política aprovada em D-009 |
| `AUDIT_DEDUP_SECONDS` | inteiro `>= 0` |

### 12.2 Variáveis adicionais obrigatórias ainda sem nome aprovado

- nome da tabela DynamoDB compartilhada;
- eventuais endpoint override/flags exclusivos para teste local, se DynamoDB
  Local entrar no escopo;
- tamanho de fila, batch, flush interval, timeout e retry, se D-006 escolher
  escrita assíncrona/bufferizada;
- segredo de hash de IP, somente se D-013 exigir pseudonimização;
- nível mínimo de observabilidade, se D-011 incluir outros níveis.

O nome exato de cada variável deve ser aprovado em D-007 antes de entrar no
contrato `.env.example`.

### 12.3 Arquivos de contrato

Atualizar, sem tocar nos arquivos reais:

- `env/local.env.example`;
- `env/staging.env.example`;
- `env/prod.env.example`;
- `env/README.md`;
- workflows de staging/produção apenas após D-021;
- documentação da infraestrutura e exemplos de parâmetros;
- `.gitignore` para os diretórios locais aprovados.

Falhar no startup com mensagem segura quando:

- enum for inválido;
- TTL/dedup não for inteiro no intervalo;
- storage DynamoDB não tiver tabela/região;
- storage file não tiver caminho válido/escrevível;
- `file` for usado em ambiente não autorizado;
- duas configurações incompatíveis forem combinadas.

## 13. Política de entrega, retries e falhas

Esta seção só é fechada após D-006 e D-016.

### 13.1 Observabilidade

- Nunca deixar falha de log substituir a exceção de negócio original.
- Aplicar retry apenas a erros transitórios classificados do provider.
- Usar timeout curto e fila limitada se escrita assíncrona for aprovada.
- Em fila cheia, seguir política explícita: backpressure ou descarte contado.
- Emitir sinal de falha por caminho independente do sink quebrado.

### 13.2 Auditoria

Escolher e documentar uma garantia:

- **best effort:** menor impacto na API, pode perder auditoria;
- **fail closed antes da ação:** indisponibilidade de auditoria bloqueia negócio;
- **pre-record + completion:** registra tentativa antes e atualiza resultado;
- **outbox durável:** exige schema MySQL, migration TypeORM e worker; ainda
  precisa definir cobertura de leituras;
- **fila durável externa:** adiciona infraestrutura e semântica de reprocesso.

Registrar claramente os cenários:

1. auditoria falha antes do caso de uso;
2. negócio falha depois do registro de tentativa;
3. negócio commita e registro de conclusão falha;
4. cliente desconecta durante a operação;
5. DynamoDB responde timeout, mas pode ter persistido;
6. retry repete a escrita;
7. processo encerra com fila pendente;
8. duas réplicas processam eventos idênticos.

Nenhuma dessas respostas pode ser inventada durante a codificação.

## 14. Consulta e exposição dos registros

Se D-008 incluir API, criar módulo somente leitura, separado dos providers de
escrita, seguindo controller → get service → provider de consulta, com:

- `JwtAuthGuard` e role administrativa explícita;
- DTOs de query e resposta;
- intervalo de datas obrigatório e limitado;
- paginação por cursor opaco do DynamoDB, nunca expor `LastEvaluatedKey` bruto;
- filtros allowlisted;
- resposta redigida novamente, mesmo que o item já tenha sido sanitizado;
- rate limit/autorização de exportação conforme decisão;
- nenhuma rota de alteração/exclusão de auditoria;
- a própria consulta aos logs também gera auditoria, evitando recursão por uma
  regra explícita e testada.

Se não houver API, documentar comandos/runbook aprovados para consulta por
operadores e as permissões humanas, sem conceder `Scan` à aplicação.

## 15. Testes obrigatórios

### 15.1 Unitários

- parser/config: valores válidos, ausentes, inválidos e requisitos condicionais;
- request context: isolamento entre requests concorrentes e ausência em jobs;
- redactor: todas as chaves sensíveis, profundidade, arrays, objetos circulares,
  URL/query, stack e mensagens de vendor;
- event builders: relógio, UUID, TTL, enums e limites;
- actor resolver: autenticado, role negada após autenticação, token inválido,
  rota pública, login/cadastro resolvido e caso D-001;
- audit interceptor: sucesso e duração;
- exception filter: AppException, HttpException, unknown, validação, guard, 404,
  envelope inalterado e escrita única;
- structured logger: todos os níveis aprovados, erro com/sem stack e prevenção
  de recursão;
- file providers: criação, append concorrente, permissões, JSON válido,
  retenção, caminho inválido, disco/permission error e shutdown;
- DynamoDB providers: comandos e condições exatos, TTL, retry, timeout,
  throttling, item grande, conflito/idempotência e erro desconhecido;
- dedup: janela 0, dentro/fora da janela, concorrência e fingerprint sem PII;
- process listeners/job runner: erros capturados e flush/fallback.

### 15.2 Integração/e2e sem serviços reais

- request autenticada GET e mutação com `actorId` correto;
- request pública conforme D-001;
- login/cadastro bem-sucedido sem token no log;
- 400/401/403/404/409/422/500 com observabilidade e auditoria corretas;
- upload sem buffer/nome original/conteúdo no log;
- erro S3/SMTP/Twilio/Google/MySQL mockado;
- uma única auditoria por request;
- correlação entre evento de auditoria e erro pelo `requestId`;
- seleção independente: file/file, file/dynamodb, dynamodb/file e
  dynamodb/dynamodb;
- startup falha para configuração inválida;
- shutdown drena conforme política.

### 15.3 Testes arquiteturais e de privacidade

- os 38 módulos atuais são descobertos pelo registry;
- todo controller, handler e provider do grafo está associado a um módulo;
- todo handler do inventário passa pelo guard/interceptor/filtro global sem
  decorator ou chamada manual;
- módulo, controller, provider ou rota nova entra automaticamente, e uma falha
  de descoberta reprova a suíte;
- nenhum controller/service/repository importa `WriteAuditEventService` ou
  provider de auditoria, salvo o hook central de identidade/boundary aprovado;
- `actionName` automático é estável e usa módulo/controller/handler reais;
- nenhum módulo de domínio importa SDK DynamoDB;
- nenhum controller chama provider de storage;
- nenhuma entidade TypeORM de log foi criada;
- nenhum `any` novo;
- snapshot/scan de fixtures assegura ausência de tokens, senha, e-mail, CPF,
  telefone, nomes de crianças/responsáveis, notas e conteúdo de arquivos;
- nenhum teste usa credenciais ou endpoint AWS real.

### 15.4 Performance e resiliência

Com limites definidos em D-016:

- carga concorrente no interceptor/logger;
- latência adicionada p50/p95/p99;
- memória com DynamoDB lento/indisponível;
- fila cheia/backpressure;
- retry storm e throttling;
- arquivos concorrentes e rotação;
- reinício com eventos pendentes;
- custo estimado de writes, índices, armazenamento, PITR e KMS.

## 16. Fases de implementação

### Fase 0 — Fechar requisitos e ameaça

1. Resolver D-001 a D-022 por escrito.
2. Nomear responsáveis de backend, infraestrutura, segurança/privacidade e
   operação.
3. Revalidar inventário de controllers, `catch`, loggers e jobs.
4. Aprovar matriz de dados permitidos/proibidos.
5. Aprovar SLO, volume, custo e garantia de entrega.

**Saída:** ADR/decisões assinadas; nenhuma pendência crítica.

### Fase 1 — Contratos e testes de arquitetura

1. Criar enums, tipos, constantes, ports e event builders.
2. Criar redactor/error normalizer e testes antes dos sinks.
3. Criar registry automático e testes de descoberta do grafo completo.
4. Criar validação das novas configurações.
5. Atualizar exemplos de env/documentação local.

**Saída:** contratos compilando e testes unitários, ainda sem alterar runtime.

### Fase 2 — Request context e correlação

1. Implementar `AsyncLocalStorage` e middleware.
2. Gerar/devolver `X-Request-Id`.
3. Implementar resolução de ator aprovada.
4. Testar concorrência, guards e fluxos públicos/auth.

**Saída:** contexto estável, sem persistência.

### Fase 3 — Providers de storage

1. Implementar file provider e retenção.
2. Adicionar SDK e implementar DynamoDB provider mockado.
3. Implementar dedup aprovado.
4. Implementar retries, limites, lifecycle e emergency sink.
5. Executar fault-injection unitária.

**Saída:** ports validados para todas as combinações de storage.

### Fase 4 — Observabilidade de erros

1. Instalar logger estruturado Nest com buffer de bootstrap.
2. Tornar `GlobalExceptionFilter` injetável via `APP_FILTER`.
3. Integrar processo, jobs e providers.
4. Auditar cada `catch` e `logger.error` existente.
5. Remover vazamento de PII das mensagens antigas no escopo.
6. Testar todos os tipos de erro e fallback.

**Saída:** todo caminho de erro conhecido tenta persistência técnica.

### Fase 5 — Auditoria de todas as ações

1. Instalar registry, guard/context e interceptor global sem alterar handler por
   handler.
2. Validar automaticamente todos os handlers da seção 9.3 e módulos da seção
   9.4.
3. Integrar falhas ao filtro sem dupla gravação.
4. Enriquecer login/cadastro/refresh conforme D-001.
5. Integrar atores de sistema/jobs conforme D-002.
6. Testar reads, mutations, falhas e negações.

**Saída:** cobertura automática comprovada por teste arquitetural e e2e.

### Fase 6 — Infraestrutura, IAM e deploy

1. Com autorização, criar/revisar CloudFormation.
2. Provisionar primeiro em staging.
3. Configurar TTL, criptografia, backup/proteção, tags, índices e alarmes.
4. Aplicar menor privilégio à EC2 role e ECS Task Role correta.
5. Injetar variáveis aprovadas nos workflows.
6. Validar com credenciais da workload, nunca pessoais.

**Saída:** staging grava/consulta conforme access patterns e alarmes funcionam.

### Fase 7 — Rollout controlado

1. Executar shadow/dual observation somente se aprovado; nunca duplicar
   auditoria sem identificador de rollout.
2. Injetar erros controlados em staging.
3. Confirmar ausência de PII com amostra autorizada.
4. Medir latência, taxa, throttling, custo e perdas.
5. Aprovar go/no-go e rollback.
6. Produção em canário/uma task, depois expandir.
7. Confirmar escrita por todas as réplicas e alarmes.

**Saída:** produção estável e evidências arquivadas.

### Fase 8 — Operação contínua

1. Runbook de busca por request/ator/recurso.
2. Runbook de indisponibilidade, throttling, fila cheia e disco cheio.
3. Revisão periódica de acesso e amostras de PII.
4. Revisão de TTL/custo/capacidade.
5. Teste de restore se PITR/backup estiver habilitado.
6. Verificação contínua de que a descoberta automática cobre cada rota, módulo
   e job novo, sem manutenção de catálogo no runtime.

## 17. Rollback

- Código deve permitir voltar o storage por variável somente entre opções
  previamente aprovadas.
- Rollback não pode desligar auditoria silenciosamente; deve gerar alerta e
  exigir autorização operacional.
- CloudFormation rollback não deve apagar tabela com auditoria; usar retenção e
  deletion protection conforme D-017.
- Não remover GSI/tabela no mesmo deploy em que a aplicação deixa de usá-lo;
  observar período de segurança.
- Se houver outbox, rollback preserva schema e eventos pendentes até drain.
- Arquivos locais materiais só podem ser removidos após confirmar retenção e
  backup; remoção deve ser recuperável quando possível.

## 18. Documentação a entregar com o código

- documento operacional de observabilidade;
- documento de auditoria/compliance e matriz de campos;
- ADR da garantia de entrega e desduplicação;
- schema versionado dos dois eventos;
- inventário de cobertura gerado automaticamente a partir do grafo/rotas;
- atualização de `docs/README.md` ou navegação decidida pelo mantenedor;
- atualização de `docs/error-handling.md` para correlation ID/captura, sem
  mudar o envelope sem decisão de contrato;
- atualização de `docs/implemented-rules.md` somente se auditoria alterar regra
  de domínio;
- `env/README.md` e três `.env.example`;
- infraestrutura/IAM/deploy/runbooks;
- exemplos de consulta e resposta, se D-008 aprovar API;
- registro dos resultados de carga, privacidade e fault injection.

## 19. Verificação final

Executar na ordem, inspecionando o diff após lint:

```bash
NODE_OPTIONS='--max-old-space-size=2048' npm run build
NODE_OPTIONS='--max-old-space-size=2048' npm test -- --runInBand
NODE_OPTIONS='--max-old-space-size=2048' npm run test:cov -- --runInBand
NODE_OPTIONS='--max-old-space-size=2048' npm run lint
git diff --check
git status --short
```

Também exigir:

- coverage >= 90% do novo escopo e branches relevantes;
- nenhuma alteração em `env/*.env` real;
- nenhuma credencial/dado pessoal no diff ou fixtures;
- nenhum acesso externo nos testes;
- nenhum arquivo de log/audit versionado;
- nenhuma migration TypeORM, salvo se a alternativa outbox for explicitamente
  aprovada e gerada pelo fluxo oficial;
- revisão de todos os arquivos modificados pelo lint;
- diff limitado ao resultado solicitado e preservação das alterações atuais do
  usuário.

## 20. Definition of Done

A entrega só está concluída quando:

1. todas as decisões D-001 a D-022 aplicáveis estão registradas;
2. todos os 38 módulos, seus componentes e todos os handlers atuais e futuros
   têm cobertura verificável pela instrumentação global;
3. identidade de ator segue a regra aprovada e nunca confia em input do cliente;
4. todos os caminhos de erro inventariados são capturados ou possuem limitação
   técnica formalmente aceita;
5. storage file e DynamoDB cumprem formato, TTL, dedup e falha definidos;
6. DynamoDB está provisionado com schema derivado dos access patterns, IAM de
   menor privilégio e controles aprovados;
7. nenhuma informação proibida aparece nos registros;
8. envelope/contratos públicos não mudaram sem aprovação;
9. testes funcionais, arquiteturais, privacidade, resiliência e performance
   passam;
10. runbooks, alarmes, responsáveis e rollback foram validados;
11. nenhum boilerplate de auditoria foi espalhado pelos módulos de domínio;
12. build, testes, cobertura, lint e inspeção final do diff passam.

## 21. Registro de decisões

Preencher sem apagar o histórico. Em 2026-09-05 a implementação foi executada
com os valores abaixo, **assumidos pelo implementador** na ausência de resposta
do solicitante; cada linha indica onde a decisão está codificada para que possa
ser revista sem arqueologia. Responsável: a pessoa que aprovar este diff.

| ID | Decisão | Responsável | Data | Evidência/link |
| --- | --- | --- | --- | --- |
| D-001 | Ação sem identidade validada é `actorType=anonymous`, `actorId=null`. Login, Google, refresh, cadastro e complemento anunciam o UUID ao contexto assim que o resolvem (`AuthService.announceActor`). Nunca se confia em `userId` de body/query/param. | assumido pela implementação | 2026-09-05 | `src/core/request-context/utils.ts` (`actorFromRequestUser`), `src/core/auth/services/auth.service.ts` |
| D-002 | Fronteiras auditadas: HTTP, jobs do `JobRunnerService` (via `ActionBoundaryService`), listeners de processo e bootstrap. Scripts em `scripts/` fora do Nest ficam fora desta entrega. | assumido | 2026-09-05 | `src/core/audit/services/action-boundary.service.ts`, `src/shared/scheduling/job-runner.service.ts` |
| D-003 | Tentativas também são auditadas: 401/403 `denied`, 400/409/422 `rejected`, 404 `not_found`, 5xx `failed`. **Somente mutações** (`POST`/`PUT`/`PATCH`/`DELETE`): leituras não geram evento, por decisão do solicitante em 2026-09-05 (revê "todas as ações, inclusive leituras" da seção 2.2). | solicitante (métodos) / assumido (resultados) | 2026-09-05 | `src/core/audit/utils/audit-event.utils.ts` (`outcomeFromStatus`) |
| D-004 | Agregação (opção 2): o primeiro evento de um fingerprint abre a janela e é gravado inteiro; os iguais dentro dela viram `audit_repeat` apontando para ele (contador no DynamoDB, linha própria em `file`). Nenhuma ação deixa de ser registrada. `0` desliga. | assumido | 2026-09-05 | `src/core/audit/services/audit-deduplication.service.ts`, `dynamodb-log-storage.provider.ts#writeRepeat` |
| D-005 | Somente metadados. Sem `changedFields`, sem valores anteriores/posteriores, sem snapshots. | assumido | 2026-09-05 | `src/core/audit/types.ts` |
| D-006 | *Best effort*: fila limitada (1000), escrita assíncrona, timeout 3 s, 1 retry em erro transitório, descarte contado, drenagem de 5 s no shutdown, emergência em stderr. A request nunca espera nem falha pelo storage. Sem outbox MySQL. | assumido | 2026-09-05 | `src/shared/providers/log-storage/delivery/log-delivery-queue.ts`, `constants.ts` |
| D-007 | `LOG_DYNAMODB_TABLE_NAME` (uma tabela por ambiente) e `LOG_DYNAMODB_ENDPOINT` (só DynamoDB Local). Região em `AWS_REGION`. | assumido | 2026-09-05 | `src/shared/providers/log-storage/constants.ts` (`LogStorageEnv`) |
| D-008 | API administrativa somente leitura para `admin`: `GET /log-records/observability` e `GET /log-records/audit`, paginação `page`/`limit` com `total`/`pageCount` (envelope `Paginated<T>`; o cursor opaco inicial foi substituído a pedido do solicitante em 2026-09-05, porque a tela precisa do total e do número de páginas), intervalo obrigatório de até 31 dias, filtros allowlisted. **Exclusão** de item (`DELETE .../:eventId?occurredAt`) e de intervalo (`DELETE ...?from&to`) adicionada a pedido do solicitante em 2026-09-05, revendo "nenhuma rota de exclusão"; a chamada é auditada. Com storage `file` a API responde `409 LOG_9101`: os JSONL são só para análise. Access patterns: por intervalo+tipo (PK por dia) e por `requestId` (GSI esparso). Sem GSI de ator/recurso: `actorId` é filtro dentro do intervalo. Consumidor humano: tela do frontend em `/adm/observabilidade-auditoria`. | assumido | 2026-09-05 | `src/core/log-records/`, `docs/observability-audit.md` §6 |
| D-009 | `AUDIT_TTL_DAYS=1` é valor local inicial, não retenção de compliance. O exemplo de produção sugere 365 (auditoria) e 30 (técnico); política final pendente do negócio. | assumido | 2026-09-05 | `env/prod.env.example` |
| D-010 | JSONL com extensão `.jsonl`, um objeto por linha, arquivo por dia UTC e processo. | assumido | 2026-09-05 | `file-log-storage.provider.ts`, `FILE_EXTENSION` |
| D-011 | Persistem `error` e `fatal`. `warn`, `log`, `debug`, `verbose` só no stdout (um 4xx já fica na auditoria com código). | assumido | 2026-09-05 | `src/core/observability/constants.ts` (`PERSISTED_LOG_LEVELS`) |
| D-012 | Stack é armazenada em todos os ambientes, sanitizada: cabeçalho redigido, caminhos relativos à raiz, até 20 frames, 8 KB. Mesma retenção do fluxo técnico. Não sai na API de listagem. | assumido | 2026-09-05 | `stack-location.utils.ts`, `mappers.ts` |
| D-013 | IP e User-Agent não são registrados. | assumido | 2026-09-05 | nenhum campo no contrato |
| D-014 | "Contexto de arquivos" = arquivo/linha/coluna do primeiro frame interno do stack. Metadados de upload (nome original, conteúdo, URL) estão na denylist. | assumido | 2026-09-05 | `SENSITIVE_KEYS` |
| D-015 | Sim: `StructuredLoggerService` estende `ConsoleLogger`; stdout/stderr continuam como antes e o storage é adicional. | assumido | 2026-09-05 | `structured-logger.service.ts` |
| D-016 | Limites: evento 64 KB, string 2 KB, mensagem 1 KB, metadata profundidade 3 / 20 chaves / 20 itens, 20 frames, fila 1000, timeout 3 s, 1 retry, 1 shard por dia (sem `SHARD#n` na chave até haver volume medido). Sem SLO de latência medido nesta entrega. | assumido | 2026-09-05 | `constants.ts` dos dois módulos |
| D-017 | Não decidido em código: criptografia, PITR, deletion protection e tags são da infraestrutura, não entregue. | pendente | | §11.5 |
| D-018 | Não decidido: sem alarme/canal. O sinal disponível é `[log-storage]` no stderr e `stats()` das filas. | pendente | | `docs/observability-audit.md` §7 |
| D-019 | `/health` e demais `GET` **não** são auditados (só mutações). Rotas de mutação com handler são auditadas normalmente. 404 sem handler vira `http.unmatched.<METHOD> <rota sanitizada>`. Preflight `OPTIONS` é respondido pelo CORS antes do roteador e não é auditado. | assumido | 2026-09-05 | `unmatchedRouteName` |
| D-020 | `resourceId` só de params allowlisted (`id`, `clubId`, `teacherId`, `coordinatorId`, `fromCoordinatorId`, `pageId`, `childId`, `key`) ou do `id` tipado do resultado em `POST`; UUIDs de criança/responsável/mídia entram como identificador técnico, sem nome. | assumido | 2026-09-05 | `SAFE_RESOURCE_ID_PARAMS` |
| D-021 | Infraestrutura (CloudFormation, IAM, workflows) **não** entregue nem executada; código pronto para `dynamodb`. Desenvolvimento usa DynamoDB Local via Docker (`run.sh`), com tabela criada pelo script `dynamodb:local:ensure-table`/provisioner (só com endpoint local). A policy de produção precisa de `PutItem`, `UpdateItem`, `GetItem`, `Query`, `DeleteItem`, `BatchWriteItem` na tabela e `Query` no índice. Risco registrado: sem as variáveis no deploy, o padrão é `file` em container sem volume — os registros seriam efêmeros até a tabela existir. | pendente | | §11.5, `env/prod.env.example` |
| D-022 | Uma tabela física por ambiente, nome por `LOG_DYNAMODB_TABLE_NAME`; conta/região da própria workload (`AWS_REGION`). `environment` também vai como atributo. | assumido | 2026-09-05 | `dynamodb-client.provider.ts` |

### 21.1 Desvios documentados em relação ao plano

- O registry de componentes ficou em `src/core/request-context/discovery/`
  (não em `src/core/audit/discovery/`): o logger estruturado também precisa
  dele para resolver o módulo de cada `context`, e observabilidade não pode
  depender de auditoria.
- `registerRepeat` não existe na porta: a repetição viaja como registro
  `audit_repeat` pela mesma fila, o que preserva a ordem em relação ao primeiro
  evento.
- O filtro global é registrado por `APP_FILTER` no `AuditModule` (e não no
  módulo raiz) porque é ali que vivem os serviços que ele recebe por injeção.
- Variáveis ausentes recebem o padrão em vez de derrubar o boot (§12.3
  previa falha): os arquivos reais `env/*.env` e os workflows de deploy não
  possuem as variáveis, e derrubar produção por isso não era aceitável sem
  autorização.
