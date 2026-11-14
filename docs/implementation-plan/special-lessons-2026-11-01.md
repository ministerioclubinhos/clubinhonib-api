# Estúdio Clubinho — Plano de Implementação Backend: Lições Especiais (`SPECIAL`), 2026-11-01

Status: implementado. Nota de 2026-11-10: a referência vigente é [api-ai-lessons.md](../api-ai-lessons.md).

Referências de domínio analisadas:
- [`lições/especial/licao_especial.pdf`](../../../lições/especial/licao_especial.pdf) — *"O Picolé Roubado"*: Lição Especial baseada em narrativa contemporânea nos dias de hoje (Daniel, Rodrigo e Sérgio), estruturada em cenas/cartazes (`Cartaz 1` a `Cartaz 7`) e conectada organicamente a múltiplas referências bíblicas (`Êxodo 20:15; Efésios 4:27,28; Romanos 6:23; 1 Coríntios 15:3,4; Efésios 1:7; Romanos 10:13`), seguida de `APLICAÇÃO / APELO` e `ACONSELHAMENTO / CANTINHO DO ACONSELHAMENTO`.
- [`lições/especial/Lição_1 Especial - O Plano da Salvação na linha do tempo.pdf`](../../../lições/especial/Lição_1%20Especial%20-%20O%20Plano%20da%20Salvação%20na%20linha%20do%20tempo.pdf) — *"O Plano da Salvação na Linha do Tempo"*: Lição Especial temática/panorâmica que articula múltiplas passagens bíblicas em subtópicos e conduz a criança a uma decisão prática nos dias de hoje.
- [`lições/especial/Meditação - Lição Especial (Semana1).pdf`](../../../lições/especial/Meditação%20-%20Lição%20Especial%20(Semana1).pdf) e [`lições/especial/Linha do tempo _ Colorido.pdf`](../../../lições/especial/Linha%20do%20tempo%20_%20Colorido.pdf).
- Plano coordenado de frontend: [`clubinhonib-app/docs/implementation-plan/special-lessons-2026-11-01.md`](../../../clubinhonib-app/docs/implementation-plan/special-lessons-2026-11-01.md).

---

## 1. Objetivo

Expandir o módulo `ai-lessons` do **Estúdio Clubinho** e sua integração com **Páginas de Materiais (`week-material-page`)** para permitir a criação, geração e publicação de **Materiais / Lições Especiais (`LessonCategory.SPECIAL`)** de forma flexível e enxuta:
1. **Pergunta explícita na criação do material (`Material Semanal` vs `Material Especial`)**:
   - Sempre que o administrador for criar um novo material (seja gerando um pacote no Estúdio Clubinho via `POST /api/v1/lessons` ou publicando/criando uma página de material), o fluxo diferencia explicitamente entre **Material Semanal (`LessonCategory.REGULAR`)** e **Material Especial (`LessonCategory.SPECIAL`)**.
2. **Escopo Enxuto do Material Especial (apenas Lição + Visual da Lição com jeito legal de contar + Versículo / Visual do Versículo)**:
   - Enquanto o **Material Semanal (`REGULAR`)** mantém os 8 itens tradicionais (`LESSON`, `LESSON_VISUALS`, `STANDARD_GAME`, `VERSE_VISUALS`, `VERSE_FIXATION`, `MEDITATION_YOUNGER`, `MEDITATION_OLDER`, `MANUAL_WORK`), o **Material Especial (`SPECIAL`)** possui **exclusivamente 3 etapas (`SPECIAL_LESSON_STAGE_ORDER`)**:
     1. **`LESSON` (Lição Especial + Versículo para Memorizar)**: traz o **Versículo para Memorizar** (com explicação do princípio) e a **Lição Especial** estruturada com um **jeito legal, criativo e participativo de contar a história** conectada aos dias de hoje (gancho dinâmico de abertura, condução envolvente cena a cena/cartaz a cartaz, interação com as crianças, aplicação e apelo).
     2. **`LESSON_VISUALS` (Visual da Lição com jeito legal de contar a Lição Especial)**: gera os cartazes/cenas visuais da Lição Especial (ambientados nos dias de hoje ou linha do tempo, conforme a história) acompanhados de orientações práticas e criativas de **como apresentar e explorar cada visual/cartaz** de forma cativante para as crianças.
     3. **`VERSE_VISUALS` (Versículo / Visual do Versículo)**: gera a divisão pedagógica do versículo principal NVI da Lição Especial e seus cartões visuais/tipográficos + cartão final da referência bíblica.
   - Não são geradas etapas de brincadeira (`STANDARD_GAME`), fixação (`VERSE_FIXATION`), meditações (`MEDITATION_YOUNGER`, `MEDITATION_OLDER`) ou trabalho manual (`MANUAL_WORK`) para o Material Especial.
3. **Flexibilidade de Tema + Referências Bíblicas + História para os Dias de Hoje**:
   - No modo **Material Especial**, o administrador informa um **Tema/Título livre** e **Referências Bíblicas** (uma ou várias passagens) que serão conectadas a uma **história para os dias de hoje** (ou abordagem especial temática), podendo opcionalmente fornecer um **Contexto / Ideia da História (`specialContext`)** ou deixar que a IA crie o enredo cotidiano infantil conectado às passagens.
4. **Semana Opcional no Material Especial**:
   - O número da semana (`weekNumber`) é obrigatório para **Material Semanal (`REGULAR`)** e **opcional (`nullable`)** para **Material Especial (`SPECIAL`)**.

---

## 2. Mapa de Entrega (Pacotes Backend)

| Pacote | Prioridade / Escopo | Descrição Resumida |
| --- | --- | --- |
| **SBE01 — Modelo de Dados, Enums (`SPECIAL_LESSON_STAGE_ORDER`) e Migration** | P1 / S | Adicionar `LessonCategory` (`REGULAR`, `SPECIAL`), `SPECIAL_LESSON_STAGE_ORDER` (`LESSON`, `LESSON_VISUALS`, `VERSE_VISUALS`), helper `getLessonStageOrder(category)` e coluna `specialContext` (`text`, nullable) em `LessonEntity`; gerar migration TypeORM e diagramas. |
| **SBE02 — DTOs de Criação, Listagem e Resposta** | P1 / S | Atualizar `GenerateLessonRequestDto`, `QueryLessonsDto` e `LessonResponseDto` para receber a escolha `category` (`REGULAR` vs `SPECIAL`), `specialContext` opcional e validação condicional de `weekNumber` (obrigatório em Material Semanal, opcional em Material Especial). |
| **SBE03 — Prompt Editorial Flexível de Lição Especial (`LESSON`)** | P1 / M | Criar `SPECIAL_LESSON_BASE_PROMPT` para narrativas nos dias de hoje conectadas às Escrituras (inspiradas em *"O Picolé Roubado"* e *"O Plano da Salvação"*), enfatizando um **jeito legal, dinâmico e criativo de contar a lição especial** + **Versículo para Memorizar**. |
| **SBE04 — Visual da Lição (`LESSON_VISUALS`) e Visual do Versículo (`VERSE_VISUALS`) no Material Especial** | P1 / M | Adaptar a Etapa 2 (`LESSON_VISUALS`) para gerar visuais contemporâneos/especiais com dicas de apresentação criativa (*"jeito legal de contar com o visual"*) e encadear diretamente a Etapa 3 (`VERSE_VISUALS`) dependendo de `LESSON_VISUALS` no fluxo `SPECIAL`. |
| **SBE05 — Fluxo de 3 Etapas, Cabeçalho `LIÇÃO ESPECIAL`, DOCX/PDF e Publicação** | P1 / S | Atualizar `LessonDraftService` (`create`, `assertDependency`, `invalidateDownstream`, `completeProductionStage`, `submitPackageReview`, `publishToWeekMaterial`) para usar `getLessonStageOrder(lesson.category)` (3 itens no Material Especial vs 8 no Semanal) e cabeçalho `LIÇÃO ESPECIAL`. |
| **SBE06 — Testes Unitários e Documentação** | P1 / S | Cobrir criação de Material Especial com 3 etapas (`LESSON`, `LESSON_VISUALS`, `VERSE_VISUALS`), encadeamento de dependências, cabeçalhos e publicação em suítes Jest. |

---

## 3. Detalhamento Técnico por Pacote

### SBE01 — Modelo de Dados, Enums (`SPECIAL_LESSON_STAGE_ORDER`) e Migration

**Arquivos**:
- [`src/modules/ai-lessons/enums/lesson.enums.ts`](../../src/modules/ai-lessons/enums/lesson.enums.ts)
- [`src/modules/ai-lessons/entities/lesson.entity.ts`](../../src/modules/ai-lessons/entities/lesson.entity.ts)
- `src/database/migrations/<timestamp>-AddLessonCategoryAndSpecialContext.ts`

**Implementação**:
1. Em `lesson.enums.ts`:
   - Definir o enum `LessonCategory`:
     ```ts
     export enum LessonCategory {
       REGULAR = 'REGULAR', // Material Semanal (8 itens)
       SPECIAL = 'SPECIAL', // Material Especial (3 itens: Lição, Visual da Lição, Visual do Versículo)
     }
     ```
   - Definir `SPECIAL_LESSON_STAGE_ORDER` e helper `getLessonStageOrder`:
     ```ts
     export const SPECIAL_LESSON_STAGE_ORDER: readonly LessonStageType[] = [
       LessonStageType.LESSON,
       LessonStageType.LESSON_VISUALS,
       LessonStageType.VERSE_VISUALS,
     ];

     export function getLessonStageOrder(
       category?: LessonCategory | null,
     ): readonly LessonStageType[] {
       return category === LessonCategory.SPECIAL
         ? SPECIAL_LESSON_STAGE_ORDER
         : LESSON_STAGE_ORDER;
     }
     ```
2. Em `LessonEntity`:
   - Alterar `weekNumber` para `number | null` (`@Column({ type: 'int', nullable: true })` já existe no banco, apenas tipar como `number | null`).
   - Adicionar coluna `category` (`enum: LessonCategory`, `default: LessonCategory.REGULAR`).
   - Adicionar coluna `specialContext` (`name: 'special_context'`, `type: 'text'`, `nullable: true`).
3. Seguir rigorosamente `AI_DATABASE_CHANGE_REQUIREMENTS.md`: gerar migration via CLI, revisar `up`/`down`, aplicar com `npm run migration:run`, confirmar `[X]` em `migration:show` e regenerar diagramas com `npm run diagrams:generate`.

---

### SBE02 — DTOs de Criação, Listagem e Resposta (Escolha Material Semanal vs Material Especial)

**Arquivos**:
- [`src/modules/ai-lessons/dto/generate-lesson-request.dto.ts`](../../src/modules/ai-lessons/dto/generate-lesson-request.dto.ts)
- [`src/modules/ai-lessons/dto/query-lessons.dto.ts`](../../src/modules/ai-lessons/dto/query-lessons.dto.ts)
- [`src/modules/ai-lessons/dto/lesson-response.dto.ts`](../../src/modules/ai-lessons/dto/lesson-response.dto.ts)
- [`src/modules/ai-lessons/repositories/ai-lessons.repository.ts`](../../src/modules/ai-lessons/repositories/ai-lessons.repository.ts)

**Implementação**:
1. Em `GenerateLessonRequestDto`:
   - `category?: LessonCategory` (`@IsOptional() @IsEnum(LessonCategory)` — default `LessonCategory.REGULAR`, recebendo a resposta da pergunta inicial de criação: **Material Semanal** vs **Material Especial**).
   - `weekNumber?: number | null`:
     - Obrigatório quando for **Material Semanal** (`(o.category ?? LessonCategory.REGULAR) === LessonCategory.REGULAR`) ou quando informado no **Material Especial** (`o.weekNumber !== undefined && o.weekNumber !== null`), validado com `@IsInt() @Min(1)`.
   - `specialContext?: string | null`:
     - Opcional (`@IsOptional() @IsString() @MaxLength(2000)`), com `@Transform` para trim e conversão de string vazia em `null`.
2. Em `QueryLessonsDto` e `AiLessonsRepository.findDraftsPaginated`:
   - Permitir filtro opcional por `category?: LessonCategory` na listagem de produção e revisão (filtrando por **Material Semanal** ou **Material Especial**).
3. Em `LessonResponseDto`:
   - Expor `category: LessonCategory`, `specialContext: string | null` e `weekNumber: number | null`.

---

### SBE03 — Prompt Editorial Flexível de Lição Especial (`SPECIAL_LESSON_BASE_PROMPT`)

**Arquivos**:
- [`src/modules/ai-lessons/constants/lesson-editorial.constants.ts`](../../src/modules/ai-lessons/constants/lesson-editorial.constants.ts)
- [`src/modules/ai-lessons/templates/lesson-templates.ts`](../../src/modules/ai-lessons/templates/lesson-templates.ts)
- [`src/modules/ai-lessons/services/admin-lesson-prompt.service.ts`](../../src/modules/ai-lessons/services/admin-lesson-prompt.service.ts)
- [`src/modules/ai-lessons/providers/lesson-llm.types.ts`](../../src/modules/ai-lessons/providers/lesson-llm.types.ts)

**Implementação**:
1. Criar `SPECIAL_LESSON_BASE_PROMPT` em `lesson-editorial.constants.ts` com diretrizes específicas para `LessonCategory.SPECIAL`:
   - **Jeito Legal, Criativo e Dinâmico de Contar a Lição Especial**:
     - A Lição Especial deve trazer uma condução viva, envolvente e muito fácil de o professor apresentar para crianças de 5 a 11 anos: começar com um gancho curioso ou dinâmica rápida de abertura que conecte imediatamente com o universo das crianças hoje, indicar entonações, perguntas de suspense ao virar cada cartaz/cena, objetos simples de apoio ou gestos participativos que tornem a contação inesquecível.
   - **História para os Dias de Hoje Conectada às Referências Bíblicas**:
     - Diferente do Material Semanal regular (que narra apenas acontecimentos históricos de uma passagem bíblica), o **Material Especial** permite e incentiva **uma história narrativa situada nos dias de hoje** (crianças reais em casa, na escola, na vizinhança, com amigos e família — no estilo de *"O Picolé Roubado"*) **ou** uma **exposição temática/panorâmica conectada à vida atual da criança** (no estilo de *"O Plano da Salvação na Linha do Tempo"*).
     - Se o administrador informar `specialContext` (ex.: resumo de uma situação atual, dilema infantil, ideia de dinâmica para contar a história ou linha condutora), usar essa orientação como espinha dorsal; se `specialContext` estiver vazio, criar autonomamente uma história cotidiana envolvente e um jeito criativo de contá-la conectado ao `theme` e às `biblicalReference`.
   - **Conexão Orgânica entre História Contemporânea, Versículo NVI e Referências Bíblicas**:
     - Ao longo da narrativa (`story`), os acontecimentos vividos pelos personagens conectam-se naturalmente aos textos bíblicos informados em `biblicalReference`, citando as referências entre parênteses nos momentos chave, exatamente como em `licao_especial.pdf`.
     - Inclui obrigatoriamente a seção `memoryVerse` (`VERSÍCULO PARA MEMORIZAR` fiel à NVI) e `principleExplanation` (`EXPLICAÇÃO DO PRINCÍPIO`), que servirá também de base para a etapa `VERSE_VISUALS`.
   - **Estrutura Flexível por Cenas/Cartazes ou Subtópicos**:
     - Preencher `visualScenes` (`scene-01`, `scene-02`, ...) refletindo fielmente os cartazes/momentos da história narrada em `story` e como o professor deve usar cada cartaz ao contar a lição.
2. Em `LessonLlmGenerationInput`:
   - Incluir `category?: LessonCategory` e `specialContext?: string | null`.
   - Quando `lesson.category === LessonCategory.SPECIAL` e a etapa for `LessonStageType.LESSON`, compor o prompt base a partir de `SPECIAL_LESSON_BASE_PROMPT`.

---

### SBE04 — Visual da Lição (`LESSON_VISUALS`) com Jeito Legal de Contar + Visual do Versículo (`VERSE_VISUALS`)

**Arquivos**:
- [`src/modules/ai-lessons/constants/story-visual-quality.constants.ts`](../../src/modules/ai-lessons/constants/story-visual-quality.constants.ts)
- [`src/modules/ai-lessons/templates/lesson-templates.ts`](../../src/modules/ai-lessons/templates/lesson-templates.ts)
- [`src/modules/ai-lessons/utils.ts`](../../src/modules/ai-lessons/utils.ts)
- [`src/modules/ai-lessons/services/open-ai-lesson.service.ts`](../../src/modules/ai-lessons/services/open-ai-lesson.service.ts)
- [`src/modules/ai-lessons/providers/gemini-lesson-llm.provider.ts`](../../src/modules/ai-lessons/providers/gemini-lesson-llm.provider.ts)

**Implementação**:
1. Na Etapa 2 (`LESSON_VISUALS`) quando `lesson.category === LessonCategory.SPECIAL`:
   - Ajustar as instruções de geração (`open-ai-lesson.service.ts` / `gemini-lesson-llm.provider.ts` / `buildStoryVisualImagePrompt`) para que:
     - Cada item de `assets` (`visual-01`, `visual-02`, ...) traga, além do trecho da história e da ilustração sem texto, uma **dica prática e criativa de contação para o professor** (como apresentar aquele cartaz, que pergunta fazer ou que expressão destacar para contar a lição especial de um jeito legal e envolvente).
     - Se a narrativa retratar crianças e situações nos dias de hoje (casas atuais, quarto infantil, mesa de almoço em família, rua residencial, escola, sorveteiro etc., como em *"O Picolé Roubado"*), gerar ilustrações infantis amigáveis com **roupas, cenários e objetos contemporâneos fiéis ao texto**, mantendo consistência visual dos personagens a partir do `visual-01`.
     - Se a narrativa retratar cenas bíblicas ou marcos históricos (como em *"O Plano da Salvação na Linha do Tempo"*), manter a ambientação correspondente a cada cena.
2. Na Etapa 3 do Material Especial (`VERSE_VISUALS`):
   - Gerar os cartões visuais do versículo principal NVI aprovado na Etapa 1 (`LESSON`) + cartão final da referência bíblica, exatamente após a conclusão de `LESSON_VISUALS` (sem depender de `STANDARD_GAME`, que não faz parte do Material Especial).

---

### SBE05 — Fluxo de 3 Etapas, Cabeçalho `LIÇÃO ESPECIAL`, DOCX/PDF e Publicação

**Arquivos**:
- [`src/modules/ai-lessons/utils.ts`](../../src/modules/ai-lessons/utils.ts)
- [`src/modules/ai-lessons/services/lesson-draft.service.ts`](../../src/modules/ai-lessons/services/lesson-draft.service.ts)
- [`src/modules/ai-lessons/services/docx-exporter.service.ts`](../../src/modules/ai-lessons/services/docx-exporter.service.ts)

**Implementação**:
1. Em `LessonDraftService`:
   - Em `create`: criar apenas as etapas de `getLessonStageOrder(dto.category)` (3 etapas quando `SPECIAL`: `LESSON`, `LESSON_VISUALS`, `VERSE_VISUALS`; 8 etapas quando `REGULAR`).
   - Em `generateStage`: rejeitar com `BadRequestException` caso tentem gerar uma etapa que não pertença a `getLessonStageOrder(locked.category)`.
   - Em `getById`, `assertDependency`, `invalidateDownstream`, `completeProductionStage`, `submitPackageReview` e `publishToWeekMaterial`: usar sempre `const stageOrder = getLessonStageOrder(lesson.category)` em vez de `LESSON_STAGE_ORDER` fixo.
2. Em `lessonHeaderLines(title, weekNumber, category)` e `normalizeLessonDocumentHeader(document, weekNumber, category)`:
   - Para `LessonCategory.REGULAR` (**Material Semanal**): manter `['LIÇÃO <weekNumber>', 'TÍTULO', cleanTitle]`.
   - Para `LessonCategory.SPECIAL` (**Material Especial**):
     - Se `weekNumber` for `null` ou `undefined`: gerar `['LIÇÃO ESPECIAL', 'TÍTULO', cleanTitle]`.
     - Se `weekNumber` for informado: gerar `['LIÇÃO ESPECIAL ' + weekNumber, 'TÍTULO', cleanTitle]`.
3. Em `DocxExporterService` e `LessonDraftService`:
   - Propagar `lesson.category` e `lesson.weekNumber ?? undefined` ao construir o DOCX/PDF.
   - Em `publishToWeekMaterial`:
     - Quando `lesson.category === LessonCategory.SPECIAL` (**Material Especial**):
       - Validar e publicar apenas os **3 PDFs** (`LESSON`, `LESSON_VISUALS`, `VERSE_VISUALS`).
       - `dto.pageTitle = lesson.weekNumber ? "Material Especial (Semana ${lesson.weekNumber}) — ${lesson.theme}" : "Material Especial — ${lesson.theme}"`
       - `dto.pageSubtitle = lesson.biblicalReference`
       - `dto.pageDescription = "Material Especial completo (Lição, Visuais da Lição e Visuais do Versículo)${lesson.weekNumber ? ` — Semana ${lesson.weekNumber}` : ''}, revisado e aprovado. [tipo:especial] [origem:licao:${lesson.id}]"`
       - Nomear os PDFs publicados como `${type.toLowerCase()}-licao-especial${lesson.weekNumber ? `-semana-${lesson.weekNumber}` : ''}.pdf`.

---

### SBE06 — Testes Unitários e Documentação

**Arquivos**:
- `src/modules/ai-lessons/utils.spec.ts`
- `src/modules/ai-lessons/services/lesson-draft.service.spec.ts`
- `src/modules/ai-lessons/services/open-ai-lesson.service.spec.ts`
- `docs/implemented-rules.md`

**Verificação**:
- `npx tsc --noEmit --incremental false`
- `npm test -- --runInBand --testPathPattern=modules/ai-lessons`
- `npm run build`
- `npx eslint src/modules/ai-lessons/`
