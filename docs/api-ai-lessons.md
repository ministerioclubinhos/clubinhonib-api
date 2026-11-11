# Estúdio Clubinho — produção de lições

Referência vigente do módulo `src/modules/ai-lessons` (revisão de 2026-11-10). O que foi substituído está resumido em [Histórico](#histórico); o que ficou para depois está em [Pendências conhecidas](#pendências-conhecidas).

## 1. Visão geral

O Estúdio Clubinho é um fluxo administrativo autenticado (JWT + papel de administrador em todas as rotas) para produzir, revisar e publicar materiais gerados com IA.

| Categoria (`category`) | Itens do pacote, na ordem de produção |
| --- | --- |
| `REGULAR` — Material Semanal | 1. `LESSON`, 2. `LESSON_VISUALS`, 3. `STANDARD_GAME`, 4. `VERSE_VISUALS`, 5. `VERSE_FIXATION`, 6. `MEDITATION_YOUNGER`, 7. `MEDITATION_OLDER`, 8. `MANUAL_WORK` |
| `SPECIAL` — Material Especial | 1. `LESSON`, 2. `LESSON_VISUALS`, 3. `VERSE_VISUALS` |

Tema e referências bíblicas são obrigatórios na criação. O número da semana é obrigatório no Material Semanal e opcional no Material Especial (1 a 999). `specialContext` (até 2.000 caracteres) descreve a ocasião do Material Especial; enviado em uma lição `REGULAR`, é ignorado.

O acervo histórico em `../lições` é referência de formato, não fonte automaticamente confiável. Arquivos políticos, nomes de voluntários, variantes de corte, rascunhos, erros ortográficos e citações não conferidas nunca são copiados. Cada etapa gera um único produto canônico; imposições de impressão são responsabilidade do renderer.

Cada etapa mantém versões imutáveis (`lesson_versions`). Gerar ou salvar uma etapa invalida as posteriores (`STALE`).

## 2. Endpoints

Prefixo `/api/v1/lessons`. Todas as rotas exigem JWT e papel de administrador. Salvo indicação, a resposta é `LessonResponseDto`.

| Método e caminho | Corpo / query | Observações |
| --- | --- | --- |
| `POST /` | `theme` (3–255), `biblicalReference` (3–500), `category?`, `weekNumber`, `specialContext?` | 201. Cria a lição e suas etapas (8 ou 3) em uma transação. |
| `GET /` | `status?`, `statuses?` (lista separada por vírgula), `category?`, `search?` (≤ 200), `page`, `limit` (1–50), `sort` (`createdAt`, `updatedAt`, `theme`, `weekNumber`), `order` | `{ items, total, page, limit, totalPages }`. Não carrega versões nem comentários. `%` e `_` da busca são tratados literalmente. |
| `GET /dashboard` | — | `{ total, byStatus, recent }`. |
| `GET /:id` | `view?` = `full` (padrão) ou `compact` | Leitura pura. `compact` devolve só a versão atual de cada etapa. |
| `GET /:id/events` | `view?` | SSE; ver [seção 6](#6-eventos-sse). |
| `DELETE /:id` | — | `{ success, message }`. Recusada (409) para lição `PUBLISHED`, `ARCHIVED`, em publicação ou com etapa em geração. |
| `POST /:id/archive` | — | `PUBLISHED` → `ARCHIVED`. |
| `POST /:id/unarchive` | — | `ARCHIVED` → `PUBLISHED`. |
| `POST /:id/comments/:commentId/resolve` | — | Marca a observação como resolvida. 404 se não pertencer à lição. |
| `POST /:id/stages/generate` | `stage`, `revisionInstructions?` (≤ 1.000), `visualType?`, `visualOrientation?`, `visualQuantity?` (4–10) | Persiste o pedido e responde sem aguardar a IA. Configuração visual inválida responde 400 na hora. Campos internos (`frozenProvider`, `frozenAdminPrompt`, `checkpointedAssetUrls`) são rejeitados com 400. |
| `PATCH /:id/stages/content` | `stage`, `tiptapAstJson`, `structuredDataJson?`, `lockVersion`, `changeSummary?` (≤ 255) | Cria nova versão. Conteúdo idêntico ao atual não cria versão nem invalida etapas. Dentro de um ciclo de revisão não invalida nenhuma outra etapa ([seção 3.3](#33-invalidação-e-blindagem-na-revisão)). |
| `POST /:id/stages/complete-production` | `stage`, `lockVersion`, `acknowledgeStale?` | Ver [seção 3.2](#32-regras-de-transição). |
| `POST /:id/package/submit-review` | — | Exige lição `PACKAGE_READY`. |
| `POST /:id/stages/approve` | `stage`, `lockVersion` | `note` não é aceito. Gera o PDF do item antes de aprovar e pode levar alguns segundos; se o PDF não sai, responde 422 ou 503 (`LESSON_9314`) com o nome do item. |
| `POST /:id/stages/request-changes` | `stage`, `lockVersion`, `note` (1–1.000) | Cria uma observação aberta. |
| `POST /:id/stages/reopen` | `stage`, `lockVersion`, `note` (1–1.000) | Reabre um item `APPROVED` de pacote `READY_FOR_PUBLICATION`. |
| `GET /:id/stages/:stage/preview.pdf` | `lockVersion?`, `versionId?` (UUID) | PDF inline da versão atual; 409 se `lockVersion`/`versionId` divergirem. |
| `POST /:id/export/pdf` | — | PDF consolidado (attachment); exige todos os itens `APPROVED` e prontos. |
| `GET /:id/publication-preview` | — | `LessonPublicationPreviewResponseDto`; ver [seção 7.1](#71-prévia-da-publicação). |
| `POST /:id/publish-week-material` | — | `{ lesson, weekMaterialId }`; ver [seção 7](#7-publicação). Também publica novamente uma lição `PUBLISHED` cujo material foi apagado. |
| `GET /prompt-preferences/me` | `category?` | Lista `{ stage, basePrompt, customPrompt, effectivePrompt, lockVersion }`. |
| `PATCH /prompt-preferences/me` | `stage`, `category?`, `prompt` (10–12.000), `lockVersion?` | `lockVersion` é exigido quando a linha já existe (409 sem ele). |
| `POST /prompt-preferences/me/reset` | `stage`, `category?`, `lockVersion?` | Mesma regra de `lockVersion`. |

`lockVersion` é **obrigatório** em concluir, aprovar, devolver e reabrir: ausente responde 400; divergente responde 409 (`LESSON_9303`).

Provedores, prefixo `/api/v1/lessons/providers`:

| Método e caminho | Observações |
| --- | --- |
| `GET /settings`, `PUT /settings` | `{ llmProvider, openai, gemini }`. O `PUT` salva os dois provedores e a escolha ativa em uma transação. |
| `GET/PUT /openai/settings`, `GET/PUT /gemini/settings` | Variantes individuais. |
| `GET /openai/models` | `{ models: { general, image }, source: 'LIVE' \| 'FALLBACK', isLive, warning }`. Não aceita `apiKey` na query. |
| `GET /gemini/models` | Lista estática: `source: 'STATIC'`, `isLive: false`. |

### 2.1 Campos da resposta

- Lição: `id`, `theme`, `biblicalReference`, `weekNumber`, `category`, `specialContext`, `status`, `weekMaterialId`, `publicationState` (`IDLE`, `PUBLISHING`, `FAILED`, `PUBLISHED`), `publicationFailureMessage`, `createdAt`, `updatedAt`, `stages[]`, `comments[]`.
- Etapa: `id`, `type`, `status`, `currentVersionId`, `lockVersion`, `failureCode`, `failureMessage`, `versions[]`.
- Versão: `id`, `versionNumber`, `tiptapAstJson`, `structuredDataJson`, `changeSummary`, `createdAt`.
- Observação: `id`, `sectionKey` (tipo da etapa), `commentText`, `isResolved`, `authorId`, `createdAt`.

Snapshots de prompt, identificadores de resposta do provedor, checksums, leases e chaves internas não são expostos. `authorId` das observações é exposto.

### 2.2 Limites de corpo

O corpo JSON de toda a API é limitado a 4 MiB (`src/main.ts`). No salvamento, `tiptapAstJson` e `structuredDataJson` aceitam até 1,5 MB (medidos em bytes) e profundidade 32 cada.

## 3. Máquina de estados

### 3.1 Estados

- **Lição:** `DRAFT`, `IN_PROGRESS`, `PACKAGE_READY`, `IN_REVIEW`, `CHANGES_REQUESTED`, `READY_FOR_PUBLICATION`, `PUBLISHING`, `PUBLISHED`, `ARCHIVED`.
- **Etapa:** `NOT_STARTED`, `GENERATING`, `DRAFT`, `PRODUCER_APPROVED`, `IN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `FAILED`, `STALE`.

O status da lição é derivado das etapas por uma única função (`recomputeLessonStatus`), exceto `PUBLISHING`, `PUBLISHED` e `ARCHIVED`, que são transições explícitas:

| Condição das etapas | Status da lição |
| --- | --- |
| Todas `NOT_STARTED` | `DRAFT` |
| Alguma sem versão, ou fora de concluída/aprovada/em revisão/com ajustes | `IN_PROGRESS` |
| Todas `APPROVED` | `READY_FOR_PUBLICATION` |
| Alguma `CHANGES_REQUESTED` (demais concluídas) | `CHANGES_REQUESTED` |
| Alguma `PRODUCER_APPROVED` (demais concluídas) | `PACKAGE_READY` |
| Demais casos (todas em revisão ou aprovadas) | `IN_REVIEW` |

Diagrama: [`diagrams/flow/ai-lessons/ai-lessons-states.puml`](diagrams/flow/ai-lessons/ai-lessons-states.puml).

### 3.2 Regras de transição

- **Bloqueio global:** enquanto a lição está em `PUBLISHING` ou qualquer etapa está em `GENERATING`, salvar, concluir, aprovar, devolver, reabrir e excluir respondem 409 (`LESSON_9305` / `LESSON_9304`).
- **Gerar:** recusado com a lição em `IN_REVIEW`, `READY_FOR_PUBLICATION`, `PUBLISHING`, `PUBLISHED` ou `ARCHIVED`, e com a própria etapa em `APPROVED` ou `IN_REVIEW` (409 `LESSON_9306`: o item precisa ser reaberto ou devolvido antes). Exige a etapa anterior concluída (`PRODUCER_APPROVED`, `IN_REVIEW` ou `APPROVED`). Se a geração falhar, uma etapa que já tinha versão volta ao status anterior ao pedido e mantém essa versão, com `failureCode`/`failureMessage` preenchidos mesmo sem estar em `FAILED`; uma etapa sem versão anterior vai a `FAILED`.
- **Salvar:** permitido com a etapa em `DRAFT`, `PRODUCER_APPROVED`, `CHANGES_REQUESTED`, `STALE` ou `FAILED`. Fora de um ciclo de revisão, invalida as etapas posteriores já iniciadas; dentro dele, não invalida nada ([seção 3.3](#33-invalidação-e-blindagem-na-revisão)).
- **Concluir:** mesmos status de etapa; exige a etapa anterior concluída e o conteúdo pronto ([seção 5](#5-conteúdo-editado-e-prontidão)). Uma etapa `STALE` ou `FAILED` cujos itens anteriores ganharam versão mais nova só é concluída com `acknowledgeStale: true`; sem ele responde 409 (`LESSON_9308`).
- **Submeter:** exige `PACKAGE_READY` e todas as etapas com versão.
- **Aprovar / devolver:** lição em `IN_REVIEW` ou `CHANGES_REQUESTED`, etapa em `IN_REVIEW`. A versão é lida sob o lock da lição. Aprovar valida a prontidão e **gera o PDF do item** (fora da transação, para o LibreOffice nunca rodar sob o lock); dentro da transação a API confere que a etapa ainda aponta para a versão renderizada (senão 409 `LESSON_9303`). Se o PDF não pode ser produzido, a aprovação é recusada com `LESSON_9314`: 422 quando o conteúdo não vira PDF (a mensagem do renderizador é mantida, prefixada com o nome do item, por exemplo `Meditação dos menores: …`) e 503 quando o conversor está ocupado ou indisponível. O PDF fica em cache por versão, então a publicação o reaproveita. Devolver não valida nada, para que um item quebrado possa ser devolvido.
- **Reabrir:** lição em `READY_FOR_PUBLICATION`, etapa `APPROVED`. A etapa vai a `CHANGES_REQUESTED` com uma observação.
- **Arquivar / restaurar:** `PUBLISHED` ↔ `ARCHIVED`. Não há exclusão de lição publicada ou arquivada.

Não existe endpoint para editar tema, semana ou referência depois da criação.

### 3.3 Invalidação e blindagem na revisão

Um **ciclo de revisão** existe enquanto alguma etapa está em `IN_REVIEW`, `APPROVED` ou `CHANGES_REQUESTED` (o status da etapa editada é avaliado antes de ela mudar).

- **Dentro do ciclo, corrigir um item não derruba os outros.** Salvar ou regenerar uma etapa não marca nenhuma outra como `STALE`. Etapas `APPROVED`, `IN_REVIEW` e `CHANGES_REQUESTED` nunca são invalidadas.
- **Item aprovado é blindado.** Não pode ser salvo nem regenerado; para mexer nele o revisor reabre (`POST /stages/reopen`). Item em revisão também não é regenerado: precisa ser devolvido.
- **Fora do ciclo** (produção inicial) vale a regra antiga: gerar ou salvar uma etapa marca as posteriores já iniciadas como `STALE`.
- Ciclo típico: o revisor aprova sete itens e devolve um → o produtor edita ou regenera só esse item (`DRAFT`, lição `IN_PROGRESS`) → conclui (`PRODUCER_APPROVED`, lição `PACKAGE_READY`) → "Iniciar revisão" envia apenas esse item a `IN_REVIEW` → aprovado, a lição vai a `READY_FOR_PUBLICATION`. Os sete aprovados permanecem `APPROVED` o tempo todo.
- Consequência aceita: um item aprovado pode ficar coerente com uma versão anterior de um item corrigido depois (por exemplo, o versículo). A API não bloqueia; o painel avisa comparando as datas das versões atuais.

## 4. Geração

### 4.1 Pedido, lease e retomada

`POST /:id/stages/generate` valida o pedido, calcula no servidor o snapshot do provedor e o prompt efetivo do administrador, grava tudo em `lesson_stages.generation_request_json` e marca a etapa `GENERATING`. Se o snapshot não puder ser calculado, a rota responde 503 (`LESSON_9313`).

- O processamento roda em segundo plano na própria API, limitado por `AI_LESSONS_MAX_CONCURRENT_GENERATIONS` (padrão 3 por instância).
- Cada tentativa usa um UUID próprio como dono da lease (`generation_lease_owner`). A lease dura 30 s, é renovada a cada 10 s e é calculada e comparada **com o relógio do banco** (`DATE_ADD(NOW(), …)`); renovar não altera `lock_version`.
- Uma renovação recusada aborta a tentativa. No desligamento da aplicação os heartbeats param e as leases são liberadas.
- Pedidos pendentes são retomados na inicialização e a cada 5 s; só uma lease ausente ou vencida pode ser assumida, e uma geração já ativa no próprio processo não é reassumida.
- São permitidas **3 tentativas** por pedido (primeira execução + retomadas). Esgotadas, a etapa falha com `GENERATION_ATTEMPTS_EXHAUSTED`.
- **Checkpoints:** o texto gerado e cada imagem enviada ao S3 são registrados no pedido. A retomada reaproveita o que já foi pago enquanto o conteúdo dos itens anteriores não mudou.

Antes de gravar a versão, a API trava a lição, confere a posse da lease e recarrega as versões na mesma transação. Se o conteúdo dos itens anteriores mudou durante a geração, a etapa falha com `UPSTREAM_CHANGED` e os uploads não confirmados são removidos.

O `changeSummary` da versão gerada registra provedor, modelo e total de tokens informados pelo provedor (não há coluna própria para isso).

### 4.2 Provedor de IA

O Estúdio usa exclusivamente as configurações salvas em `/adm/config-provedores-ia` (tabela `ai_provider_settings`). Nenhum provedor, modelo, chave ou parâmetro é lido de variáveis de ambiente. Não há fallback entre provedores.

- **Snapshot por tentativa:** provedor, modelos de texto e imagem, qualidade, esforço de raciocínio, modelo fallback, tamanho de imagem e política de retries são congelados no pedido. A chave de API nunca entra no snapshot.
- **Chaves de API:** persistidas como `enc:v2:<kid>:…` (AES-256-GCM, chave derivada por HKDF, provedor como dado autenticado) quando `AI_PROVIDER_SETTINGS_ENCRYPTION_KEY` está definida. `AI_PROVIDER_SETTINGS_ENCRYPTION_KEY_PREVIOUS` permite rotação; valores `enc:v1` e texto puro legado continuam legíveis e migram no próximo salvamento. **Sem a chave mestra as chaves ficam em texto puro**; em produção (`ENVIRONMENT` = `prod`/`production`), salvar uma chave nova nessa condição é recusado, e a API registra um aviso na inicialização.
- Uma chave salva que não pode ser lida com a chave mestra atual é sinalizada (`apiKeyUnreadable`) e preservada: salvar outras configurações não a apaga.
- **Contrato de escrita da chave:** `apiKey` omitido preserva; `''` remove; outro valor substitui. Valores iniciados por `enc:` são rejeitados. As respostas só informam `hasApiKey`.
- Ativar um provedor sem chave configurada é recusado (400).
- **Validação:** `imageQuality` (`low`, `medium`, `high`, `auto`), `reasoningEffort` (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`) e `imageSize` (`1K`, `2K`, `4K`) são enums. Gemini: `maxRetries` de 0 a 5 e `retryBaseDelayMs` de 0 a 10.000; cada espera é limitada a 60 s.
- **Catálogo:** a lista da OpenAI vem da consulta ao vivo filtrada (famílias `gpt-`, `o1`, `o3`, `o4` e `gpt-image-`; variantes de áudio, busca, instruct e DALL·E ficam fora) ou, em falha, da lista de contingência com `source: 'FALLBACK'`. A consulta entra na fila de IA com prioridade e espera curta.
- **OpenAI:** `max_output_tokens` é enviado em todas as etapas para modelos sem raciocínio; `reasoning.effort` é enviado apenas às famílias que o suportam e `none` é omitido para a série o. Recusas (`refusal`) e respostas incompletas são rejeitadas.
- **Gemini:** saída JSON estruturada; candidatos com `finishReason` diferente de `STOP` são rejeitados; bloqueio de segurança não consome o modelo fallback. Retries usam jitter e respeitam `Retry-After`.
- Toda chamada passa pela fila Redis descrita em [`ai-request-queue.md`](ai-request-queue.md).

### 4.3 Prompts

- O system prompt tem fonte única para os dois provedores (`constants/lesson-system-prompt.constants.ts`) e inclui apenas as regras da etapa pedida. Os campos de entrada são declarados como dados, não instruções.
- O prompt personalizado do administrador é **anexado** ao prompt-base da etapa (por categoria); nunca substitui regras editoriais, segurança infantil, formato de impressão ou contrato bíblico. A resposta de preferências devolve o `effectivePrompt` já composto.
- Escrita de preferências usa atualização condicional por `lock_version`; restaurar o padrão mantém a linha com `custom_prompt = ''` e versão monotônica. A unicidade é `(adminId, category, stage)`.

Versões dos templates:

| Etapa | Versão |
| --- | --- |
| `LESSON` | 4.5.0 |
| `LESSON_VISUALS` | 3.0.1 |
| `STANDARD_GAME` | 3.2.0 |
| `VERSE_VISUALS` | 1.1.1 |
| `VERSE_FIXATION` | 2.2.0 |
| `MEDITATION_YOUNGER` | 1.3.0 |
| `MEDITATION_OLDER` | 2.0.1 |
| `MANUAL_WORK` | 1.1.0 |
| Templates do Material Especial | 1.0.0 |

Mudanças de template valem para novas gerações; conteúdos já salvos não são reescritos.

### 4.4 Regras editoriais por etapa

**Lição (item 1).** O prompt-base contém notas editoriais curadas dos exemplos das Semanas 14, 15, 25 e 26 (`constants/lesson-editorial.constants.ts`). A narrativa é uma aula desenvolvida para crianças de 5 a 11 anos, com abertura participativa, instruções ao professor e ensino integrado. O contrato aceita de oito a dez perguntas com gabarito. `closingPrayer` fica vazio por padrão; a oração do apelo permanece em `applicationAndAppeal`. O propósito é uma frase curta; o versículo de memorização é curto, fiel e contextualizado (preferencialmente até 20 palavras — orientação do prompt, não validação). Quando há mais de uma história, linhas `### Nome do relato (referência)` viram títulos H3. O backend rejeita `story` vazio, fala com aspas sem fechamento, término com sinal de continuação ou subtítulo sem texto (`AI_INCOMPLETE_RESPONSE`). Essas verificações detectam sinais formais; não certificam exatidão bíblica.

O cabeçalho apresenta blocos separados: `LIÇÃO <semana>`, `TÍTULO` e o tema, seguidos de `TEXTO BÍBLICO` e `PROPÓSITO`. Títulos antigos com número e tema unidos são separados na prévia, na exportação e no documento do editor, sem regenerar o conteúdo.

**Visuais da história (item 2).**
- `REGULAR`: `visualType` é sempre `CUTOUT_KIT` (padrão quando omitido; outros tipos respondem 400). `visualQuantity` (4 a 10) é o número de pranchas. Cada asset é uma prancha `{ id: 'kit-NN', category, title, items[], layoutPlan, prompt, altText }`, com `category` em `CHARACTERS`, `ANIMALS`, `BUILDINGS`, `SCENERY`, `SKY_AND_NATURE`, `OBJECTS`, mais um `coverageChecklist`. O servidor valida IDs, quantidade, `storyEvidence` literal na lição, checklist e peças extras, com até duas correções automáticas. As imagens têm fundo branco e sem texto; a prancha de personagens é gerada primeiro e serve de identidade visual; as legendas são aplicadas pelo exportador.
- `SPECIAL`: mantém os cartazes de cena (`STORY_SEQUENCE` e demais) e rejeita `CUTOUT_KIT`. A IA divide a narrativa completa em exatamente `visualQuantity` trechos literais, contínuos e consecutivos; a primeira cena estabelece a identidade visual e todas as seguintes a recebem como referência.

**Brincadeira (item 3) e fixação do versículo (item 5).** Cada passo tem exatamente um visual instrucional, na mesma ordem; o máximo é de **8 passos**, validado no schema e localmente. A brincadeira dura de 10 a 15 minutos, sem eliminação nem filas, com simplificação para 5–7 anos e desafio para 8–11. Ao regenerar, os nomes de todas as versões anteriores e as oito últimas variantes completas vão à IA como referências negativas; se a resposta repetir uma dinâmica, há uma segunda tentativa automática, e nova repetição é rejeitada.

**Visuais do versículo (item 4).** A IA escolhe de uma a nove partes para o texto e acrescenta uma última parte só com a referência; o backend recompõe cada `displayText` a partir das palavras do versículo NVI aprovado. O texto faz parte da própria arte (tipografia infantil extragrande); não há texto sobreposto pelo frontend ou pelo PDF.

**Meditação dos menores (item 6).** Folha A4 retrato com duas cópias idênticas, moldura preta, faixa de título, destaque amarelo no versículo e oração em faixa cinza. O gabarito fica fora da folha. Se o conteúdo não cabe na folha, a exportação responde 422 em vez de cortar o texto.

**Meditação dos maiores (item 7).** Três atividades estruturadas (narrativa, compreensão e aplicação), cada uma com `mechanic`, `goal`, `sourceExcerpt`, `context`, `command`, `supportText`, `subitems` (1 a 6, com `prompt`, `options`, `answer`) e `visualRequired`. Não há mínimo artificial de palavras. **Sempre três imagens**, IDs 1, 2 e 3, uma por questão. Caça-palavras usa grade nativa validada (linhas retangulares, todas as palavras em oito direções, acentos normalizados) e é reconstruído localmente quando inválido; a arte da atividade é mantida. Cruzadinhas textuais usam `#`, `.` e dígitos. `SEQUENCE` usa `sequenceEvents`; o servidor embaralha e calcula o gabarito. Uma revisão separada, com system prompt próprio, confere texto (`reviewPhase` `TEXT`) e artes (`IMAGES`); só issues `BLOCKER` causam correção, com até duas correções. O encaixe estimado é diagnóstico de diagramação: a versão é salva mesmo com overflow, o editor sinaliza e a exportação responde 422 quando a folha excede o ajuste legível (fonte mínima de 10 pt).

**Trabalho manual (item 8).** Uma única arte para pintar (contornos pretos, fundo branco, sem cores). O PDF usa A4 retrato com duas cópias empilhadas e moldura; texto longo que elimina o espaço mínimo da arte é rejeitado antes da conversão.

Todas as etapas recebem a mesma política genérica de qualidade. As etapas derivadas preservam literalmente o versículo aprovado. Essas instruções exigem autorrevisão do provedor e não substituem a revisão humana.

### 4.5 Imagens

- Toda imagem devolvida pelo provedor é validada por assinatura (PNG ou JPEG) e tamanho (até 15 MiB) antes do upload; caso contrário a etapa falha com `AI_IMAGE_INVALID`.
- A geração de imagem na OpenAI repete uma única vez em queda de conexão (`ECONNRESET`, `EPIPE`, `EAI_AGAIN`). Retries podem gerar cobrança adicional.

## 5. Conteúdo editado e prontidão

O AST Tiptap editado é a fonte da prévia e da exportação. Ao salvar, o servidor reconcilia o AST com os dados estruturados:

- **A base é sempre o dado estruturado do servidor.** O `structuredDataJson` enviado pelo cliente não é persistido; só os campos derivados do AST são aplicados.
- **Itens 2, 4 e 8** (`LESSON_VISUALS`, `VERSE_VISUALS`, `MANUAL_WORK`) são integralmente autoritativos do servidor.
- **Lição:** `title`, `biblicalReference`, `purpose`, `songs`, `memoryVerse`, `principleExplanation`, `story`, `applicationAndAppeal`, `counseling`, `reviewQuestions`, `closingPrayer`. Uma seção só termina em um título reconhecido (um H2 dentro da narrativa não a trunca); **remover o título de uma seção esvazia o campo**.
- **Versículo:** aceita vários parágrafos, travessão interno e referência entre parênteses; referência malformada é rejeitada com mensagem específica.
- **Perguntas:** respostas de vários parágrafos e `pergunta? Resposta: x` na mesma linha são reconhecidas.
- **Jogos:** `name`, `objective`, `funMechanics`, `materials`, `preparation`, `steps` (e `assets[].instruction`), `rulesAndSafety`, `biblicalPrinciple`, `evaluation`, `durationMinutes`, `ageGroup`, `splitRationale` e adaptações por idade.
- **Meditações:** título, versículo, instruções, oração (e `biblicalText`/`introduction` no item 7). Nas meditações, um título de seção ausente mantém o valor anterior; `mechanic`, `subitems` e gabarito do item 7 não são sincronizados pela edição.
- Assets e URLs do servidor são preservados; a edição não adiciona nem remove artes.

`assertStageReadyForCompletionOrPublication` bloqueia concluir, aprovar, pré-visualizar, exportar e publicar etapas com campos obrigatórios vazios ou desalinhados (por exemplo, passos e imagens em quantidades diferentes). A exigência é por etapa e não depende de a chave existir no dado.

## 6. Eventos (SSE)

`GET /:id/events` envia snapshots da lição. A cada 2 s o servidor calcula um digest leve (lição, etapas e contagem de observações); o grafo completo só é carregado quando o digest muda. Sem mudança, envia um evento `heartbeat`. A conexão encerra após 90 ciclos (~180 s) para rotação. Há limite de 4 conexões por usuário e lição; acima disso a rota responde 429 (`LESSON_9311`).

## 7. Publicação

`POST /:id/publish-week-material`:

1. Sob lock, reserva a lição (`READY_FOR_PUBLICATION` → `PUBLISHING`) com lease de 60 s renovada a cada 20 s.
2. Renderiza um PDF por etapa aprovada (8 ou 3), todos antes de criar a página. Os PDFs gerados na aprovação vêm do cache.
3. Confere a posse da lease e cria a página de material semanal com `sourceLessonId` (único).
4. Vincula a página e marca `PUBLISHED`.

- Requisições concorrentes recebem 409. Lição já publicada devolve o vínculo existente.
- **Republicar:** se o material vinculado a uma lição `PUBLISHED` foi apagado em Materiais Semanais, a mesma rota limpa o vínculo sob o lock e publica de novo (os itens continuam aprovados). Só "não encontrado" conta como apagado; erro na consulta propaga. Lição `ARCHIVED` continua bloqueada (409 `LESSON_9306`). `LESSON_9312` não é mais emitido.
- **Falha de PDF nomeia o item:** o erro e `publicationFailureMessage` começam com o nome do item (`Visuais da história: …`), com `LESSON_9314` e 422 (conteúdo) ou 503 (conversor).
- Outras falhas antes de criar a página devolvem a lição a `READY_FOR_PUBLICATION` com mensagem pública genérica (o detalhe fica no log).
- **Página criada é a fonte da verdade:** depois que a página existe, a lição é sempre vinculada e marcada `PUBLISHED`, mesmo com falha na confirmação ou reserva perdida. Se nesse intervalo um item foi reaberto, ele volta a `APPROVED` quando ainda aponta para a versão publicada; um item cujo conteúdo mudou mantém o status e é registrado em log.
- Um reconciliador roda a cada 5 s: publicações com lease vencida são concluídas (se a página existe) ou liberadas (se não existe). Erro ao consultar o material não é tratado como "não existe".
- Publicar cria o material e dispara o aviso por e-mail; **não** define a semana atual.

**Material Semanal × Material Especial.** O Material Especial é um material semanal com título e descrição próprios; não há coluna de tipo.

| | Semanal (`REGULAR`) | Especial (`SPECIAL`) |
| --- | --- | --- |
| Título | `Semana N — tema` | `Material Especial (Semana N) — tema` ou `Material Especial — tema` |
| Descrição | `Material completo da semana N, revisado e aprovado.` | termina com a marca `[tipo:especial]`, lida pelo painel para o selo |
| Base do `path` | só a semana: `materiais_semanal_semana_N` | o título: `materiais_semanal_material_especial_…` |
| E-mail | "Novo material da semana" | "Novo material especial" (mesmo e-mail e mesma flag) |

A descrição não leva mais `[origem:licao:<id>]`: o vínculo é `sourceLessonId`. Páginas antigas ainda têm o marcador, usado apenas como contingência ao reconciliar uma publicação interrompida. Os marcadores internos nunca vão para o e-mail.

**Rotas duplicadas.** Dois materiais com a mesma base recebem sufixo numérico sequencial: `materiais_semanal_semana_27`, `materiais_semanal_semana_27_1`, `materiais_semanal_semana_27_2`. Uma página manual "Semana 27" criada antes ocupa a base, e a publicação do Estúdio fica com `_1`. Não há sufixo aleatório. Ver [api-week-materials.md](api-week-materials.md#route-path).

### 7.1 Prévia da publicação

`GET /:id/publication-preview` é leitura pura e responde:

```json
{
  "title": "Semana 27 — O Bom Pastor",
  "isSpecial": false,
  "documentCount": 8,
  "weekMaterial": { "id": "…", "exists": true, "routePath": "materiais_semanal_semana_27", "currentWeek": false },
  "duplicates": [{ "id": "…", "title": "Semana 27", "routePath": "materiais_semanal_semana_27" }]
}
```

- `title`: o título que a publicação vai gravar (mesma função usada ao publicar).
- `weekMaterial`: `null` se a lição nunca foi publicada; `exists: false` (com `routePath: null`, `currentWeek: false`) quando a página vinculada foi apagada.
- `duplicates`: até 5 páginas existentes, exceto a da própria lição, que são o mesmo material — `REGULAR`: título com `Semana N` para o mesmo número inteiro (Semana 1 não casa com Semana 12; páginas com a marca de especial ficam fora); `SPECIAL`: mesmo título normalizado (sem acento, caixa e pontuação). É aviso: a publicação nunca é bloqueada por duplicata.

## 8. Arquivos, imagens e PDF

**Propriedade de assets.** Os uploads usam a chave `<ambiente>/uploads/<timestamp>_<uuid8>_<lessonId>-<ETAPA>-<assetId>.<ext>`. Um objeto pertence à lição quando o nome original (após o prefixo `<timestamp>_<uuid8>_`) começa com `<lessonId>-`; a forma legada sem prefixo também é reconhecida. Na exclusão, as URLs referenciadas por outras lições ou por mídias são descartadas em uma consulta antes do commit; a remoção no S3 ocorre depois e nunca transforma a exclusão em erro.

**Auditoria de órfãos** (`scripts/s3/audit-orphans.js`): dry-run por padrão (`--delete` exige `--confirm`); consulta `media_items`, `lesson_versions` e etapas em geração; ignora objetos modificados nas últimas 48 h (`--grace-hours=N`); órfãos do Estúdio saem em seção própria e nunca são apagados pelo script.

**Leitura de imagens para DOCX/PDF.** Objetos do bucket são lidos pelo SDK; se falhar, usa o download HTTP protegido: apenas `http`/`https` nas portas 80/443, sem credenciais, sem proxy, sem redirecionamentos, IPs privados/loopback/link-local bloqueados em IPv4 e IPv6, IP resolvido fixado contra DNS rebinding, limite de 15 MiB e de 45 s por download, assinatura PNG/JPEG validada. WebP é rejeitado com 422.

**Exportador DOCX.** Preserva fontes, tamanhos, cores, negrito, itálico, sublinhado, destaque, alinhamento, espaçamento, parágrafos vazios, links (`http`, `https`, `mailto`, `tel`) e tabelas. Cores em `rgb()` ou por nome são normalizadas; caracteres de controle são removidos; imagens mantêm a proporção real. Asset obrigatório sem URL ou atividades além do suportado respondem 422.

**Cabeçalhos.** Os PNGs padrão estão empacotados em `src/modules/ai-lessons/assets`. `LESSON_HEADER_LEFT_PATH`, `LESSON_HEADER_RIGHT_PATH` e `MEDITATION_HEADER_LEFT_PATH` são sobrescritas opcionais.

**Conversão PDF (LibreOffice).** Exige o binário `soffice` e fontes no servidor; a API registra um aviso na inicialização se faltarem. Concorrência por `PDF_CONVERSION_MAX_CONCURRENCY` (padrão 2; `AI_LESSONS_MAX_PDF_CONVERSIONS` ainda é aceita), fila de espera limitada a 16 (503 imediato além disso), timeout de 90 s com encerramento do grupo de processos e cache em memória por `versionId:checksum`. O cliente recebe mensagem genérica; o detalhe fica no log.

## 9. Erros

Os erros de negócio usam `AppException` com `ErrorCode` `LESSON_93xx`, e as falhas de geração ficam em `failureCode` da etapa. As tabelas estão em [`error-handling.md`](error-handling.md).

## Pendências conhecidas

- Não há endpoint para editar tema, semana ou referência da lição após a criação.
- Trilha de auditoria: as ações são registradas em log estruturado; uma tabela `lesson_events` exige mudança de schema.
- Schema: índice único duplicado em `week_material_pages.source_lesson_id` e `DB_SYNCHRONIZE` ligado por padrão em `database.module.ts`.
- A busca de duplicatas examina as 50 páginas mais recentes que casam com os fragmentos do título.
- A publicação dispara o e-mail de aviso imediatamente; falta um parâmetro `announce` no serviço de materiais semanais.
- Gemini não envia `maxOutputTokens`.
- Os nomes de modelo padrão (`gpt-6-luna`, `gpt-image-2` e as listas de contingência) não foram validados contra os catálogos reais.
- `src/shared/providers/ai-queue` depende do módulo `ai-lessons` (dependência invertida).
- `lesson-generation.service.ts` ainda tem cerca de 1.000 linhas.
- A imagem Docker com LibreOffice e fontes ainda não foi construída nem verificada.
- O encaixe da folha da meditação dos menores é estimado e não foi calibrado contra um PDF real.
- Não há testes de concorrência contra banco real nem testes HTTP com guards e validação.
- Detecção de item desatualizado compara datas de criação das versões; não há checksum do upstream gravado na versão.

## Histórico

Regras substituídas, mantidas aqui porque explicam conteúdos já salvos:

- **Visuais da história por trecho literal (template 2.x):** as lições `REGULAR` usavam cenas com `sourceExcerpt`. Desde o template 3.0.0 (2026-11-02) usam o kit de recortes; lições antigas continuam legíveis.
- **Item 7, contratos 1.x:** exigiam mínimos de palavras (200 por folha, 110 por bloco, seis subitens), correções focadas de bloco e artes apenas quando necessárias, com remoção da arte do caça-palavras reparado. O contrato 2.x eliminou os mínimos e passou a exigir sempre três imagens.
- **Lição, template 4.4.0:** as regras de propósito, memorização, aplicação e integridade foram incorporadas ao 4.5.0.
- **Sufixo aleatório de rota e marcador de origem:** publicações anteriores a 2026-11-10 gravavam `[origem:licao:<id>]` na descrição e derivavam o `path` do título completo (`…semana_27_tema`). Rotas existentes não foram alteradas.
- **`LESSON_9312` (material vinculado ausente):** a publicação respondia 409; hoje publica novamente.
- **Invalidação em cascata na revisão:** salvar ou regenerar um item derrubava todos os posteriores, inclusive aprovados.
- **Reconciliação manual de publicação:** antes das leases de publicação, uma falha após criar a página exigia intervenção operacional.
- **Lease `workerId:uuid`:** valores antigos de 73 caracteres não cabiam em `generation_lease_owner`; pedidos presos por eles são retomados pelo mecanismo atual.
- **`apiKey` na query de modelos e chaves em DTOs públicos:** removidos.
