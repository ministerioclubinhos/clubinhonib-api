# Plano de Implementação Backend — Streaming de Mídia e Download Seguro

**Status:** plano de implementação; nenhuma alteração de código, infraestrutura, ambiente ou banco de dados está autorizada por este documento.

**Última revisão:** 2026-09-08

**Escopo do repositório:** `clubinhonib-api`

---

## 1. Como este plano deve ser usado

Este documento separa rigorosamente:

1. **requisitos confirmados** pelo solicitante;
2. **fatos verificados** no repositório backend (`clubinhonib-api`);
3. **decisões ainda não fornecidas** (**DECISÃO PENDENTE**);
4. **trabalho de implementação condicionado** a essas decisões.

Nenhum item marcado como **DECISÃO PENDENTE** pode ser transformado em código, configuração ou infraestrutura por escolha implícita do implementador. Isso é estritamente necessário para cumprir o requisito de **zero suposições**.

---

## 2. Requisitos confirmados pelo solicitante

> [!IMPORTANT]
> **REGRA DE OURO DA ARQUITETURA DE MÍDIA:**
> A API backend **NUNCA** deve enviar a URL do S3 (`*.s3.amazonaws.com`) para o frontend em nenhuma hipótese ou formato (seja em respostas DTO, parâmetros de consulta, cabeçalhos, logs públicos ou erros HTTP). **Toda e qualquer mídia armazenada no S3 é SEMPRE servida via STREAMING através da própria API NestJS** (`GET /media-items/:id/stream`), atuando como um proxy seguro e transparente.

### 2.1 Diretrizes Obrigatórias de Streaming e Segurança
- **Proibição Absoluta de Vazamento de URLs do S3:** O frontend nunca recebe links do S3. Toda propriedade `url` em respostas da API apontará estritamente para o endpoint de streaming ou download do backend NestJS.
- **Streaming Obrigatório para Toda Mídia:** Vídeos, áudios, imagens e documentos/PDFs enviados por upload serão lidos do S3 pela API NestJS e transmitidos via streaming ao cliente.
- **Transferência Parcial via HTTP 206 (`Range Requests`):** O endpoint de streaming da API deve suportar o cabeçalho `Range: bytes=x-y` e retornar `HTTP 206 Partial Content`, garantindo reprodução contínua, avanço, recuo e buffering progressivo em players nativos de vídeo e áudio.
- **Download Seguro via API:** Downloads são realizados exclusivamente através de rota dedicada do backend (`GET /media-items/:id/download`), que injeta o cabeçalho `Content-Disposition: attachment; filename="..."` e faz o pipe seguro do arquivo sem revelar o S3.
- **Padrão Zero Suposições:** O plano de implementação segue o padrão rigoroso de trava de decisões dos documentos da pasta `doc/implementaion-plan/`.

---

## 3. Diagnóstico confirmado do estado atual no backend

O inventário abaixo foi levantado mediante inspeção direta no código existente do repositório `clubinhonib-api`:

### 3.1 Armazenamento em S3 (`src/shared/providers/aws/aws-s3.service.ts`)
- O método `upload(file: Express.Multer.File)` envia o arquivo para o S3 e retorna a string pública: `https://${this.bucketName}.s3.amazonaws.com/${key}`.
- O método `extractKey(url: string)` extrai a chave do objeto S3 a partir de URLs no formato virtual-hosted ou path-style.
- **Fato verificado:** O `AwsS3Service` **não possui** método para obter o stream do objeto (`GetObjectCommand` do `@aws-sdk/client-s3`) nem suporte ao repasse de cabeçalhos de `Range`.

### 3.2 Estrutura de Mídia (`src/shared/media/media-item/media-item.entity.ts` e `media-item-processor.ts`)
- A entidade `MediaItemEntity` (tabela `media_items`) possui a coluna `url` que armazena a URL completa do S3 ou o link externo.
- Enums existentes:
  - `MediaType`: `video`, `document`, `image`, `audio`.
  - `UploadType`: `link`, `upload`.
  - `PlatformType`: `youtube`, `googledrive`, `onedrive`, `dropbox`, `ANY`.
- O `MediaItemProcessor` e o `MediaModule` fornecem apenas métodos de busca e associação de mídias a alvos do sistema (`documents`, `meditations`, `pages`, etc.).
- **Fato verificado:** O `MediaModule` **não possui nenhum controller HTTP, rota de streaming, rota de download nem mecanismo de geração de tickets/tokens de acesso**.

### 3.3 DTOs e Mappers nos Módulos de Domínio (Vazamento Atual de URLs)
- Módulos analisados: `documents`, `meditations`, `pages` (`image-page`, `video-page`, `week-material-page`, `event-page`, `ideas-page`, `ideas-section`, `image-section`).
- Todos os mappers dessas entidades convertem a propriedade `media.url` devolvendo a string bruta salva no banco de dados.
- **Fato verificado:** Atualmente, **todas as chamadas GET desses módulos violam a Regra de Ouro**, retornando a URL direta `https://<bucket>.s3.amazonaws.com/...` para o frontend. Todos esses mappers precisarão ser refatorados para gerar a rota de streaming da API (`/media-items/:id/stream`).

---

## 4. Trava de decisões — zero suposições

Antes de iniciar qualquer codificação ou alteração de ambiente, **todas as decisões abaixo devem ter sua opção aprovada pelo responsável pelo projeto**.

| ID | Decisão exigida | Por que não pode ser inferida | Bloqueia |
| --- | --- | --- | --- |
| **D-001** | Qual mecanismo de autenticação será adotado para que elementos HTML nativos (`<video>`, `<audio>`, `<img>`, `<iframe>`) acessem a rota de streaming da API sem expor a URL do S3?<br><br>**Opções:**<br>**(A)** Ticket de acesso temporário gerado por `POST /media-items/:id/ticket` e repassado via query string `?ticket=JWT_CURTO`.<br>**(B)** Cookie `HttpOnly` com escopo restrito às rotas de mídia `/media-items/*`.<br>**(C)** URLs pré-assinadas via AWS CloudFront com domínio customizado mascarado (ex.: `media.clubinhonib.com.br`). | Tags nativas do navegador (`<video src="...">`) não conseguem enviar o cabeçalho `Authorization: Bearer <token>` em requisições GET padrão. A escolha altera o guard de autenticação e a integração com o frontend. | Guard de Autenticação / Controller |
| **D-002** | Qual deve ser o tempo de expiração (`TTL`) do ticket/token temporário de streaming caso a Opção A da D-001 seja escolhida?<br><br>**Opções:**<br>**(A)** 60 segundos (uso único para inicializar o player).<br>**(B)** 300 segundos (5 minutos, cobrindo reconexões de buffer).<br>**(C)** Duração idêntica ao token JWT principal de sessão. | Tickets curtos exigem renovação no frontend se o player fizer *seeking* após longo período pausado; tickets longos aumentam a janela de validade do ticket. | Ticket Service / ConfigModule |
| **D-003** | Como a propriedade `url` devolvida nos DTOs das mídias enviadas por upload deve ser transformada para garantir que **nunca** exiba o S3?<br><br>**Opções:**<br>**(A)** Retornar a rota relativa da API (ex.: `/media-items/:id/stream`).<br>**(B)** Retornar a URL absoluta do backend (ex.: `https://api.clubinhonib.com.br/media-items/:id/stream`).<br>**(C)** Manter a propriedade `url` vazia e adicionar duas propriedades explícitas `streamUrl` e `downloadUrl`. | Altera o contrato da API com o frontend e afeta todos os mappers de respostas existentes no sistema. | Mappers e DTOs de Resposta |
| **D-004** | Qual a estratégia para os registros históricos no banco de dados que possuem a URL bruta `https://<bucket>.s3.amazonaws.com/key` gravada na coluna `url`?<br><br>**Opções:**<br>**(A)** Manter a coluna `url` inalterada no banco e usar o utilitário `extractKey(media.url)` em tempo de execução para obter a chave do S3 e montar a resposta.<br>**(B)** Executar uma migration SQL no TypeORM para converter o conteúdo da coluna `url` em apenas a chave relativa do objeto (ex.: `environment/uploads/...`). | Migrações de banco exigem autorização explícita conforme `AI_DATABASE_CHANGE_REQUIREMENTS.md`. A Opção (A) evita alterações de schema, enquanto (B) limpa o banco. | Migration / Service |
| **D-005** | Como o streaming da API responderá caso a requisição HTTP do cliente **não envie** o cabeçalho `Range` (ex.: navegadores antigos ou `fetch` simples)?<br><br>**Opções:**<br>**(A)** Fazer o streaming do arquivo completo com código `HTTP 200 OK`, utilizando chunks de buffer de tamanho fixo (ex.: 1MB).<br>**(B)** Rejeitar a requisição sem Range com erro `HTTP 400 Bad Request`. | Vídeos de grande porte (ex.: 500MB) carregados sem Range podem consumir banda e RAM excessivos se o tamanho de chunk não for limitado. | Implementation do Stream Proxy |
| **D-006** | Qual deve ser o tamanho máximo de chunk de buffer utilizado pelo backend ao ler do S3 quando o cliente não especificar limite de bytes?<br><br>**Opções:**<br>**(A)** 1 MB (1.048.576 bytes).<br>**(B)** 5 MB (5.242.880 bytes).<br>**(C)** Usar o tamanho padrão de stream fornecido pela AWS SDK v3. | Impacta diretamente a utilização de RAM do container ECS da API em cenários de múltiplos acessos concorrentes a vídeos. | MediaStreamService |
| **D-007** | Como mídias cadastradas via `LINK` externo (YouTube, Google Drive, Dropbox, OneDrive) devem ser tratadas nas rotas de streaming e download?<br><br>**Opções:**<br>**(A)** O endpoint `/stream` redireciona (`HTTP 302`) para a URL externa ou devolve erro `HTTP 400` informando que mídias de link usam embed direto.<br>**(B)** O backend faz proxy do conteúdo externo (não recomendado para YouTube por violação de termos e consumo de banda). | Links externos não residem no S3 e possuem regras de CORS/embed próprias da plataforma de origem. | Stream Controller / Logic |
| **D-008** | Qual a regra de autorização (RBAC) aplicada ao acesso de mídias por streaming e download?<br><br>**Opções:**<br>**(A)** Qualquer usuário autenticado na API pode assistir/baixar qualquer mídia enviada.<br>**(B)** O acesso à mídia depende da permissão do usuário sobre a entidade dona da mídia (ex.: verificar se o usuário pode acessar a página/material da semana associada). | Restrições granulares exigem consultas adicionais no banco para validar o vínculo entre o usuário e a entidade alvo. | Guards e Interceptors |
| **D-009** | Como lidar com a auditoria (`AUDIT_STORAGE`) dos acessos por streaming?<br><br>**Opções:**<br>**(A)** Registrar auditoria apenas em downloads explícitos (`GET /download`) e requisições iniciais de stream, ignorando requisições parciais `HTTP 206` repetidas de um mesmo vídeo.<br>**(B)** Auditar absolutamente todas as requisições `HTTP 206` recebidas. | Auditar cada request parcial de fragmento de vídeo pode gerar centenas de registros de auditoria por minuto para um único usuário, inundando o DynamoDB/arquivo. | Interceptor de Auditoria |
| **D-010** | Qual deve ser a política de cabeçalhos de cache (`Cache-Control`, `ETag`, `Last-Modified`) nas respostas de streaming?<br><br>**Opções:**<br>**(A)** `Cache-Control: private, max-age=3600, no-transform` com suporte a `ETag` para permitir resposta `HTTP 304 Not Modified`.<br>**(B)** `Cache-Control: no-store` impedindo qualquer cache no navegador. | Caching melhora o desempenho e reduz custos de Egress da AWS, mas dificulta a revogação imediata de acesso a mídias. | Controller Headers |
| **D-011** | Como o ambiente de desenvolvimento local (`isLocalFile = true`) deve se comportar sem acesso à AWS?<br><br>**Opções:**<br>**(A)** Utilizar `fs.createReadStream` com leitura parcial por bytes para simular o comportamento do S3 exatamente da mesma forma.<br>**(B)** Exigir o uso de um emulador local do S3 (ex.: LocalStack). | A Opção (A) garante funcionamento offline para desenvolvedores sem custos adicionais de infraestrutura local. | Storage Provider Local |
| **D-012** | O acesso público do Bucket do AWS S3 deve ser bloqueado na AWS (`Block All Public Access`) imediatamente no deploy desta alteração?<br><br>**Opções:**<br>**(A)** Sim, alterar as políticas do bucket via CloudFormation no momento da homologação/deploy.<br>**(B)** Não, manter uma janela de convivência e bloquear o acesso público somente após a validação completa em produção. | Alterar permissões de infraestrutura na AWS sem confirmação pode interromper o funcionamento de instâncias em uso antes da atualização do frontend. | Infra / AWS CloudFormation |
| **D-013** | Qual o limite de requisições por minuto (*Rate Limit*) permitido por usuário/IP nos endpoints de streaming e download?<br><br>**Opções:**<br>**(A)** 120 requisições por minuto por IP via `ThrottlerModule`.<br>**(B)** Sem limite de rate limit específico (utilizar apenas o limite global da API). | Previne custos excessivos de transferência de dados (Egress) na AWS em caso de robôs ou abusos. | Rate Limit / Throttler |
| **D-014** | Qual o formato sanitizado do nome do arquivo enviado no cabeçalho `Content-Disposition` no download?<br><br>**Opções:**<br>**(A)** Remover caracteres especiais e acentos, usando apenas `[a-zA-Z0-9._-]`.<br>**(B)** Utilizar a sintaxe padrão RFC 5987 (`filename*=UTF-8''...`) para preservar acentuação original. | Nomes de arquivos com caracteres UTF-8 não codificados causam erros de sintaxe em navegadores mais antigos ou clientes HTTP rígidos. | Download Service |

---

### 4.1 Limite técnico que precisa ser aceite explicitamente

O streaming de mídias por HTTP depende da conexão ativa entre o cliente e o servidor. O projeto deve documentar formalmente os seguintes limites técnicos:

1. **Desconexão do Cliente:** Caso o usuário feche a aba ou cancele o vídeo durante a transmissão, a API NestJS deve escutar o evento `res.on('close')` e destruir o stream do S3 (`s3Stream.destroy()`) para evitar vazamento de sockets e memória no Node.js.
2. **Transferência sem Criptografia de Origem Interna:** O fluxo entre a API NestJS e o S3 utiliza TLS dentro da rede da AWS, e o fluxo entre a API e o cliente utiliza HTTPS. A API atua como proxy e consumirá largura de banda do servidor onde estiver hospedada.

---

## 5. Critérios de aceite funcionais

Os critérios abaixo ficam estritamente condicionados à aprovação das decisões da Seção 4:

1. **Ocultação 100% Garantida do S3:** Nenhuma resposta JSON da API, cabeçalhos de resposta ou logs da aplicação expõem a URL do bucket S3 (`*.s3.amazonaws.com`).
2. **Streaming Transparente:** Toda mídia enviada por upload é servida pela rota `GET /media-items/:id/stream`.
3. **Suporte a Transferência Parcial:** A rota de streaming responde com `HTTP 206 Partial Content` quando o cabeçalho `Range` for enviado (ex.: `Range: bytes=0-1048575`).
4. **Cabeçalhos de Streaming Corretos:**
   - `Content-Type`: o tipo MIME exato da mídia;
   - `Content-Range`: o intervalo de bytes retornado (ex.: `bytes 0-1048575/52428800`);
   - `Accept-Ranges`: obrigatoriamente `bytes`;
   - `Content-Length`: o tamanho exato do fragmento enviado.
5. **Download Seguro via API:** A rota `GET /media-items/:id/download` responde com o arquivo completo e o cabeçalho `Content-Disposition: attachment; filename="..."`.
6. **Autenticação Segura:** O endpoint `POST /media-items/:id/ticket` exige JWT e gera o ticket temporário para elementos nativos HTML5.
7. **Streaming via Streams:** A leitura do S3 ocorre via *pipe* de streams (`Readable.pipe(res)`), sem carregar o arquivo inteiro na memória RAM do Node.js.
8. **Cobertura de Testes:** Testes unitários e e2e validam as respostas `HTTP 206`, `HTTP 200`, `HTTP 401`, os cabeçalhos de download e a ausência absoluta de URLs do S3.

---

## 6. Arquitetura-alvo condicionada às decisões

### 6.1 Fluxo de Comunicação e Streaming Proxied

```text
  [ Cliente Frontend / Player HTML5 ]
                 │
                 ├─► (1) Obtenção do Ticket (Opcional se D-001 = A):
                 │       POST /media-items/:id/ticket
                 │       Header: Authorization: Bearer <jwt_usuario>
                 │       ◄─ Retorna: { ticket: "eyJhbGci..." }
                 │
                 ├─► (2) Requisição de Streaming (SEMPRE VIA API):
                 │       GET /media-items/:id/stream?ticket=eyJhbGci...
                 │       Header: Range: bytes=0-1048575
                 │
                 ▼
     [ NestJS: MediaStreamController ]
                 │
                 ├─► TicketOrJwtGuard: Valida o ticket temporário ou o token Bearer
                 ├─► MediaStreamService: Obtém a mídia e extrai a chave do S3
                 │
                 ▼
     [ NestJS: AwsS3Service ]
                 │
                 ├─► s3Client.send(new GetObjectCommand({ Bucket, Key, Range }))
                 │   (Autenticado via IAM Task Role interna - S3 Privado)
                 │
                 ▼
      [ Stream Readable do S3 ]
                 │
                 └─► Pipe direto para a resposta Express (res):
                     - Status: 206 Partial Content
                     - Content-Type: video/mp4
                     - Content-Range: bytes 0-1048575/52428800
                     - Accept-Ranges: bytes
                     - Content-Length: 1048576
```

### 6.2 Estrutura de Arquivos Planejada

```text
clubinhonib-api/src/
├── shared/
│   ├── providers/
│   │   └── aws/
│   │       └── aws-s3.service.ts         # Adição do método getObjectStream(key, range)
│   └── media/
│       ├── media-item/
│       │   └── media-item.entity.ts
│       ├── dto/
│       │   ├── stream-ticket-response.dto.ts
│       │   └── create-stream-ticket.dto.ts
│       ├── guards/
│       │   └── stream-ticket.guard.ts     # Valida Bearer JWT ou query param ?ticket=...
│       ├── media-stream.service.ts        # Regras de streaming, cálculo de Range e tickets
│       ├── media-stream.controller.ts     # Endpoints POST /ticket, GET /stream, GET /download
│       └── media.module.ts               # Exportação e registro do controller/serviços
```

---

## 7. Fases de implementação (condicionadas à aprovação da Seção 4)

### Fase 1: Atualização do Provider de S3 (`AwsS3Service`)
1. Implementar o método `getObjectStream(key: string, range?: string)` no `AwsS3Service` utilizando `GetObjectCommand`.
2. Adicionar o repasse do cabeçalho `Range` para a AWS SDK v3.
3. Tratar erros do S3 (`NoSuchKey`, `AccessDenied`) convertendo-os em exceções HTTP adequadas do NestJS (`AppValidationException` com erro `NOT_FOUND`).

### Fase 2: Serviço e Guard de Tickets de Streaming
1. Criar o serviço `StreamTicketService` para assinar e verificar tokens JWT de curta duração.
2. Criar o `StreamTicketGuard` para extrair e validar a credencial vinda pelo cabeçalho `Authorization` ou pelo parâmetro de query `?ticket=...`.

### Fase 3: Controller de Streaming e Download
1. Criar o `MediaStreamService` com métodos para:
   - `streamMedia(id: string, rangeHeader?: string, res: Response)`
   - `downloadMedia(id: string, res: Response)`
   - `generateTicket(id: string, user: AuthenticatedUser)`
2. Criar o `MediaStreamController` registrando os endpoints:
   - `POST /media-items/:id/ticket`
   - `GET /media-items/:id/stream`
   - `GET /media-items/:id/download`
3. Injetar o tratamento de interrupção de socket `res.on('close')` para destruir o stream do S3 e liberar recursos.

### Fase 4: Atualização Obrigatória de Todos os Mappers da Aplicação
1. Refatorar os DTOs e mappers de **todos os módulos que expõem mídias** (`documents`, `meditations`, `pages`, etc.) para que a propriedade `url` retorne impreterivelmente a rota de streaming da API (ex.: `/media-items/:id/stream`).

### Fase 5: Testes Automatizados e Homologação
1. Criar testes unitários para `AwsS3Service`, `StreamTicketGuard`, `MediaStreamService` e `MediaStreamController`.
2. Criar testes de integração e2e validando requisições com `Range`, requisições completas, downloads e verificação estrita da ausência de URLs do S3.

---

## 8. Plano de testes e verificação

### 8.1 Testes Unitários
- `aws-s3.service.spec.ts`: Validar chamadas ao `GetObjectCommand` repassando o cabeçalho `Range`.
- `stream-ticket.guard.spec.ts`: Testar autorização com token válido, ticket válido, ticket expirado e sem credencial.
- `media-stream.service.spec.ts`: Testar lógica de parsing do cabeçalho `Range` (ex.: `bytes=0-100`) e erros de arquivo inexistente.

### 8.2 Testes E2E (Integração)
- `GET /media-items/:id/stream` enviando `Range: bytes=0-1023`: Verificar status `206`, cabeçalho `Content-Range: bytes 0-1023/<total>` e payload retornado de 1024 bytes.
- `GET /media-items/:id/download`: Verificar status `200` e cabeçalho `Content-Disposition: attachment; filename="..."`.
- **Validação de Segurança em Testes:** Adicionar asserção em todos os testes e2e de mídia garantindo que a resposta nunca contenha a substring `s3.amazonaws.com`.

---

## 9. Plano de roll-back e contingência

1. **Rollback de Código:** Reverter os commits do `MediaStreamController` e dos mappers nos módulos de domínio.
2. **Contingência de Banco:** Como o banco de dados não terá seu schema alterado se a Opção A da D-004 for adotada, nenhuma instrução SQL de rollback será necessária.
3. **Contingência de Infraestrutura:** Caso as permissões públicas do S3 tenham sido alteradas e ocorra falha no streaming, restaurar temporariamente a política anterior via CloudFormation até a correção do código da aplicação.
