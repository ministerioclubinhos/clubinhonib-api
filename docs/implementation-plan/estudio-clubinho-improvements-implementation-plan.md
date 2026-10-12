# Plano de Implementação Backend — Estúdio Clubinho: correções baseadas em evidências

**Status:** plano auditado; correções delimitadas e decisões pendentes identificadas. Implementação não executada.

**Revisão:** 2026-10-11 — revisão 2, após a exigência de precisão e zero suposições.

**Repositório / commit-base:** `clubinhonib-api` / `d90c373efdcf34ee2eb06dcd50efe4d1a18b8e48`.

**Contrato complementar:** [plano frontend](../../../clubinhonib-app/docs/implementation-plan/estudio-clubinho-improvements-implementation-plan.md), baseado em `8d07971c5ffdc9abc85f0ca74eb2c0e395e36086`.

---

## 0. Contrato de precisão — zero suposições

O solicitante pediu análise e dois planos de melhoria, sem invenções. Este documento não autoriza implementação, migração, deploy ou mudanças em dados existentes nesta tarefa.

Classificação obrigatória:

- **FATO:** comportamento localizado no código, com arquivo/símbolo/linha.
- **REPRODUZIDO:** comportamento executado com entradas e ambiente registrados.
- **RISCO:** consequência possível, ainda sem prova integral de ocorrência. Não apresentar como incidente em produção.
- **CORREÇÃO PLANEJADA:** trabalho vinculado a uma evidência; não é comportamento atual.
- **DECISÃO PENDENTE:** regra/contrato não determinado pelos arquivos e pelo pedido. Registrar a escolha antes de implementar o item dependente, sem escolher silenciosamente.

Cada implementação deve ligar **achado → arquivos → contrato → teste de regressão → aceite**. Se o código-base mudar, reconferir as evidências. A aprovação de uma suite não demonstra ausência de defeitos fora dos casos exercitados.

Não presumir endpoints, campos, tabelas, filas, feature flags, orçamento de IA, topologia de produção, política de retenção ou valores de SLA. Não prometer execução externa exatamente uma vez. Não inventar migração manual para preencher uma lacuna de desenho.

### 0.1 Correções da primeira versão deste plano

Foram retirados como decisões fechadas: entidade `LessonOperationEntity`, nova API de operações/histórico/restauração, publicação com 202, protocolo SSE v2, flag `ai_studio_generation`, API `allowedActions` e transformação automática de todos os itens `IN_REVIEW` para `PRODUCER_APPROVED`.

Esses elementos eram soluções propostas, não contratos existentes nem escolhas confirmadas. Os problemas que motivaram parte deles permanecem documentados; a solução deve ser decidida/testada sem apresentar arquitetura hipotética como fato.

O salvamento **já usa transação, lock pessimista da lição e comparação de `lockVersion`**. A primeira correção de edição no frontend deve conservar a base original desse campo. Não há evidência de que `baseVersionId` adicional seja indispensável para corrigir FE-02.

## 1. Base da auditoria

Caminhos inspecionados: controllers → DTOs → serviços → repositories/entidades → providers de IA → exportação → criação de Materiais Semanais; também os consumidores frontend envolvidos.

Na revisão 2 não havia diff rastreado ou staged nos repositórios; os planos permaneciam como arquivos novos. Os arquivos locais foram usados como fonte, sem acesso a banco/produção, leitura de credenciais reais, chamadas de IA/S3 ou conversões reais de PDF.

Foram executados novamente **50 testes existentes em três suites**, além de três sondagens usando serviços reais e dependências substituídas em memória. As sondagens comprovam somente os comportamentos descritos na seção 10; não validam locks reais do MySQL, queda de processo, rede ou layout de documentos.

Normas lidas: [AGENTS.md](../../AGENTS.md), [boas práticas backend](../../docs/CLUBINHO_BACKEND_BEST_PRACTICES.md), [requisitos de banco](../../AI_DATABASE_CHANGE_REQUIREMENTS.md), [erros](../../docs/error-handling.md) e [regras de domínio](../../docs/implemented-rules.md). Código e documentação conflitantes precisam ser reconciliados; não escolher silenciosamente o texto mais conveniente.

## 2. Inventário confirmado

| Camada | Arquivo real | Capacidade existente |
| --- | --- | --- |
| HTTP | [ai-lessons.controller.ts](../../src/modules/ai-lessons/controllers/ai-lessons.controller.ts) | Prefixo `/api/v1/lessons`, JWT + administrador; CRUD do pacote, etapas, revisão, preferências, PDFs, SSE e publicação |
| Providers HTTP | [ai-providers.controller.ts](../../src/modules/ai-lessons/controllers/ai-providers.controller.ts) | Prefixo `/api/v1/lessons/providers`, JWT + administrador; settings e consulta de modelos |
| Orquestração | [lesson-draft.service.ts](../../src/modules/ai-lessons/services/lesson-draft.service.ts) | Criação, geração, edição, revisão, exportação, publicação e exclusão |
| Persistência | [ai-lessons.repository.ts](../../src/modules/ai-lessons/repositories/ai-lessons.repository.ts) | Transações, leitura com lock, listagem, dashboard, leases e versões |
| Entidades | `src/modules/ai-lessons/entities/` | `LessonEntity`, `LessonStageEntity`, `LessonVersionEntity`, `LessonCommentEntity`, `AdminLessonPromptEntity`, `AiProviderSettingEntity` |
| IA | [configured-lesson-llm.provider.ts](../../src/modules/ai-lessons/providers/configured-lesson-llm.provider.ts) | Seleção de provider com configuração persistida; implementações OpenAI/Gemini |
| Documentos | [docx-exporter.service.ts](../../src/modules/ai-lessons/services/docx-exporter.service.ts), [pdf-libreoffice.service.ts](../../src/modules/ai-lessons/services/pdf-libreoffice.service.ts) | Construção DOCX, obtenção de imagens e execução de LibreOffice |
| Publicação | [create-week-material.service.ts](../../src/modules/pages/week-material-page/services/create-week-material.service.ts) | Criação de página/rota/mídia; notificação após criação; usado pelo serviço do Estúdio |
| Migrations | [data-source.ts](../../src/database/data-source.ts), `src/database/entities.ts`, scripts em `package.json` | CLI e lista compartilhada já existem; DataSource usa `synchronize: false` |

### 2.1 Estados e produtos existentes

Fonte: [lesson.enums.ts](../../src/modules/ai-lessons/enums/lesson.enums.ts).

- **Lição:** `DRAFT`, `IN_PROGRESS`, `PACKAGE_READY`, `IN_REVIEW`, `CHANGES_REQUESTED`, `READY_FOR_PUBLICATION`, `PUBLISHING`, `PUBLISHED`, `ARCHIVED`.
- **Etapa:** `NOT_STARTED`, `GENERATING`, `DRAFT`, `PRODUCER_APPROVED`, `IN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `FAILED`, `STALE`.
- **Ordem:** `LESSON`, `LESSON_VISUALS`, `STANDARD_GAME`, `VERSE_VISUALS`, `VERSE_FIXATION`, `MEDITATION_YOUNGER`, `MEDITATION_OLDER`, `MANUAL_WORK`.

Existir enum `ARCHIVED` não prova existência de endpoint para arquivar. O controller inspecionado não define essa operação. Não criar botão/rota com base somente nesse enum.

Preservar os contratos editoriais vigentes em [api-ai-lessons.md](../../docs/api-ai-lessons.md), suas implementações e fixtures. Esta revisão não redefine quantidade de perguntas, faixa etária, modelos, qualidade das artes ou geometria de impressão. Documentos contêm anotações históricas que precisam ser confrontadas com a regra posterior/código ao tocar a etapa correspondente.

## 3. Contratos HTTP atuais

Rotas abaixo são as declaradas nos controllers auditados. Não há nova API nesta tabela.

| Método / caminho completo | DTO / resultado atual |
| --- | --- |
| `POST /api/v1/lessons` | `GenerateLessonRequestDto` → `LessonResponseDto`; controller declara 201 |
| `GET /api/v1/lessons` | `QueryLessonsDto` → `LessonListResponseDto` |
| `GET /api/v1/lessons/dashboard` | `LessonDashboardResponseDto` |
| `GET /api/v1/lessons/:id` | UUID → `LessonResponseDto` |
| `GET /api/v1/lessons/:id/events` | SSE com `data: toLessonResponse(lesson)` |
| `DELETE /api/v1/lessons/:id` | UUID → `{ success, message }`; controller declara 200 |
| `POST /api/v1/lessons/:id/stages/generate` | `GenerateStageRequestDto` → `LessonResponseDto` |
| `PATCH /api/v1/lessons/:id/stages/content` | `SaveTiptapContentDto` → `LessonResponseDto` |
| `POST /api/v1/lessons/:id/stages/complete-production` | `ReviewStageRequestDto`; utiliza `stage` → lição |
| `POST /api/v1/lessons/:id/package/submit-review` | UUID, sem DTO de body no handler → lição |
| `POST /api/v1/lessons/:id/stages/approve` | `ReviewStageRequestDto`; utiliza `stage` → lição |
| `POST /api/v1/lessons/:id/stages/request-changes` | `ReviewStageRequestDto`; utiliza `stage`/`note` → lição |
| `POST /api/v1/lessons/:id/export/pdf` | UUID → `StreamableFile`, attachment |
| `GET /api/v1/lessons/:id/stages/:stage/preview.pdf` | UUID + enum de etapa → `StreamableFile`, inline |
| `POST /api/v1/lessons/:id/publish-week-material` | UUID → `{ lesson, weekMaterialId }` após aguardar publicação |
| `GET /api/v1/lessons/prompt-preferences/me` | Preferências do administrador autenticado |
| `PATCH /api/v1/lessons/prompt-preferences/me` | `SaveAdminLessonPromptDto` → preferência |
| `POST /api/v1/lessons/prompt-preferences/me/reset` | `ResetAdminLessonPromptDto` → preferência restaurada |
| `GET/PUT /api/v1/lessons/providers/settings` | DTOs agregados de settings |
| `GET/PUT /api/v1/lessons/providers/openai/settings` | DTOs de settings OpenAI |
| `GET/PUT /api/v1/lessons/providers/gemini/settings` | DTOs de settings Gemini |
| `GET /api/v1/lessons/providers/openai/models` | Query `apiKey?` no handler; resposta `{ models: { general, image } }` |
| `GET /api/v1/lessons/providers/gemini/models` | Resposta `{ models: { general, image } }` |

### 3.1 Campos/limites conferidos

| DTO | Definição atual relevante |
| --- | --- |
| [GenerateLessonRequestDto](../../src/modules/ai-lessons/dto/generate-lesson-request.dto.ts) | `theme`: string 3–255; `biblicalReference`: string 3–500; `weekNumber`: inteiro ≥ 1. Não existe máximo 52 no DTO |
| [QueryLessonsDto](../../src/modules/ai-lessons/dto/query-lessons.dto.ts) | `status?` único; `search?` até 200; page padrão 1 e mínimo 1; limit padrão 10, entre 1 e 50; sort `createdAt/updatedAt/theme/weekNumber`, padrão `updatedAt`; order `ASC/DESC`, padrão `DESC` |
| [GenerateStageRequestDto](../../src/modules/ai-lessons/dto/generate-stage-request.dto.ts) | `stage`; instruções opcionais até 1.000; configuração visual opcional no DTO, quantidade 4–10. Serviço valida configuração exigida para `LESSON_VISUALS` |
| [SaveTiptapContentDto](../../src/modules/ai-lessons/dto/save-tiptap-content.dto.ts) | `tiptapAstJson` objeto; `structuredDataJson?` objeto; `stage` enum; `lockVersion` inteiro ≥ 1; `changeSummary?` string, sem MaxLength nesse DTO |
| `ReviewStageRequestDto` | `stage`; `note?` string até 1.000. `requestChanges` rejeita ausência/texto vazio após trim; concluir/aprovar não exigem note |
| [LessonResponseDto](../../src/modules/ai-lessons/dto/lesson-response.dto.ts) | Etapa expõe `currentVersionId`, `lockVersion`, `failureMessage`, `versions`; **não expõe `failureCode`**. Versão permite `structuredDataJson: null` |
| `LessonListResponseDto` | `{ items, total, page, limit, totalPages }`; não substituir por outro envelope silenciosamente |
| Settings | `apiKey?: string` nos DTOs de escrita; `apiKey: string` nos DTOs de leitura. Escrita agregada exige provider, `openai` e `gemini`; detalhes são opcionais nos objetos aninhados |

O `ValidationPipe` global em `src/main.ts:21` tem transformação, whitelist e rejeição de propriedades não declaradas. Não enviar campos propostos aos DTOs atuais. Erros usam o filtro/envelope global existente; não afirmar novo código de erro sem inclusão real no catálogo.

### 3.2 Leitura e SSE

`findDraftsPaginated` faz join de etapas, mas **não** de versões/comentários. `findLessonById` carrega `stages`, `stages.versions`, `comments`. O mapper converte relação ausente em array vazio; isso não significa que uma etapa da listagem nunca teve versões.

O SSE faz `interval(2000)`, `startWith(0)`, chama `getById` e envia o DTO completo. Não há revisão de evento, replay, percentual por fase ou protocolo v2 nesse handler. Não declarar esses mecanismos como disponíveis.

## 4. Matriz de transições efetivamente implementadas

Fonte principal: `LessonDraftService`. Esta tabela descreve o presente, inclusive lacunas; não é a nova política desejada.

| Operação / linha | Precondição atual | Efeito atual / atomicidade |
| --- | --- | --- |
| `create:128` | DTO validado | Cria lição DRAFT e oito etapas NOT_STARTED em transação |
| `generateStage:260` | Alvo não GENERATING; lição fora de IN_REVIEW/READY_FOR_PUBLICATION/PUBLISHING/PUBLISHED/ARCHIVED; etapa anterior concluída/revisada/aprovada, exceto primeira | Persiste request/ator/status GENERATING em transação e solicita processamento; não verifica outra etapa GENERATING da mesma lição |
| `saveContent:1289` | Lock igual; etapa em DRAFT/PRODUCER_APPROVED/CHANGES_REQUESTED/STALE/FAILED | Nova versão, alvo DRAFT, derivados iniciados STALE, lição IN_PROGRESS; transacional. Não há verificação separada do status global da lição nesse método |
| `completeProductionStage:1365` | Versão atual presente; mesmos cinco estados de etapa editáveis acima | Alvo PRODUCER_APPROVED; lição PACKAGE_READY se todos os demais forem PRODUCER_APPROVED/APPROVED, senão IN_PROGRESS; writes separados, sem `runInTransaction` |
| `submitPackageReview:1410` | Lição PACKAGE_READY; oito etapas; todas com versão e PRODUCER_APPROVED/APPROVED | Transação: PRODUCER_APPROVED → IN_REVIEW; aprovados preservados; lição IN_REVIEW |
| `approveStage:1449` | Lição IN_REVIEW; alvo IN_REVIEW com versão | Transação: alvo APPROVED com ator/data; todos aprovados → READY_FOR_PUBLICATION |
| `requestChanges:1494` | Note não vazia; lição IN_REVIEW; alvo IN_REVIEW com versão | Transação: só alvo CHANGES_REQUESTED; comentário aberto; lição CHANGES_REQUESTED. Outros itens não são normalizados |
| `invalidateDownstream:1549` | Chamada por save/geração | Toda etapa posterior diferente de NOT_STARTED vira STALE; apaga aprovação desses derivados; lição IN_PROGRESS |
| `exportPdf:1581` | Todos os itens retornados APPROVED | Renderiza o conjunto carregado; não torna itens aprovados |
| `previewStagePdf:1616` | Alvo possui versão corrente encontrável | Renderiza a versão corrente, sem aprovação implícita |
| `publishToWeekMaterial:1649` | READY_FOR_PUBLICATION + oito itens APPROVED com versão; PUBLISHED com vínculo retorna vínculo existente | Reserva PUBLISHING; renderiza oito PDFs; cria página; salva PUBLISHED/vínculo em outra transação |
| `delete:1742` | Rejeita PUBLISHING, qualquer GENERATING e PUBLISHED | Remove lição, depois tenta remover arquivos; leitura de precondições e remoção não estão na mesma transação |

Dependência linear: `assertDependency:231` exige a etapa imediatamente anterior em `PRODUCER_APPROVED`, `IN_REVIEW` ou `APPROVED` e reúne fontes anteriores elegíveis. Essa regra já existe; não convertê-la em grafo seletivo sem estudo/decisão.

## 5. Achados e evidências

P0/P1/P2 representam ordem técnica de tratamento, não incidência medida. Cada risco ainda não reproduzido deve virar teste antes de uma implementação ser considerada validada.

| ID | Prioridade / classe | Evidência / conclusão limitada |
| --- | --- | --- |
| BE-01 | P0 / FATO + REPRODUZIDO ISOLADAMENTE | `GetAiProviderSettingsService:34/47/73` retorna chave salva; setters também a devolvem. Getter real com repository sintético retornou o marcador recebido. Controller exige admin; não afirmar exposição anônima. `apiKey` também é aceito na query de modelos |
| BE-02 | P0 / REPRODUZIDO ISOLADAMENTE | `requestChanges` + `saveContent` + `completeProductionStage` + `submitPackageReview`: devolução/edição do item 8 deixa 1–7 IN_REVIEW e agregado IN_PROGRESS; submissão retorna conflito. Ver R-BE-02 |
| BE-03 | P0 / FATO + RISCO | Conclusão usa duas escritas sem transação; ações de revisão não recebem versão esperada. Save já tem lock e transação. Corrigir cada lacuna separadamente; não dizer que todo o módulo não tem concorrência protegida |
| BE-04 | P0 / FATO + RISCO | `executeStageGeneration:531–546` salva versão, pointer e invalidação sem transação comum e sem condicionar commit à posse atual. `failInterruptedGeneration:335` verifica status, não proprietário/tentativa. Disputa real de workers ainda não foi executada |
| BE-05 | P0 / FATO + RISCO | `generateStage:273` verifica só alvo; `invalidateDownstream:1555` alcança outro item GENERATING. Exclusão mútua global existe na tela, não nesta condição da API. Corrida entre etapas é risco a testar |
| BE-06 | P0 / REPRODUZIDO ISOLADAMENTE | `publishToWeekMaterial:1716–1738`: página criada antes do vínculo; variável `createdPageId` local impede restaurar prontidão nesse ramo. Falha injetada no vínculo deixou uma página criada, lição PUBLISHING e vínculo null; nova chamada recusada. Não foi kill real de processo |
| BE-07 | P0 / FATO + RISCO | Save DTO valida conteúdo somente como objeto; `saveContent:1320` aceita dados estruturados; `DocxExporterService:943/1154` baixa `asset.url`/`url` por Axios. Caminho de URL controlável requer teste de autorização/validação; SSRF não foi explorado |
| BE-08 | P1 / FATO | SSE consulta detalhe completo a cada 2 s; detalhe inclui versões. Volume, latência e memória não medidos. Não afirmar N+1 ou lentidão comprovada |
| BE-09 | P1 / FATO + REPRODUÇÃO DO CONSUMIDOR | Query aceita status único; lista de revisão filtra depois da paginação. Sondagem FE-06 exibiu zero itens para total 14. Correção requer filtro no servidor com contrato fechado |
| BE-10 | P1 / FATO + RISCO | `ConfiguredLessonLlmProvider.selected:19` relê settings em cada texto/imagem. `executeStageGeneration:398` lê prompt no início da execução; request persistido não contém snapshot completo. Mudança durante execução/retomada pode alterar contexto; não foi simulada uma chamada real |
| BE-11 | P1 / FATO + RISCO | Heartbeat em `startGeneration:310` destaca promise sem tratamento local; catch de geração apaga todos `uploadedUrls`, mesmo se uma escrita anterior já ocorreu. Exclusão também tem janela entre leitura e remove. `AwsS3Service.delete` **já captura erro remoto e registra órfão**; não alegar ausência desse tratamento |
| BE-12 | P1 / FATO | Entidade persiste `failureCode`, mapper não expõe; várias condições usam exceções genéricas do Nest, traduzidas pelo filtro global. Não afirmar que o envelope global está ausente |
| BE-13 | P1 / FATO + RISCO | Save sincroniza `story` da LESSON e dados da MEDITATION_OLDER; checksum usa dados estruturados. Não há sincronização genérica demonstrada para todos os campos/etapas. Divergência deve ser reproduzida por campo antes de alterar fonte canônica |
| BE-14 | P2 / FATO | Serviço de drafts reúne workflows diferentes; exportador contém I/O de imagens. Extrair por operação/provider conforme normas, restrito aos caminhos modificados |

`ai_provider_settings` usa `simple-json`; o repository inspecionado não cifra o valor antes de salvar. Isso não informa se disco, volume, backup ou banco têm criptografia em repouso. Não declarar configuração de infraestrutura que não foi auditada.

## 6. Decisões pendentes — bloqueio restrito ao item dependente

Cada fechamento deve registrar escolha, responsável, motivo, DTO/estados afetados, compatibilidade, teste e referência nos dois planos. Não usar nomes candidatos da primeira versão como contratos aprovados.

| ID | O que precisa ser decidido | Evidência que não resolve a escolha | Artefato exigido para liberar implementação |
| --- | --- | --- | --- |
| D-01 | Política de revisão após devolver um item: permitir revisão dos demais durante ajustes ou encerrar/reabrir rodada; tratamento de aprovações existentes | Fluxo atual bloqueia o ciclo, mas não especifica intenção do produto para outras etapas | Matriz completa lição × etapa × ação antes/depois; exemplos devolvendo itens 1, 4 e 8; regra de preservar/invalidar aprovação; nenhum endpoint novo presumido |
| D-02 | Como o filtro de revisão será transportado e validado pelo endpoint de lista | DTO só tem um status; conjunto atual da UI é conhecido | DTO exato de query, encoding, conjunto de estados, combinação com status/busca e resposta; teste de count/página. Não incluir PUBLISHING por suposição |
| D-03 | Contrato público sem leitura de segredo: indicador substituto, preservar/substituir/limpar e variantes legadas | API hoje devolve chave e aceita string opcional; nomes/semântica novos não existem | Exemplos completos de GET/PUT agregado/individuais; representação pública e input de segredo; ordem de rollout e teste de compatibilidade |
| D-04 | Mecanismo de recuperação de publicação após página criada e vínculo ausente | `weekMaterialId` só ajuda após vínculo salvo; não existe identidade persistida de tentativa no fluxo atual | Desenho de atomicidade/idempotência entre os dois módulos; fonte autoritativa para localizar página; schema se necessário; procedimento para PUBLISHING legado; testes em cada ponto de falha |
| D-05 | Identidade da tentativa e protocolo de posse/commit/retomada da geração | Já existem owner/expiry/request no stage, mas finalização não os valida e owner é do worker, não de cada tentativa | Prova/teste de worker antigo versus novo, tentativa anterior do mesmo worker, perda de heartbeat e mudança upstream; decisão mínima sobre metadados adicionais |
| D-06 | Mapeamento AST ↔ dados estruturados por etapa, inclusive versículo e campos imutáveis | Há tratamento específico de história/meditação dos maiores; não há contrato genérico suficiente | Tabela por campo com editor, fonte persistida, uso em derivados/PDF e regra de alteração; fixtures antes/depois; preservação de formato/legado |

D-02 a D-06 têm componentes técnicos que podem ser fechados por investigação e desenho explícitos; D-01 contém uma escolha de comportamento de produto. Nenhum deles bloqueia correções locais de edição, erro de modelos ou proteção de drafts no frontend.

## 7. Pacotes de implementação e aceite

Os passos abaixo são **planejados**. Quando há dependência D-xx, não implementar o contrato dependente antes de fechá-la. Não exigir novas tabelas/filas para correções que possam usar o mecanismo já existente.

### B1 — Recuperar o ciclo de revisão

**Achados:** BE-02/03. **Dependência:** D-01. **Arquivos:** `lesson-draft.service.ts`, repository, DTO de revisão somente se D-01 exigir, testes de workflow; frontend FE-07.

1. Transformar R-BE-02 em regressão permanente antes da correção.
2. Implementar a matriz escolhida, cobrindo todos os itens e aprovações anteriores; normalização de outros estados deve ser consequência explícita de D-01.
3. Tornar conclusão da produção atômica: leitura/lock, alteração da etapa e status agregado usam o mesmo `EntityManager` pelo repository.
4. Preservar validação de note não vazia, autoria dos comentários e separação entre concluir produção, submeter e aprovar.
5. Validar transições concorrentes em testes controlados. Se precondição adicional de versão for necessária, fechar DTO/compatibilidade; não adicionar `expectedVersionId` silenciosamente.

**Aceite:** devolver/editar/concluir/revisar itens 1, 4 e 8 não deixa estado sem ação válida; rejeição não grava parcialmente; itens nunca ficam aprovados sem ação de aprovação válida.

### B2 — Integridade da geração e exclusão concorrente

**Achados:** BE-04/05/11. **Dependência:** D-05 para garantia completa de posse; sem mudança externa de fila.

1. Preservar request durável e scheduler já existentes. Valores atuais: scan 5 s, heartbeat 10 s, lease 30 s. Não alterar sem medir e testar.
2. Fechar D-05; inserir comparação de estado/posse/tentativa no commit e no tratamento de falha. Checar somente owner pode ser insuficiente para uma tentativa antiga do mesmo worker; o teste deve demonstrar a distinção escolhida.
3. Commit de versão + ponteiro + status + invalidação + agregado em transação curta; LLM, upload e conversão ficam fora dela.
4. Revalidar dependências consumidas antes de aceitar resultado. Substituição de fontes enquanto outro trabalho executa não pode publicar resultado obsoleto.
5. Fazer precondições conflitantes usarem a mesma disciplina de lock para geração, edição, conclusão e exclusão. Documentar quais operações podem coexistir; não confiar no fieldset do navegador.
6. Tratar rejeição do heartbeat/disparo destacado e impedir que finalização antiga marque como FAILED uma execução mais nova.
7. Cleanup só remove uploads comprovadamente sem referência persistida. Reutilizar os mecanismos existentes quando cobrem assets do Estúdio; verificar isso, pois o JSON de versões não é automaticamente um `media_item`.

**Aceite:** falhas entre cada escrita deixam estado consistente; worker sem posse não altera versão/status novo; corrida delete/generate não deixa geração ativa sobre lição removida; nenhuma arte referenciada é apagada por compensação.

### B3 — Publicação recuperável sem duplicar material

**Achado:** BE-06. **Dependência:** D-04. **Arquivos:** serviço de drafts, repository e contrato público do serviço de criação de materiais, somente no limite necessário.

1. Incorporar R-BE-06 aos testes e injetar falhas antes de renderizar, em cada PDF, após criar página e ao persistir vínculo.
2. Fechar D-04: comparar solução transacional com identidade de origem persistida/retomada e documentar o mecanismo escolhido. Não criar entidade de operação só porque foi nomeada na primeira versão do plano.
3. Garantir que retomada identifica a página já criada antes de criar outra. Não usar título/tema como prova suficiente de identidade.
4. Preservar regra atual de renderizar os oito PDFs antes da criação da página, nomes por etapa e retorno idempotente quando já há vínculo.
5. Preservar a separação entre criação e seleção de semana atual (`currentWeek`); serviço de materiais já cria com `false`.
6. Verificar efeito da notificação de criação: repetir/reconciliar uma tentativa não deve disparar criação/aviso duplicados. Reutilizar serviço/flag existentes; não criar email novo.
7. Documentar tratamento de registros legados em PUBLISHING sem vínculo. Não restaurar todos para READY_FOR_PUBLICATION cegamente: a página pode já existir.

**Aceite:** para cada ponto de falha, zero páginas incompletas apresentadas como sucesso, no máximo uma página correspondente à mesma publicação concluída e vínculo recuperado; timeout não induz criação duplicada. Não prometer processamento HTTP assíncrono até existir contrato decidido e implementado.

### B4 — Settings sem devolver segredo

**Achado:** BE-01. **Dependência:** D-03. **Arquivos:** controllers de providers, getters/setters, DTOs, resolver interno e integração frontend.

1. Separar resposta HTTP de configuração interna usada em `ConfiguredLessonLlmProvider`; remover chave da resposta sem quebrar a resolução interna.
2. Cobrir GET e PUT agregados e individuais. Fixture usa segredo sintético e testa ausência em resposta/log, sem imprimir valor real.
3. Tratar a entrada `apiKey` em query de modelos conforme contrato revisado; o frontend atual consulta modelos sem enviar esse parâmetro. Inventariar outros consumidores antes de remover compatibilidade.
4. Preparar frontend para D-03 e fazer transição coordenada; placeholder/mascaramento nunca é gravado como segredo.
5. Se houver mudança no armazenamento de credenciais, fechar desenho, manejo de chave de criptografia e migração separadamente. Não pressupor AWS Secrets Manager, KMS ou configuração de ambiente existente.

**Aceite:** chave sintética continua utilizável pelo resolver interno e nunca retorna em DTO público; preservar/substituir/limpar funciona conforme D-03; rollback não restaura exposição.

### B5 — Conteúdo, assets e fonte canônica

**Achados:** BE-07/13. **Dependência:** D-06 para mudanças de semântica editorial; validação de estrutura/URL exige inventário dos formatos aceitos.

1. Inventariar os nós/marks/atributos realmente produzidos pelos três editores, incluindo tabelas, fontes e estilos. Não usar allowlist inventada que elimine formatação salva.
2. Validar formato, relação etapa/versão e referências de assets antes da persistência/renderização. Definir limites com base em fixtures e tamanho de payload aceito, sem escolher números não medidos.
3. Rastrear URLs de versões históricas e de assets gerados; definir acesso autorizado e localização pelo provider. Não assumir que toda URL do mesmo bucket pertence à mesma lição.
4. Testar que URL interna, host externo não permitido ou redirecionamento indevido não provoca download pelo renderer. O teste deve mockar rede; não explorar rede real.
5. Fechar D-06 e criar adapters apenas para campos verificados. Não mudar regra de versículo ou substituir texto salvo por conteúdo gerado sem contrato.
6. Documentar o que o checksum atual cobre; só introduzir checksum adicional se seu uso e migração estiverem definidos. Preservar leitura de versões antigas.

**Aceite:** conteúdo/arte não autorizados são rejeitados antes do I/O; edição dos campos cobertos corresponde ao dado usado em derivados/PDF; formatação/legado preservados.

### B6 — Fila de revisão, diagnóstico e consultas

**Achados:** BE-08/09/12. **Dependência:** D-02 para filtro novo; mudança do SSE depende de medição/contrato posterior.

1. Implementar D-02 no repository aplicando o mesmo predicado antes de `getManyAndCount`, `skip` e `take`; preservar ordenação secundária por ID e limite 50.
2. Manter a resposta flat existente, salvo mudança explicitamente coordenada. Conjunto atual da UI: PACKAGE_READY, IN_REVIEW, CHANGES_REQUESTED, READY_FOR_PUBLICATION, PUBLISHED.
3. Se expuser `failureCode`, atualizar DTO, mapper, cliente e catálogo/testes juntos. Não retornar stack, credencial, request bruto ou prompt completo.
4. Medir consultas/bytes por conexão SSE e tamanho de detalhe com várias versões. Não exigir nova API/event store antes de demonstrar necessidade.
5. Se houver compactação futura, descrever payload, reconciliação e compatibilidade antes de alterar o stream. Até lá, usar snapshot atual e preservar autenticação.

**Aceite:** mesma fixture/mesmo filtro produz total e items corretos; estados de erro são distinguíveis; qualquer otimização vem com medida antes/depois e não remove dados necessários sem migração de cliente.

### B7 — Estrutura e verificação no escopo alterado

**Achados:** BE-10/14 e suporte às correções anteriores.

- Extrair casos de uso por operação e I/O para providers, conforme AGENTS, à medida que o recorte é modificado. Serviços não acessam TypeORM diretamente; entre módulos usar serviço público.
- Registrar quando configurações de provider/prompt são resolvidas; testar mudança entre chamadas e após retomada antes de prometer snapshot por job. Persistência desse snapshot depende de desenho fechado, não de um campo presumido.
- Manter diretório/perfil LibreOffice por conversão, timeout atual de 90 s e cleanup em finally. Concorrência/cache/timeout novo dependem de medição; não alterar apenas para completar uma seção do plano.
- Reutilizar observabilidade/auditoria existentes. Não logar AST, prompts, credenciais ou dados pessoais. Correlação adicional deve refletir identificadores reais, não `operationId` inexistente.

**Aceite:** camadas e DTOs explícitos, testes do comportamento preservados, sem refactor alheio, sem dependência nova sem justificativa.

## 8. Banco, migração e compatibilidade

Não há schema novo definido nesta revisão. D-04/05 podem exigir metadados/índices adicionais; isso deve ser demonstrado antes de criar entidade ou migration. Os campos de lease e request já existem em `LessonStageEntity`; a migration `1790467200000-PersistAiLessonGenerationJobs.ts` já está no repositório.

Quando uma decisão implicar schema:

1. Conferir migrations e schema local; alterar metadados/entidades e lista compartilhada.
2. Gerar migration pelo script `db:local:migration:generate` com nome correspondente à mudança realmente decidida.
3. Rever SQL gerado, dados legados, índices, locks e possibilidade de rollback. Se errado, corrigir metadados e gerar novamente; nunca editar SQL manualmente.
4. Aplicar/verificar somente em banco local descartável durante desenvolvimento. Banco compartilhado/produção exige autorização própria de execução.
5. Entregar entidades/migration e atualização dos diagramas afetados. Renderizar `.png` imediatamente após alterar `.puml` com `npm run diagrams:generate`.

Referências existentes: [schema](../../docs/diagrams/database/ai-lessons-schema.puml), [fluxo](../../docs/diagrams/flow/ai-lessons/ai-lessons-flow.puml), [requisitos do CLI](../../AI_DATABASE_CHANGE_REQUIREMENTS.md). A menção antiga na guia geral de que não existe infraestrutura de migrations não corresponde ao DataSource/scripts atuais.

Compatibilidade: não exigir do cliente campos ausentes do DTO atual antes de atualizar cliente e contratos. Não criar fallback que simula aprovação, resultado de IA, job inexistente ou vínculo de publicação. Rollback deve preservar dados e nunca reabilitar worker incompatível com os metadados gravados.

## 9. Matriz de testes, ordem de entrega e gates

| Teste | Condição | Oráculo de aceite | Pacote |
| --- | --- | --- | --- |
| T-B01 | Devolver/editar/concluir itens 1, 4 e 8 com outros em revisão | Retorno segue D-01; não há estado sem ação válida; aprovações não são fabricadas | B1 |
| T-B02 | Save com lock antigo | Conflito e zero gravações; lock igual continua válido para estado permitido | B1 / FE-02 |
| T-B03 | Falha entre etapa e agregado na conclusão | Rollback completo, mesmo manager em todas as escritas | B1 |
| T-B04 | Duas etapas em geração; save upstream; delete concorrente | Disciplina definida de exclusão/lock; resultado antigo não substitui fontes novas | B2 |
| T-B05 | A perde lease, B assume; A tenta sucesso e falha | A não altera versão, estado nem uploads de B | B2 |
| T-B06 | Tentativa antiga e nova no mesmo worker | D-05 distingue as tentativas; owner igual não basta para liberar commit antigo | B2 |
| T-B07 | Upload concluído, falha após cada escrita de geração | Estado consistente; somente upload não referenciado é descartado | B2 |
| T-B08 | Página criada, falha no vínculo, nova tentativa | Mesmo material recuperado conforme D-04; nenhum segundo material/aviso | B3 |
| T-B09 | Falha em qualquer um dos oito PDFs | Nenhuma página incompleta tratada como publicação concluída | B3 |
| T-B10 | Publicação concluída repetida | Mesmo weekMaterialId, sem nova renderização/criação desnecessária conforme caminho existente | B3 |
| T-B11 | GET/PUT de todas as variantes com chave sintética | Resposta pública sem segredo; resolver interno funcional | B4 |
| T-B12 | Asset de outro dono, URL não autorizada, AST inválido | Rejeição antes de I/O; formatação válida preservada | B5 |
| T-B13 | Edição de cada campo abrangido por D-06 | Persistência/derivado/PDF usam a fonte decidida | B5 |
| T-B14 | 12 rascunhos recentes + 2 itens revisáveis, filtro/busca | Total e página representam o mesmo conjunto | B6 |
| T-B15 | Usuário anônimo, não admin, admin; DTO inválido | Mesmos guards/validações/envelope em lista, detalhe, ações, SSE e PDF | Todos |
| T-B16 | Settings/template/prompt mudam durante execução/retomada | Resultado segue política registrada, sem afirmar snapshot que não foi implementado | B7 / D-05 |

Testes automatizados: Jest/Nest/Supertest com providers, repositories, relógio e subprocesso mockados, conforme guia. Locks/SQL e migrations exigem validação separada no ambiente local descartável; mocks em memória não provam comportamento do MySQL. PDF real deve ser homologado localmente com fixtures, sem IA paga, quando renderer mudar.

Ordem:

1. **Gate de evidência:** congelar base, transformar sondagens em regressões, confirmar contratos atuais.
2. **Correções sem contrato novo:** atomicidade de conclusão, tratamento de rejeição/cleanup e melhorias locais de frontend, com teste do recorte.
3. **Fechamentos e integração:** D-01→B1; D-02→B6/FE-06; D-03→B4/FE-05.
4. **Operações críticas:** D-05→B2; D-04→B3. Não aguardar refactor completo para resolver falha demonstrada.
5. **Conteúdo e eficiência:** D-06→B5; B7 dentro dos recortes; medir SSE antes de redesenhá-lo.
6. **Gate final:** regressões do recorte aprovadas, contratos/documentação sincronizados, build/lint/cobertura aplicáveis sem falhas novas.

```bash
NODE_OPTIONS='--max-old-space-size=2048' npm run build
NODE_OPTIONS='--max-old-space-size=2048' npm test -- --runInBand
NODE_OPTIONS='--max-old-space-size=2048' npm run test:cov -- --runInBand
NODE_OPTIONS='--max-old-space-size=2048' npm run lint
```

O script lint aplica fixes; revisar diff. A meta de cobertura ≥ 90% vem da guia backend para escopo alterado; **não foi medida nesta análise**. Sem execução de migrations/build/lint/cobertura nesta alteração documental.

## 10. Evidências executadas nesta revisão

### 10.1 Suites existentes

```bash
npm test -- --runInBand --runTestsByPath src/modules/ai-lessons/services/lesson-draft.service.spec.ts src/modules/ai-lessons/repositories/ai-lessons.repository.spec.ts src/modules/ai-lessons/services/ai-provider-settings.spec.ts
```

Resultado: **3 suites, 50 testes aprovados**, saída 0. Não confundir com implementação das regressões futuras T-B01 a T-B16.

### 10.2 Sondagens do código real com dependências isoladas

Serviços foram carregados com `ts-node/register/transpile-only` e `tsconfig-paths/register`. Repository em memória retorna cópias, aplica updates e restaura estado ao falhar a transação simulada. Provider de IA, S3 e banco real não foram usados. Na publicação, renderer e serviço de materiais foram substituídos.

| Registro | Preparação e sequência | Saída observada | Limite |
| --- | --- | --- | --- |
| R-BE-02 | Oito itens IN_REVIEW com versões; `requestChanges(MANUAL_WORK)`; `saveContent` com lock corrente; `completeProductionStage`; `submitPackageReview` | Lição IN_PROGRESS; sete itens IN_REVIEW; item 8 PRODUCER_APPROVED com nova versão; rejeição “Somente um pacote concluído pode ser submetido para revisão.” | Comprova regra do serviço, não concorrência/HTTP/MySQL |
| R-BE-06 | Oito itens APPROVED, lição READY_FOR_PUBLICATION; oito PDFs sintéticos; criação retorna ID; save de PUBLISHED lança falha e transação simulada reverte; repetir publicação | Uma criação; lição PUBLISHING; weekMaterialId null; segunda tentativa recebe ConflictException por publicação em andamento | Comprova caminho de falha no vínculo; não é crash real nem criação de mídia real |
| R-BE-01 | Getter real com repository retornando chave sintética para settings | OpenAI/Gemini no DTO contêm exatamente o marcador sintético | Comprova retorno do getter; nenhuma credencial real lida ou exibida |

Essas sondagens não foram incorporadas como arquivos de teste de aplicação nesta tarefa documental. Entradas, métodos e oráculos acima devem ser convertidos em regressões permanentes nos pacotes correspondentes.

### 10.3 Fingerprints dos arquivos centrais

```text
6fb51047d49c9d2b9de0f87088ab4fe2e9c2371f6236d6a21ffb91c1f32ac187  src/modules/ai-lessons/services/lesson-draft.service.ts
f94b82e9d04c3eb972657ad594ca862372ba06b4601f0533dfe5c2496e3e147a  src/modules/ai-lessons/repositories/ai-lessons.repository.ts
dde3aea1aeb87842d1085cbd202a3d3d5716da712e6014d79a423cf88b9df5bf  src/modules/ai-lessons/controllers/ai-lessons.controller.ts
b89568d539a8cd23545de13242bba7d6b4ebf836154e18a94454e4cb081d0748  src/modules/ai-lessons/services/get-ai-provider-settings.service.ts
```

## 11. Rollout, documentação e aceite

- Entregar por recorte, com cliente compatível e decisões registradas. Não publicar automaticamente ao aprovar etapas.
- Recuperação de PUBLISHING deve seguir D-04; não limpar estado ou recriar material manualmente sem identificar o resultado anterior.
- Recuperação de geração segue D-05; não colocar worker antigo e novo disputando os mesmos registros se suas regras de posse divergirem.
- Rollback preserva histórico, assets referenciados e segredo protegido. Não apagar versões para reduzir payload nem assumir que reverter código reverte dados.
- Atualizar [API](../../docs/api-ai-lessons.md), [regras](../../docs/implemented-rules.md), [erros](../../docs/error-handling.md), automações afetadas e diagramas apenas quando o comportamento/schema realmente mudar.

Checklist bloqueante do recorte implementado:

- [ ] Evidência e regressão para cada correção; riscos não reproduzidos identificados como tal.
- [ ] Decisões D-xx necessárias fechadas, sem DTO/endpoint presumido.
- [ ] Transações e precondições comprovadas pelos testes apropriados.
- [ ] Ciclo de revisão e recuperação de publicação seguem contratos definidos.
- [ ] Worker obsoleto não sobrescreve resultado novo; cleanup não apaga arte referenciada.
- [ ] Segredo ausente em DTO público sem quebrar configuração interna.
- [ ] Conteúdo, assets e filtros validados sem alterar regras editoriais por inferência.
- [ ] Testes/build/lint/cobertura pertinentes e documentação entregues.
- [ ] Schema, se necessário, acompanhado de migration gerada oficialmente e diagrama renderizado.
- [ ] Nenhuma promessa de produção, performance, recuperação ou qualidade visual baseada só em mocks.
