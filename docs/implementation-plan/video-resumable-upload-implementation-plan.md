# Plano de Implementação Backend/Frontend — Upload de vídeo pesado, retomável, passando pela API

**Status:** plano (revisão 2, 2026-11-22). Nenhuma alteração de código, infraestrutura, banco, dependência ou ambiente está autorizada por este documento.

**Escopo:** `clubinhonib-api` (principal) e `clubinhonib-app` (contrato e telas).

**Independência:** este documento é **autossuficiente**. Não depende de nenhum outro plano, não exige que outro plano seja implementado antes ou depois e pode ser entregue, testado e revertido sozinho (ver §0.2).

---

## 0. Contrato de precisão — zero suposições

Classificação obrigatória de cada afirmação:

- **FATO:** verificado no código/infra do repositório (arquivo e símbolo/linha) ou na documentação/código-fonte **do pacote na versão citada**, lido nesta revisão.
- **RISCO:** consequência possível, sem prova de ocorrência. Nunca apresentada como incidente.
- **PLANEJADO:** trabalho derivado de um FATO. Não é comportamento atual.
- **DECISÃO PENDENTE:** o código e o pedido não determinam. Escolher só com aprovação explícita; nenhum item dependente pode ser implementado por escolha implícita.
- **NÃO VERIFICADO:** hipótese que exige um teste/spike antes de qualquer implementação (§11). Não é base de decisão.

Cada implementação deve ligar **achado → arquivos → contrato → teste → aceite**.

### 0.1 Requisito confirmado pelo solicitante
1. O vídeo **precisa passar pela API** (front → API → S3). Upload direto do navegador ao S3 (URL pré-assinada) está **descartado**.
2. O upload de um vídeo de ~200 MB **não pode quebrar, travar nem ser perdido**.
3. A solução deve ser baseada em **melhores práticas pesquisadas na web**.

### 0.2 Independência e fronteira de escopo
- **Entrada:** o contrato atual de `POST/PATCH /video-pages` (§1). Nada além disso é pressuposto.
- **Saída:** o mesmo registro `media_items` que o fluxo atual já produz (`url`, `size`, `originalName`, `isLocalFile = true`, `uploadType = upload`). Quem lê o vídeo (qualquer tela, qualquer API) **não percebe diferença** e **não precisa mudar**.
- **Dentro do escopo:** enviar o arquivo com segurança e retomada, validar tipo/tamanho, limpar temporários, salvar a página referenciando o upload.
- **Fora do escopo (não tratado, não pressuposto):** como o vídeo é exibido ou listado; como a URL do arquivo é entregue ao leitor (a URL gravada continua sendo a do S3, exatamente como hoje); categorização/curadoria; autorização de leitura.
- **Coexistência:** se outra mudança também estender `POST/PATCH /video-pages`, os campos são disjuntos e se somam. O único ponto de contato é o DTO do item de vídeo (§5.8): se um DTO específico de vídeo já existir, apenas acrescentar o campo `uploadId`; se não existir, criá-lo. Isso é uma regra de merge, **não uma dependência**.
- **Reversão:** feature flag própria (§8) e fluxo antigo preservado (U-012).

### 0.3 Retratações da revisão 1 (afirmações que estavam erradas ou sem base)
| # | Afirmação da rev. 1 | Situação |
|---|---|---|
| R1 | "O ALB tem `idle_timeout=60 s`; um POST de 200 MB pode ser cortado" | **Retratada.** `idle_timeout` mede inatividade da conexão, não a duração do envio. Enquanto há bytes fluindo, não dispara (comportamento documentado pela AWS para ALB — **conferir na doc oficial antes de depender disto**, §11-N4). O risco real é o oposto: uma requisição em que o servidor fica **60 s sem enviar bytes** (ex.: um `CopyObject` síncrono longo dentro do `POST /video-pages`). |
| R2 | "Infra provável ECS / containers com autoscaling; 2+ instâncias" | **Retratada.** A infra é **uma EC2 por ambiente** atrás de um ALB, sem Auto Scaling (§1, F-INF-1/2). |
| R3 | Lista de permissões IAM "revisar" (inclusive `CreateMultipartUpload` como ação própria) | **Retratada e refeita** a partir dos comandos que o `@tus/s3-store` realmente chama (§7.5). |
| R4 | "`chunkSize` de 8 MB no cliente" | **Retratada.** A doc do `tus-js-client` diz para **não** definir `chunkSize` exceto em casos específicos (§2). Vira decisão U-003. |
| R5 | "Status `VALIDATED` guardado nos metadados do objeto S3" | **Retratada.** O `S3Store` guarda o estado em um objeto `<id>.info`; não há campo para marcar "validado" depois do término (§2, E-6). Adoção passa a **revalidar** o objeto (§7.7). |
| R6 | "Retomada independe de RAM/disco" | **Retratada.** O `S3Store` grava cada parte em **arquivo temporário no disco local** (`os.tmpdir()`) antes de enviá-la (§2, E-5). Disco do container passa a ser requisito dimensionado. |
| R7 | "Sem restrição de tipos de pacote" | **Retratada.** `@tus/server` e `@tus/s3-store` são **ESM-only** e o projeto é `module: commonjs` + Jest/ts-jest (§1 F-BLD-1, §2 E-7). Exige spike (§11-N1). |

---

## 1. Evidências do repositório (FATOS)

### 1.1 Fluxo atual de upload de vídeo da galeria
| ID | Fato | Evidência |
|---|---|---|
| F-UP-1 | `POST /video-pages` e `PATCH /video-pages/:id` usam `AnyFilesInterceptor()` **sem opções** (sem `limits`, sem `storage`). | `src/modules/pages/video-page/video-page.controller.ts:49` e `:63` |
| F-UP-2 | Não há `MulterModule` global nem `memoryStorage`/`diskStorage` configurados em `src/`. Logo vale o padrão do multer instalado (`1.4.5-lts.1`): **sem `dest`/`storage`, os arquivos ficam em memória (`file.buffer`)**. O `AwsS3Service.upload` lê `file.buffer`. | `grep MulterModule\|memoryStorage\|diskStorage src/` → nenhum resultado; `shared/providers/aws/aws-s3.service.ts` `upload()` (`Body: file.buffer`) |
| F-UP-3 | Já existe precedente de limites em outro módulo: `image-section.controller.ts:57,105` usam `AnyFilesInterceptor({ limits: CLUBINHO_UPLOAD_LIMITS })`; `CLUBINHO_MAX_VIDEO_BYTES = 100 * 1024 * 1024`; formatos `video/mp4→mp4`, `video/webm→webm`. `ideas-section` repete `IDEAS_SHARE_MAX_VIDEO_BYTES = 100 MiB`. **A galeria de vídeos não tem nenhuma dessas validações.** | `image-section/constants.ts:30-34,48-49`; `ideas-section/constants.ts:32,35,59-60` |
| F-UP-4 | O upload ao S3 é um único `PutObjectCommand` com `ContentType: file.mimetype` (valor enviado pelo cliente). | `aws-s3.service.ts` `upload()` |
| F-UP-5 | Cada arquivo enviado é registrado em `S3UploadTracker`; falha na criação/atualização apaga os não referenciados via `MediaItemProcessor.discardUnreferencedUploads`; arquivos removidos/substituídos só são apagados **depois do commit**. Não existe tratamento para upload **abandonado** (antes de salvar a página). | `shared/media/s3-upload-tracker.ts`; `create-video-page.service.ts`; `update-video-page.service.ts` (`removedUrls`, `discardUnreferencedUploads` após `runInTransaction`) |
| F-UP-6 | Na atualização, o vídeo mantido preserva `url`, `originalName`, `size` do **registro**, não do payload; `media.id = previous.id` (IDs de vídeo são estáveis). | `update-video-page.service.ts`, `updateExistingVideo` |
| F-UP-7 | O front monta `FormData`: JSON em `videosPageData` e arquivos em `video-file-<índice>`; timeout `VIDEO_PAGE_SAVE_TIMEOUT_MS = 300_000`. | `clubinhonib-app/src/features/video-pages/{utils.ts,api.ts,constants.ts:57}` |
| F-UP-8 | `AwsS3Service` só expõe `upload(file)`, `delete(url)`, `extractKey(url)`, `downloadOwned(url,max)`. **Não há** `HeadObject`, `CopyObject`, leitura com `Range` nem exclusão por chave. | `aws-s3.service.ts` |

### 1.2 Infraestrutura
| ID | Fato | Evidência |
|---|---|---|
| F-INF-1 | A API roda em **EC2** (um recurso `AWS::EC2::Instance` por ambiente: `InstanceStaging`, `InstanceProd`), cada uma registrada em seu Target Group. **Não há ECS nem Auto Scaling no template.** | `cloudformation/infrastructure/ec2-stack.yaml:323,333` e `TargetGroup*` |
| F-INF-2 | Tipo de instância nos parâmetros efetivos: `t3.micro` (staging e prod). | `cloudformation/infrastructure/ec2-params.json:39-44` |
| F-INF-3 | O container é iniciado com `docker run -d --name clubinho-nib-api --restart unless-stopped -p 80:3000 -p 3000:3000 --env-file …`. Sem limites de memória/disco declarados no comando. | `cloudformation/infrastructure/deploy-complete.sh:293` |
| F-INF-4 | Não há nginx/proxy reverso próprio: ALB → porta 3000. | `ec2-stack.yaml` (`TargetGroup*` porta 3000); `grep nginx` → nenhum |
| F-INF-5 | ALB: `idle_timeout.timeout_seconds = 60`; HTTP/2 habilitado; health check `/health` a cada 60 s. | `ec2-stack.yaml:153-155,167-171` |
| F-INF-6 | IAM da instância no S3: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` (bucket e `/*`). **Nenhuma** ação de multipart além das cobertas por `PutObject`. | `ec2-stack.yaml:112-115` |
| F-INF-7 | Bucket: `PublicAccessBlockConfiguration` com `BlockPublicAcls: false`, `BlockPublicPolicy: false`; **única** regra de lifecycle = transição para `STANDARD_IA` aos 30 dias. **Não há** `AbortIncompleteMultipartUpload` nem expiração por prefixo. CORS: métodos `GET, PUT, POST, DELETE, HEAD`, `AllowedOrigins: *`, `ExposedHeaders: ETag`. | `cloudformation/s3/stack.yaml:40-41,50-57,59-72` |
| F-INF-8 | Imagem Docker: `FROM node:22-alpine` (tag flutuante), `CMD ["node","dist/src/main.js"]`; instala LibreOffice. | `clubinhonib-api/DockerFile:2,11,18,40` |
| F-INF-9 | Tipo de instância t3.micro tem 1 GiB de RAM (especificação pública da AWS para o tipo — não está no repositório). **Tamanho do volume EBS: NÃO VERIFICADO** (não consta nos templates lidos). | — |

### 1.3 Aplicação (autenticação, CORS, pipeline)
| ID | Fato | Evidência |
|---|---|---|
| F-APP-1 | `JWT_EXPIRES_IN=1h` em prod; `7d` em `env/local.env`. Existe `POST /auth/refresh` com refresh token. O app tem interceptor axios com renovação (`/auth/refresh`) com singleton de promessa. | `env/prod.env:22`; `auth.controller.ts:69`; `auth.service.ts:95`; `clubinhonib-app/src/config/axiosConfig.ts:89,113-226` |
| F-APP-2 | `main.ts`: só `useBodyParser('json', {limit})`, `enableCors({ origin: true, methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', credentials: true })` — **sem** `exposedHeaders`/`allowedHeaders`; `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`). | `src/main.ts:18-36` |
| F-APP-3 | Auditoria global: `AuditInterceptor` (APP_INTERCEPTOR) usa só `request.user`, `request.method`, `request.originalUrl`, `response.statusCode` e o **resultado** do handler (`extractIdFromResult` em POST); **não lê o corpo**. Também há `AutomaticActionContextGuard` (APP_GUARD) e `GlobalExceptionFilter` (APP_FILTER). | `core/audit/audit.module.ts:27-29`; `core/audit/interceptors/audit.interceptor.ts` |
| F-APP-4 | NestJS `11.0.11` com Express `5.0.1`. O adapter registra `express.json()` e `express.urlencoded()` — nenhum parser para `application/offset+octet-stream`. | `node_modules/@nestjs/*/package.json`; `platform-express/adapters/express-adapter.js:182-189` |
| F-APP-5 | Não há `ThrottlerModule` no projeto (`grep Throttler src/` vazio). | — |

### 1.4 Build/testes
| ID | Fato | Evidência |
|---|---|---|
| F-BLD-1 | `tsconfig`: `module: commonjs` (sem `moduleResolution` explícito). Jest 29 com `ts-jest`, `rootDir: src`, sem `transformIgnorePatterns`. `@aws-sdk/client-s3` instalado: `3.758.0`. | `tsconfig.json`; `package.json` (`jest`); `node_modules/@aws-sdk/client-s3/package.json` |

---

## 2. Evidências externas (FATOS, lidos nesta revisão)

Fontes: pacotes npm baixados e inspecionados (`@tus/server@2.4.7`, `@tus/s3-store@2.1.0`, `tus-js-client@4.3.1` — versões `latest` em 2026-11-22), README e código-fonte `dist/index.js`; documentação `docs/api.md` do `tus-js-client`.

| ID | Fato |
|---|---|
| E-1 | `@tus/server` e `@tus/s3-store` exigem `node >= 20.19.0`; `@tus/s3-store` depende de `@aws-sdk/client-s3 ^3.1045.0` (o projeto usa `3.758.0` instalado; `package.json` declara `^3.758.0`) → **atualização do SDK será necessária ou resolvida pelo npm**. |
| E-2 | `S3Store` implementa as extensões Creation, Creation With Upload, Expiration, Termination. **Não** implementa Checksum nem Concatenation. |
| E-3 | Opções do `Server` (README): `path`, `maxSize` (`number` ou `(req,id)=>…`), `allowedOrigins`, `allowedCredentials`, `allowedHeaders`, `exposedHeaders`, `relativeLocation`, `respectForwardedHeaders`, `generateUrl`, `getFileIdFromRequest`, `namingFunction(req, metadata)`, `locker`, `disableTerminationForFinishedUploads`, `onUploadCreate(req, upload) → {metadata?}`, `onUploadFinish(req,res,upload) → {status_code?,headers?,body?}`, `onIncomingRequest(req, uploadId)`, `onResponseError`. Hooks podem `throw { status_code, body }`. |
| E-4 | `server.handle(req: http.IncomingMessage, res: http.ServerResponse)` integra a servidor Node existente; converte para `Request/Response`; o objeto Node continua acessível em `req.runtime.node.req/res`. O exemplo oficial para Express usa `uploadApp.all("*", server.handle.bind(server))`. |
| E-5 | **Cada `PATCH` é dividido em partes que são primeiro gravadas em arquivo temporário em `os.tmpdir()` (`StreamSplitter` com `directory: os.tmpdir()`) e depois enviadas ao S3 com `uploadPart`.** Concorrência limitada por `maxConcurrentPartUploads` (padrão **60**, via `Semaphore`); `partSize` é a parte **preferida** (mín. 5 MiB, máx. 5 GiB; o servidor pode aumentá-la para respeitar 10 000 partes). Uso de disco por upload ativo ≈ `partSize × partes simultâneas`. |
| E-6 | Estrutura no S3: um objeto `<id>.info` (JSON do upload; `Metadata`: `upload-id`, `tus-version`), um multipart em andamento e, ao terminar, o objeto final com chave `<id>`. O `.info` **não é apagado** ao concluir. Metadados do upload só viram metadados do objeto final em ASCII (não-ASCII vira `?`); as chaves `contentType`, `cacheControl`, `contentEncoding` são repassadas como headers do objeto. |
| E-7 | **Ambos os pacotes são ESM-only** (`"type": "module"`, `exports: "./dist/index.js"`). O projeto é CommonJS; carregar exige `require(esm)` do Node (≥20.19/≥22.12) e o Jest/ts-jest não transforma `node_modules` ESM por padrão. |
| E-8 | Comandos de S3 chamados pelo `S3Store` (contagem no código): `putObject` (3), `getObject` (3), `headObject` (1), `createMultipartUpload` (1), `uploadPart` (1), `completeMultipartUpload` (1), `abortMultipartUpload` (2), `listParts` (1), `listMultipartUploads` (1), `deleteObject` (1), `deleteObjects` (2). O `putObject` usa `Tagging` **somente** se `expirationPeriodInMilliseconds ≠ 0` e `useTags = true`. |
| E-9 | `options.cache` padrão = `MemoryKvStore`; `options.locker` padrão = `MemoryLocker`. A doc diz que **com várias instâncias** é necessário cache/locker compartilhado; com instância única a configuração padrão é a descrita como suficiente. |
| E-10 | Expiração: com `expirationPeriodInMilliseconds`, uploads expirados retornam **410 Gone**; o store marca `Tus-Completed=false|true` nos objetos (incl. `.part` e `.info`) e a doc sugere uma regra de lifecycle por **tag** `Tus-Completed=false` com `Expiration`. A doc também recomenda lifecycle de **abortar multiparts incompletos**, porque partes em curso podem sobreviver a um `abort`. |
| E-11 | Doc do `tus-js-client`: `chunkSize` padrão `Infinity` (o arquivo todo em **um** `PATCH`); **"Do not set this value, unless you are being forced to"** — só quando há limite de corpo em proxy/CDN, ou entrada por stream; chunk pequeno (< alguns MB) degrada a performance; o S3 impõe mínimo de 5 MB. `retryDelays` padrão `[0,1000,3000,5000]`. `headers` fixos; `onBeforeRequest(req)` pode devolver `Promise` e roda **antes de cada requisição**. `metadata` só é enviada na criação. `storeFingerprintForResuming` padrão `true`; `findPreviousUploads()` e `resumeFromPreviousUpload()` existem. |
| E-12 | Doc do `@tus/server` (nginx): é preciso **desabilitar buffering de requisição** e ajustar limite de tamanho de corpo em proxies, e usar `respectForwardedHeaders` quando há proxy reverso que altera o host/esquema. |

---

## 3. Diagnóstico — modos de falha reais (derivados dos FATOS)

| ID | Modo de falha | Base |
|---|---|---|
| M-1 | Pico de **RAM** da API = Σ tamanho dos arquivos de cada requisição simultânea (buffer em memória) + a cópia do `Body` do SDK. Em instância de 1 GiB (F-INF-2/9), 2–3 vídeos de 200 MB podem esgotar a memória. É **RISCO** (não medido). | F-UP-1, F-UP-2, F-INF-2, F-INF-9 |
| M-2 | **Perda total** se a conexão cair em qualquer ponto do `POST/PATCH`: o arquivo e a própria gravação da página dependem de uma única requisição. | F-UP-1, F-UP-7 |
| M-3 | **Arquivo arbitrário** (tipo e tamanho) aceito na galeria; `ContentType` vem do cliente. | F-UP-3, F-UP-4 |
| M-4 | **Órfãos por abandono** (usuário envia e não salva) sem expiração no bucket. | F-UP-5, F-INF-7 |
| M-5 | Deploy (`docker run` novo container) **interrompe** requisições em curso; hoje isso derruba o upload inteiro. | F-INF-3 |
| M-6 | Token de acesso de **1 h** (prod): uma requisição de longa duração não é reautenticada no meio, mas cada **retentativa** é nova requisição e precisa de token válido. | F-APP-1 |

---

## 4. Decisões pendentes (trava de decisões)

Nenhum item dependente pode ser implementado sem estas aprovações. A coluna "Sugestão" é apenas recomendação técnica; **não é decisão**.

| ID | Decisão | Opções | Sugestão / justificativa |
|---|---|---|---|
| **U-001** | Mecanismo de upload retomável | **(A)** `@tus/server` + `@tus/s3-store` (E-2…E-12). **(B)** Protocolo próprio sobre `@aws-sdk/lib-storage` (multipart em stream) com sessão e *resume* implementados internamente. | (A): retomada, offset, terminação e expiração já implementadas e documentadas. Custo: dependência ESM-only (E-7) e disco temporário (E-5). (B) exigiria projetar e testar resumo e estado — mais código próprio. |
| **U-002** | Tamanho máximo por vídeo | 200 MB / 500 MB / 1 GB / outro | O pedido cita ~200 MB. **Valor a definir.** Deve valer também para `maxSize` do tus (E-3). |
| **U-003** | `chunkSize` do cliente | **(A)** padrão `Infinity` (um `PATCH`, recomendado pela doc, E-11). **(B)** valor finito. | (A) como ponto de partida; (B) só se o spike §11-N3 mostrar falha de corpo único no ALB/EC2 ou se se quiser limitar o trabalho perdido por queda. Medir antes. |
| **U-004** | `partSize` do `S3Store` | 5 / 8 / 16 MiB | Impacta disco temporário (E-5). README usa 8 MiB nos exemplos. **Valor a definir após medir disco/RAM (N2).** |
| **U-005** | `maxConcurrentPartUploads` | 1–4 / padrão 60 | O padrão 60 foi pensado para 3,84 Gbit/s (README). Para t3.micro, o valor deve ser **baixo e medido**; define o teto de disco/RAM. |
| **U-006** | Formatos aceitos | `video/mp4`+`video/webm` (mesmo de `image-section`/`ideas-section`) / acrescentar `video/quicktime` | Alinhar com o restante do sistema (F-UP-3). |
| **U-007** | Onde o upload fica até a página ser salva | **(A)** prefixo temporário `<env>/tmp/uploads/` e **cópia** (`CopyObject`) para `<env>/uploads/…` ao salvar. **(B)** gravar direto no prefixo final e expirar por tag os não reivindicados. | (A) separa o que é definitivo; custo: `CopyObject` síncrono (RISCO: >60 s sem bytes na resposta; medir). (B) evita a cópia, mas mistura rascunhos com definitivos e exige regra de lifecycle por tag no prefixo definitivo. |
| **U-008** | Expiração de upload não reivindicado | 24 h / 48 h / 7 d | Define `expirationPeriodInMilliseconds` e a regra de lifecycle. Exige `s3:PutObjectTagging` (E-8) — ver U-009. |
| **U-009** | Usar tags (`useTags`) do S3Store | **(A)** sim (habilita lifecycle por tag `Tus-Completed`, E-10; exige IAM de tagging). **(B)** `useTags:false` e limpar por **prefixo** + idade. | Só **(A)** ou **(B)** depois de definir U-007/U-008. |
| **U-010** | Verificação de conteúdo | só `Content-Type`/extensão / + assinatura de bytes (magic bytes) lida com `Range` | Extensão/`Content-Type` são informados pelo cliente (F-UP-4). |
| **U-011** | Retomada entre sessões do navegador | só na sessão / persistente (`storeFingerprintForResuming` + `findPreviousUploads`) | Funcionalidade nativa (E-11). |
| **U-012** | Fluxo antigo (`multipart` em `/video-pages`) | manter / remover / manter atrás de flag | Definir prazo. Independe do tus. |
| **U-013** | Rate limit dos endpoints de upload | com/sem; valor | Não há `Throttler` (F-APP-5). Decisão própria deste plano. |
| **U-014** | Montagem do handler no Nest | **(A)** controller Nest com guards (`@All`) chamando `server.handle`. **(B)** middleware Express montado em `main.ts` com autenticação **dentro** de `onIncomingRequest` (JWT verificado manualmente). | (A) mantém `JwtAuthGuard`/`AdminRoleGuard` e auditoria (F-APP-3). (B) isola do pipeline Nest. Escolher após o spike §11-N5. |
| **U-015** | Quem pode enviar | só `admin` (como `POST /video-pages`) / outros perfis | Hoje a escrita de vídeo é só admin (`AdminRoleGuard`). |

---

## 5. Desenho técnico (condicionado às decisões)

> Seguir `CLAUDE.md`/`AGENTS.md`: controller só HTTP; serviço por operação (create/get/update/delete); persistência só em repository; integração externa em **provider**; DTOs de entrada/saída; `types`/`constants`/`utils`/enums em arquivos próprios; **nunca `any`**; um serviço de módulo A nunca chama repository de módulo B.

### 5.1 Visão geral (condicionada a U-001=A, U-007=A, U-014=A)
```text
App ──tus (POST/HEAD/PATCH)──► API Nest (/uploads/videos)
        Authorization: Bearer <JWT>     ├─ JwtAuthGuard + AdminRoleGuard
                                        ├─ onUploadCreate: valida (tamanho, tipo, metadados) e grava userId
                                        ├─ S3Store: parte → arquivo temp em disco → uploadPart (S3)
                                        └─ onUploadFinish: HeadObject + magic bytes; recusa e apaga se inválido
        S3: <env>/tmp/uploads/<id> (+ <id>.info, multipart)

App ──PATCH /video-pages/:id (JSON com uploadId)──► API
        valida dono+existência+tamanho+tipo → CopyObject tmp→<env>/uploads/… → transação do banco
        → (após commit) apaga <id> e <id>.info temporários
```

### 5.2 Módulo de upload (API)
Estrutura PLANEJADA (nomes finais a confirmar no spike §11-N5), em `src/shared/media/uploads/` (compartilhado, pois o plano de ideias/imagens poderá reutilizar):
- `video-upload.controller.ts` — HTTP. `@All` para a base e para o sub-caminho. Sintaxe de rota do **Express 5** (F-APP-4) exige curinga nomeado (`*path`), **a confirmar em teste** (N5).
- `services/` — `create-upload-policy.service.ts`/`validate-finished-upload.service.ts`/`claim-video-upload.service.ts` (um por operação).
- `providers/tus-server.provider.ts` — instancia `Server` e `S3Store`; é o **único** ponto que importa o pacote ESM (isolamento para o Jest, E-7).
- `constants.ts`, `types.ts`, `utils.ts` (sanitização do nome, parsing de metadados, assinaturas de bytes), `enums/`.
- Extensões em `AwsS3Service` (provider existente): `head(key)`, `readRange(key, start, end)`, `copy(sourceKey, destKey)`, `deleteByKey(key)` (hoje inexistentes: F-UP-8). O `delete(url)` atual continua para as URLs definitivas.

### 5.3 Hooks do `Server` (assinaturas conforme E-3)
- `maxSize` = valor de U-002.
- `namingFunction(req, metadata)`: retorna `<env>/tmp/uploads/<uuid>` gerado **no servidor**; nunca derivado de entrada do cliente. (A doc exige unicidade; `crypto.randomUUID()`.)
- `onIncomingRequest(req, uploadId)`: **defesa em profundidade** além do guard (negar se `req.user` ausente) — **não substitui** o guard em U-014=A.
- `onUploadCreate(req, upload)`: valida `upload.size` (obrigatório e ≤ U-002), `filetype` ∈ U-006, `filename` presente e sanitizado; devolve `{ metadata: { ...upload.metadata, userId, contentType } }` (a doc permite devolver `metadata` mesclado). Erros por `throw { status_code, body }`.
- `onUploadFinish(req, res, upload)`: chama `head` (tamanho == `upload.size`) e `readRange` (magic bytes, se U-010 incluir). Se inválido: apaga o objeto e responde com erro (`throw { status_code, body }`).
- `onResponseError(req, err)`: log estruturado sem dados pessoais.
- `allowedOrigins`/`allowedCredentials`/`exposedHeaders`: **conflito possível** com o `enableCors` do Nest (F-APP-2) — **NÃO VERIFICADO** (N6). O `Location`, `Upload-Offset` e `Upload-Length` precisam estar legíveis pelo navegador.
- `respectForwardedHeaders: true`, porque o ALB termina TLS e encaminha ao container por HTTP (F-INF-4,5) — sem isso o `Location` pode sair com `http://` (E-12).

### 5.4 `S3Store`
- `s3ClientConfig`: `bucket`, `region`; credenciais pelo SDK (mesma resolução do `AwsS3Service`: IAM da instância/variáveis, F-INF-6).
- `partSize` (U-004), `maxConcurrentPartUploads` (U-005), `expirationPeriodInMilliseconds` (U-008), `useTags` (U-009).
- `cache`/`locker`: padrão em memória é suficiente **somente** enquanto houver **uma instância por ambiente** (F-INF-1, E-9). Qualquer escala horizontal exige repensar (registrar como restrição).
- **Disco temporário** (E-5): partes ficam em `os.tmpdir()` do container (F-INF-3, sem volume dedicado). Teto ≈ `partSize × maxConcurrentPartUploads × uploads simultâneos`. **Volume EBS desconhecido (F-INF-9)** → definir após medir (N2).

### 5.5 Variáveis de ambiente (PLANEJADO, nomes a aprovar)
Limite de tamanho, `partSize`, concorrência e expiração via `ConfigService` + `env/*.env.example` + `env/README.md`; **sem** valores fixos no código além dos defaults documentados.

### 5.6 IAM (derivado de E-8; **exige autorização**; fonte AWS a conferir: "Multipart upload API and permissions")
Adicionar ao role da instância (hoje `GetObject/PutObject/DeleteObject/ListBucket`, F-INF-6):
- `s3:AbortMultipartUpload` (ação de `abortMultipartUpload`);
- `s3:ListMultipartUploadParts` (ação de `listParts`);
- `s3:ListBucketMultipartUploads` no **bucket** (`listMultipartUploads`);
- `s3:PutObjectTagging` e `s3:GetObjectTagging` **somente se** U-009=A (E-8: `Tagging` no `putObject`);
- `CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload` e `CopyObject` (origem/destino) são cobertos por `s3:PutObject`/`s3:GetObject` — **conferir na doc AWS** antes de aplicar (N7).

### 5.7 Infra do bucket (**exige autorização**)
Hoje só existe `MoveToStandardIA` (F-INF-7). Acrescentar, **conforme U-007/U-008/U-009**:
- regra de `AbortIncompleteMultipartUpload` (dias a definir) — recomendada pela doc do store (E-10);
- expiração do prefixo `<env>/tmp/uploads/` (U-007=A) **ou** regra por tag `Tus-Completed=false` (U-009=A, E-10).
- O `.info` não é apagado ao concluir (E-6): a regra de expiração do prefixo temporário o remove; **no prefixo definitivo (U-007=B) ele ficaria para sempre** — ponto contra (B).
- CORS do **bucket**: sem mudança, o navegador não fala com o S3 neste desenho (decorre do requisito 0.1-1).

### 5.8 Contrato de salvamento da galeria (alteração em `POST/PATCH /video-pages`)
`MediaItemDto` é compartilhado (`shared/share-dto/media-item-dto.ts`); o campo novo **não** deve ser adicionado a ele sem decisão (afeta documentos, imagens, meditações…). **DECISÃO PENDENTE U-016:** (A) DTO específico de vídeo (`VideoItemDto extends MediaItemDto` com `uploadId?`) — recomendação técnica por isolamento; (B) campo opcional no DTO compartilhado.

Regras (PLANEJADAS, mensagens em português, envelope 422 com `error.details.fieldErrors`, como `docs/api-video-pages.md`):
- item `uploadType = upload` aceita **ou** `fieldKey` (fluxo antigo, U-012) **ou** `uploadId`; ambos → 422 em `videos.N.uploadId`;
- `uploadId` deve existir no S3 (`HeadObject`), ter `userId` igual ao do JWT (guardado em `upload.metadata` no `.info`, E-3/E-6), ter tamanho e tipo válidos (revalida, R5) e não estar vinculado a outro vídeo;
- o servidor define `url`, `size`, `originalName` a partir do objeto, **nunca** do payload (mesma regra de F-UP-6).

### 5.9 Adoção na transação (U-007=A)
Alteração em `processMediaItemsPolymorphic` ou ramo dedicado:
1. validar (5.8);
2. `CopyObject` tmp → `<env>/uploads/<timestamp>_<uuid8>_<nome sanitizado>` (mesmo padrão de chave de `AwsS3Service.upload`);
3. registrar a cópia no `S3UploadTracker` (rollback apaga a cópia);
4. **após o commit**, apagar o objeto temporário e o `.info` (mesma regra F-UP-5);
5. `CopyObject` é uma chamada **dentro de uma requisição HTTP**; ver RISCO R1 (60 s sem bytes) — N4. `CopyObject` simples tem limite de 5 GB (fato AWS, **conferir** N7); acima disso seria `UploadPartCopy` — fora de U-002.

### 5.10 Front (`clubinhonib-app`)
1. Dependência `tus-js-client` (**autorizar instalação**). Node ≥18 (E-1 do pacote); o app usa Vite/React 19.
2. Serviço `features/video-pages/uploads/` com `startVideoUpload(file, { onProgress, onSuccess, onError, signal })`:
   - `endpoint` = URL da API; `metadata`: `filename`, `filetype` (E-11: enviada só na criação);
   - `retryDelays` explícito (padrão `[0,1000,3000,5000]`, E-11; valores finais U-017);
   - `headers`/`onBeforeRequest`: injeta `Authorization: Bearer <token atual>` **a cada requisição** (E-11) reaproveitando a renovação existente do axios (F-APP-1: `POST /auth/refresh`, promessa única). Token vive 1 h em prod (M-6).
   - `chunkSize`: conforme U-003; `storeFingerprintForResuming`/`findPreviousUploads` conforme U-011.
3. `VideoEditor`: inicia o envio ao escolher o arquivo; estados `enviando | pausado | concluído | falhou`; barra de progresso; pausar (`abort()`), retomar, cancelar (`abort(true)` termina o upload no servidor — extensão Termination, E-2). O botão "Salvar" fica bloqueado enquanto houver envio em andamento.
4. `toVideoRequest` envia `uploadId` (U-016) em vez de anexar `File` ao `FormData`; o salvamento vira JSON.
5. Estilos mobile first (regra do projeto). Mensagens em português.
6. **Como o `uploadId` é obtido no cliente:** a URL do upload devolvida no `Location` (E-3/E-11 `onUploadUrlAvailable`). O formato exato do `uploadId` (último segmento da URL) é decisão do contrato — **U-018**.

---

## 6. Cenários de falha e comportamento esperado

| Cenário | Comportamento esperado | Verificação |
|---|---|---|
| Rede cai no meio | Cliente reenvia (`retryDelays`); `HEAD` retorna o offset; continua dali | e2e com `context.setOffline` |
| Aba fechada e reaberta | Retoma por `findPreviousUploads` (U-011=B) | e2e |
| Token expira durante retomadas | `onBeforeRequest` obtém token renovado; falha de refresh → estado "pausado, entre novamente" sem perder o offset | unit + e2e |
| Arquivo > U-002 ou tipo fora de U-006 | Recusa em `onUploadCreate`, antes de gravar | unit + e2e |
| Extensão/Content-Type forjados | Recusa em `onUploadFinish` (U-010) e objeto apagado | unit |
| Upload nunca salvo | Expira (U-008) e multipart abortado pelo lifecycle | verificação de infra |
| Falha ao salvar a página | Rollback apaga a cópia definitiva; o temporário continua válido até expirar | unit/integration |
| Dois salvamentos usam o mesmo `uploadId` | O segundo recebe 422 | unit |
| Deploy/restart do container no meio do envio | O multipart e o `.info` estão no S3; cliente retoma. **NÃO VERIFICADO** se o `S3Store` reconstrói o estado com o cache em memória vazio — N8 | integration (restart) |
| Disco temporário cheio | Falha controlada do `PATCH` (5xx) e retentativa do cliente. **Precisa de teste de carga** (N2) | carga |
| Sem espaço/RAM (t3.micro) | **RISCO** M-1 mitigado pelo fim do buffer em memória; disco passa a ser o limite | N2 |

---

## 7. Testes (aceite)

**API (Jest, `maxWorkers=1`, RAM limitada):** unit de `onUploadCreate`/`onUploadFinish`, sanitização de nome, assinatura de bytes, validação de `uploadId` (dono, existência, uso duplo), ordem commit→apagar temporário; integração com `@tus/server` real + S3 simulado (o provider do tus isola o pacote ESM; ver N1); `401` sem JWT, `403` não-admin; recusa de tamanho/tipo; teste de que o corpo `application/offset+octet-stream` **não** é consumido por middlewares (F-APP-4); regressão do fluxo antigo.
**App:** unit do serviço de upload (retry, renovação de token, cancelamento); e2e com **API real**, sem mock, logando como admin (regras do projeto): enviar vídeo, derrubar a rede, retomar, salvar a página, reabrir e reproduzir.
**Aceite:** envio de um vídeo de tamanho U-002 com ≥1 queda de rede no meio; heap da API **não cresce com o tamanho do arquivo**; objetos temporários somem no prazo U-008; nenhuma URL do S3 nova exposta além da atual.
**Comandos:** sempre limitados (`nice -n 19 systemd-run --user --scope -p MemoryMax=3G -p CPUQuota=200%`, `--maxWorkers=1`/`--workers=1`, `NODE_OPTIONS=--max-old-space-size=2048`).

---

## 8. Fases de entrega

| Fase | Entrega | Depende de |
|---|---|---|
| **0** | Endurecer o fluxo atual: `limits` e validação de formato/tamanho no `AnyFilesInterceptor` da galeria (reuso das constantes de `image-section`), `ContentType` derivado do tipo validado | U-002, U-006 |
| **S** | **Spike de verificação** (§11): ESM/Jest, CORS, handler no Nest, disco/RAM, restart, ALB | — |
| **1** | Infra: IAM + lifecycle + (se necessário) volume/memória | decisões U-007…U-009; autorização |
| **2** | Módulo de upload na API atrás de **feature flag própria** | Fases S, 1; U-001, U-014 |
| **3** | Adoção por `uploadId` no salvar (5.8/5.9) | Fase 2; U-016 |
| **4** | App: serviço tus, progresso, pausa/retomada, salvar só JSON | Fases 2–3 |
| **5** | Observabilidade e remoção do fluxo antigo (U-012) | Fase 4 estável |

---

## 9. Dependências e mudanças que exigem autorização explícita
Instalar `@tus/server`, `@tus/s3-store`, `tus-js-client` e eventual atualização de `@aws-sdk/client-s3` (E-1); alterar CloudFormation (IAM, lifecycle, possivelmente instância/volume); alterar `main.ts` (CORS/headers do tus, se necessário); nova feature flag; qualquer migration (esta feature **não** exige tabela nova se U-007/5.8 forem seguidos — nenhuma migration está prevista).

---

## 10. Conformidade com `CLAUDE.md`/`AGENTS.md`
Controller só HTTP; serviço por operação; persistência apenas em repository; tus/S3 em **provider**; DTOs de entrada/saída; `types`/`constants`/`utils`/enums em arquivos próprios; sem `any`; feature flag própria semeada em `DEFAULT_FEATURE_FLAGS` (não é e-mail); atualizar `docs/api-video-pages.md`; diagrama de fluxo em `docs/diagrams/flow/video-resumable-upload/` com `.png` gerado (`npm run diagrams:generate`); testes Jest para cada comportamento novo; nenhuma migration manual (e nenhuma prevista).

---

## 11. Itens NÃO VERIFICADOS — spike obrigatório antes de implementar
| ID | O que falta provar | Como verificar | Resultado muda |
|---|---|---|---|
| N1 | Carregar `@tus/server`/`@tus/s3-store` (ESM-only) no projeto CommonJS, em `nest build` e em Jest/ts-jest | Importar via provider; rodar `nest build`, `node dist/src/main.js` e um spec | U-001 (A vs B) |
| N2 | Uso real de **disco e RAM** com `partSize`/`maxConcurrentPartUploads` em t3.micro, e tamanho do volume EBS | Teste de carga com 1 e 3 uploads de U-002; medir `os.tmpdir()` e RSS | U-004, U-005, dimensionamento |
| N3 | Se um único `PATCH` (`chunkSize=Infinity`) de U-002 atravessa ALB→EC2 sem falhas em rede lenta | Teste com rede limitada | U-003 |
| N4 | Comportamento do ALB com **60 s sem bytes** (ex.: `CopyObject` longo na resposta do salvar) e duração real do `CopyObject` de U-002 | Medir; consultar doc AWS | U-007 (A vs B) |
| N5 | `server.handle` dentro de controller Nest com `@Res()`: guards, `AuditInterceptor` (F-APP-3 só lê status/URL), `AutomaticActionContextGuard`, sintaxe de rota Express 5 (`*path`), resposta não consumida por parser | Teste de integração com `supertest` | U-014 |
| N6 | Interação de `enableCors` do Nest com os headers CORS do tus (`Location`, `Upload-Offset`, `Upload-Length` expostos?) | Teste real no navegador | `main.ts`/`exposedHeaders` |
| N7 | Mapeamento exato de ações IAM do multipart e limites do `CopyObject` | Doc oficial AWS | 5.6, 5.9 |
| N8 | Retomada **após restart** com `MemoryKvStore` vazio | Subir upload, reiniciar processo, retomar | Aceite do requisito 0.1-2 |
| N9 | Compatibilidade `@tus/s3-store` ↔ `@aws-sdk/client-s3 3.758.0` instalado (pacote pede `^3.1045.0`, E-1) | `npm ls` após instalar em branch de teste | Dependências |

Nenhuma implementação das Fases 2–4 deve começar antes dos itens N1, N2, N5, N6 e N8 estarem resolvidos.
