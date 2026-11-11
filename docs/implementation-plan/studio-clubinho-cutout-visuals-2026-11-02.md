# Estúdio Clubinho — Visuais da história em "kit de recortes" (plano de implementação, 2026-11-02)

Status: implementado (template 3.0.x). Nota de 2026-11-10: a referência vigente é [api-ai-lessons.md](../api-ai-lessons.md); as "decisões abertas" abaixo são históricas.

Exemplos de referência (pasta `lições/exemplos de visual para lição`):

- `Nascimento de Jesus visuais COLORIDOS.pdf` (8 páginas)
- `imagens_cortadas_6_paginas.pdf` (6 páginas)

## 1. Problema e objetivo

Hoje a etapa `LESSON_VISUALS` divide a LIÇÃO BÍBLICA em N trechos (`sourceExcerpt`) e gera **uma imagem de cena completa por trecho** (`visual-01…visual-N`), com consistência garantida por uma imagem-mãe (`buildStoryVisualImagePrompt` em `utils.ts`).

O novo modelo é um **kit de elementos para recortar**, como nos exemplos. A imagem não é uma cena fechada, e sim uma prancha com vários elementos isolados, em fundo branco, que o professor recorta e monta (flanelógrafo/painel). O kit precisa ser **completo**.

### O que os exemplos mostram

| Categoria | Exemplos nos PDFs |
| --- | --- |
| Personagens | Maria, José, anjo, pastores, César, Tiago, João, multidão (silhuetas). Corpo inteiro, poses neutras, às vezes variantes (Maria grávida no burrinho × Maria em pé). |
| Animais | Burrinho, vacas, ovelhas, cavalos, galinhas e pintinhos (estrebaria). |
| Construções | Cidade de Belém, casas em 2 ângulos, hospedaria. |
| Cenário | Montanhas, céu, mar, barco, palmeira, terreno. |
| Objetos | Manjedoura e palha, bebê Jesus, cruz, peixes, redes, cajado, bolsa. |
| Céu e natureza | Nuvens, pássaros, sol, lua, estrelas, palmeira, árvores, flores, pedras. Peças soltas para compor o céu e dar vida ao cenário. |
| Cartão do versículo | Última página com a frase e a referência. Já existe como etapa própria (`VERSE_VISUALS`) e **não muda**. |
| Legendas | Nome pequeno sob o elemento ("Maria", "anjo"). |

Requisitos de "completo" (definidos pelo pedido):

- Todo personagem, ambiente, casa, montanha e objeto relevante da lição precisa existir no kit.
- Quando a lição pedir (ou o momento do dia/clima da história exigir), o kit inclui **nuvens, pássaros, sol, lua e estrelas**, e também árvores, flores e pedras. Cada um é uma peça separada, em vários tamanhos, para o professor montar o céu de cada cena.
- Cada elemento fica isolado, com espaço em volta, para recortar.
- Elementos que mudam de estado ou pose na história (ex.: Maria grávida/com o bebê, barco vazio/cheio de peixes) têm uma variante cada.
- Personagens mantêm o mesmo rosto, roupa e traço em todas as pranchas.
- Cenário deve permitir montar cada momento da história (fundo + construções + elementos de profundidade).

## 2. Decisões de design

1. **Público do material:** o kit é para o professor recortar e usar como apoio visual enquanto conta a lição. Não é atividade de recorte para as crianças. Isso orienta tamanho, nitidez e montagem (legível à distância, peças fáceis de manusear).
2. **Novo `LessonVisualType.CUTOUT_KIT`**, adicionado ao enum e tornado o padrão da etapa. Os tipos antigos permanecem no enum para ler lições já geradas (a coluna `visualConfig` é JSON, sem migração destrutiva). Novas gerações não oferecem mais `STORY_SEQUENCE`, `CHARACTER_AND_EMOTION`, `VISUAL_ANCHORS` e `INTERACTIVE_COLORING` na UI. Confirmar com o time se algum deve continuar disponível (ver seção 8).
3. **A unidade deixa de ser "trecho da história" e passa a ser "prancha por categoria"**. O `visualConfig.quantity` passa a significar número de pranchas (mantém 4–10).
4. **Inventário primeiro, imagem depois.** A LLM extrai da lição um inventário estruturado de elementos. As pranchas são montadas a partir dele, e a validação do servidor confere cobertura.
5. **Fidelidade à lição continua canônica.** Cada elemento do inventário cita a evidência na história (`storyEvidence`). Não podem existir elementos sem apoio no texto, e nenhum elemento citado no texto pode faltar.
6. **Texto na imagem:** a IA não desenha legendas (alto risco de erro ortográfico). Legendas dos elementos são aplicadas pelo renderer (DOCX/PDF) a partir de `items[].label`. Isso exige uma política de texto nova para o propósito de recorte (seção 4.4).
7. **Fundo:** branco puro com margem entre elementos. Fundo transparente fica como evolução futura (seção 7).

## 3. Contrato de dados

### 3.1 Enum (backend `enums/lesson.enums.ts` e app `features/ai-lessons/types.ts`)

```ts
export enum LessonVisualType {
  CUTOUT_KIT = 'CUTOUT_KIT', // novo, padrão
  STORY_SEQUENCE = 'STORY_SEQUENCE', // legado: leitura de lições antigas
  ...
}
export enum CutoutCategory {
  CHARACTERS = 'CHARACTERS',
  ANIMALS = 'ANIMALS',
  BUILDINGS = 'BUILDINGS',
  SCENERY = 'SCENERY', // montanhas, colinas, mar, rio, deserto, chão
  SKY_AND_NATURE = 'SKY_AND_NATURE', // nuvens, pássaros, sol, lua, estrelas, árvores, flores, pedras
  OBJECTS = 'OBJECTS', // barco, manjedoura, cruz, peixes...
}
```

### 3.2 Schema da etapa (`STORY_VISUAL_ASSET_SCHEMA`, `open-ai-lesson.service.ts`; espelhar no `gemini-lesson-llm.provider.ts`)

Asset passa de `{ id, sourceExcerpt, purpose, prompt, altText }` para a prancha:

```ts
{
  id: 'kit-01',                 // sequencial kit-01, kit-02...
  category: CutoutCategory,
  title: string,                // "Personagens principais"
  items: Array<{
    label: string,              // legenda aplicada pelo renderer
    description: string,        // aparência, roupa, pose, estado
    storyEvidence: string,      // trecho literal da lição que justifica o elemento
    variantOf?: string,         // label do elemento-base quando for variante
    extra?: boolean,            // acréscimo além do básico (seção 4.2.2)
    size: 'LARGE' | 'MEDIUM' | 'SMALL' // tamanho relativo na prancha (seção 4.2.3)
  }>,
  layoutPlan: string,           // como os elementos se organizam e por que cabem sem encolher
  prompt: string,               // composição da prancha (layout, ordem, espaçamento)
  altText: string
}
```

`sourceExcerpt` deixa de ser obrigatório. Os assets antigos continuam legíveis.

### 3.3 Validação (substitui a de `lesson-draft.service.ts` ~L1405–1440)

Para `CUTOUT_KIT`:

- IDs sequenciais `kit-01…`; quantidade igual a `visualConfig.quantity`.
- Todo `storyEvidence` aparece literalmente na lição (normalizando espaços e caixa).
- Cobertura: personagens, lugares e objetos nomeados na lição (extraídos por uma segunda chamada barata de verificação, ou por checagem no mesmo JSON com o campo `coverageChecklist`) precisam aparecer em algum `items[]`. Falha de cobertura gera correção automática com `STORY_VISUAL_MAX_CORRECTIONS`, no mesmo mecanismo atual.
- Há pelo menos uma prancha `CHARACTERS` e uma `SCENERY` ou `BUILDINGS`.
- Se a lição mencionar período do dia, clima ou corpos celestes (dia, noite, manhã, estrela, lua, sol, chuva, tempestade, pássaros), o kit precisa de itens `SKY_AND_NATURE` correspondentes. Mesmo sem menção, a prancha `SKY_AND_NATURE` traz um conjunto mínimo (nuvens, sol, pássaros) para compor cenas ao ar livre.
- Sem limite fixo de itens por prancha. A validação confere o raciocínio de tamanho da seção 4.2.3 (cada prancha declara o tamanho relativo dos elementos), nunca uma contagem.
- O kit respeita o nível de cobertura da quantidade escolhida: com 4 pranchas, todo o **básico** precisa estar presente; com mais pranchas, só se **acrescenta** (seção 4.2.2).
- A validação antiga de `sourceExcerpt` só roda quando `type !== CUTOUT_KIT`.

## 4. Backend — passos de implementação

Arquivos em `src/modules/ai-lessons/`.

### 4.1 Template e prompts da etapa

- `templates/lesson-templates.ts` (`LESSON_VISUALS`): subir a versão do template (`2.1.0` → `3.0.0`) e trocar `exactStructure` por `INVENTÁRIO DE ELEMENTOS DA LIÇÃO`, `PRANCHAS POR CATEGORIA`, `VARIANTES`, `PERSONAGENS E CONSISTÊNCIA`, `TEXTO ALTERNATIVO`. Reescrever as regras: elementos recortáveis, isolados, em fundo branco, sem cena completa.
- `open-ai-lesson.service.ts` e `gemini-lesson-llm.provider.ts`: substituir o parágrafo "Em VISUAIS DA HISTÓRIA, você decide a quebra narrativa…" por regras do inventário (cobertura total, `storyEvidence`, variantes). Manter o parágrafo "fonte canônica fechada" sem alterações.
- `constants/story-visual-quality.constants.ts`: nova `STORY_VISUAL_CORRECTION_INSTRUCTIONS` para cobertura/evidência (a atual fala de `sourceExcerpt`).
- `constants/lesson-editorial.constants.ts`: avaliar `SPECIAL_LESSON_VISUALS_INSTRUCTION` (seção 8).

### 4.2 Prompt de imagem

Em `utils.ts`, criar `buildCutoutKitImagePrompt` (e manter `buildStoryVisualImagePrompt` para o legado):

- Entrada: lição completa, categoria, `items[]`, composição proposta, referência de identidade.
- Regras fixas:
  - "Prancha de elementos para recortar": cada elemento isolado, corpo/objeto inteiro, sem cortes pelas bordas.
  - Espaço branco de pelo menos ~8% entre elementos e margem segura na borda.
  - Sem sobreposição, sem sombras projetadas no chão que se misturem com outros elementos (sombra suave opcional e contida no elemento).
  - Sem cena, sem horizonte compartilhado, sem fundo colorido contínuo. Cenário (montanhas, céu, mar) em faixas/peças recortáveis separadas.
  - Estilo do kit único: mesmo traço, paleta e proporção em todas as pranchas (replicar a identidade-mãe como hoje faz `identityReferenceImage` em `lesson-draft.service.ts` ~L1049).
  - Personagens de frente ou 3/4, pose neutra, corpo inteiro, pés visíveis.
  - Elementos "multidão" como silhuetas cinza quando a lição pedir uma multidão sem rosto.
- Ordem de geração: primeiro a prancha `CHARACTERS` (imagem-mãe de identidade); as demais usam essa referência para paleta e traço.

### 4.2.1 Prompt robusto: checklist de elementos e regras de qualidade

O prompt da LLM (inventário) e o prompt de imagem seguem um checklist fixo, para o kit não esquecer nada:

- **Personagens:** cada personagem nomeado, corpo inteiro, de frente ou 3/4, pose neutra e variantes de estado/emoção quando a história muda. Figurantes e multidão como silhuetas. Mesmo rosto, cabelo, idade aparente e roupa em todas as pranchas.
- **Animais:** todos os citados e os do contexto óbvio (ex.: estrebaria), em tamanhos proporcionais entre si e com os personagens.
- **Construções:** casas, cidade, hospedaria, templo, em pelo menos dois ângulos ou tamanhos quando aparecerem mais de uma vez.
- **Cenário:** montanhas, colinas, mar, rio, deserto, caminho e chão, em faixas largas recortáveis e em peças menores.
- **Céu e natureza (`SKY_AND_NATURE`):** nuvens em 3 tamanhos e formatos, pássaros em voo e pousados, sol, lua (cheia e crescente conforme a história), estrelas (grandes e pequenas), árvores, palmeiras, arbustos, flores e pedras. Sol e lua só em versão de dia/noite coerente com a lição. Nunca desenhar céu como fundo contínuo; só peças soltas.
- **Objetos:** tudo o que os personagens usam, carregam ou tocam (barco, manjedoura, cruz, redes, peixes, cajado, bolsa, cestos).
- **Escala e proporção:** o prompt informa as proporções relativas (ex.: adulto ≈ 1,0; criança ≈ 0,6; casa ≈ 3,0; árvore ≈ 2,5), para as peças combinarem ao montar.
- **Segurança e fidelidade:** nada violento, assustador ou sexualizado. Nenhum elemento sem apoio na lição, salvo os `SKY_AND_NATURE` de composição mínima, que são neutros.
- **Autoconferência antes de responder:** a LLM percorre o checklist, marca cada categoria como `coberta`/`não se aplica` em `coverageChecklist` (campo novo no schema da etapa) e justifica as exclusões. O servidor rejeita checklist incompleto.

### 4.2.2 Quantidade de pranchas (4 a 10): o básico sempre entra, o resto só acrescenta

Regra central: **o conjunto básico nunca é cortado**. Com 4 pranchas ele cabe inteiro, de forma mais compacta. Cada prancha a mais acrescenta elementos novos (mais variantes, mais peças e mais detalhe), sem remover nada do que já havia. Nenhuma quantidade deixa o kit incompleto.

**Conjunto básico (obrigatório em qualquer quantidade):**

1. Todos os personagens nomeados da lição (um por pose base).
2. Todos os animais citados.
3. Todas as construções/lugares citados.
4. Cenário essencial: montanhas/colinas, chão/caminho e, se a lição pedir, mar/rio/deserto.
5. Objetos que os personagens usam ou tocam na história.
6. Céu e natureza mínimos: nuvens, sol, pássaros e uma árvore (lua e estrelas entram aqui se a história acontecer à noite).

**Distribuição por quantidade (referência para o prompt e a validação):**

| Pranchas | Como o básico é organizado | O que é acrescentado |
| --- | --- | --- |
| 4 | Pranchas compostas por categorias combinadas: (1) personagens, (2) animais + objetos, (3) construções + cenário, (4) céu e natureza. A LLM decide quantos elementos cabem em cada prancha, sem encolher nenhum (seção 4.2.3). | Nada além do básico. |
| 5 | Personagens separados de objetos; animais e objetos deixam de dividir prancha. | Segunda pose/variante dos personagens principais. |
| 6 | Construções separadas do cenário. | Mais ângulos das construções, peças extras de cenário (colinas menores, caminhos, rio). |
| 7 | Céu e natureza ganham uma prancha só deles, ampliada. | Nuvens em mais formatos, pássaros em mais posições, lua em fases e estrelas, árvores e flores variadas. |
| 8 | Prancha própria só de animais. | Filhotes, mais animais de contexto, variantes de estado. |
| 9 | Prancha extra de personagens. | Expressões e poses adicionais (emoção em momentos-chave), figurantes e multidão em silhuetas. |
| 10 | Prancha extra de objetos e detalhes. | Objetos secundários, adereços de época, peças de transição (portas, cercas, tendas, barcos menores). |

Regras de implementação:

- Constante `CUTOUT_KIT_TIERS` (nova, em `constants/story-visual-quality.constants.ts`) mapeia `quantity → [{ category, extras }]`, só com categorias agrupadas e acréscimos, **sem** número mínimo ou máximo de itens. O mesmo mapa alimenta o prompt da LLM e a validação do servidor, sem lógica duplicada.
- O prompt recebe o `quantity` e as linhas do tier correspondente ("Com N pranchas, inclua obrigatoriamente o conjunto básico e as adições da tabela até a prancha N").
- Validação: o conjunto básico completo precisa estar presente em toda quantidade. De 5 em diante, as adições do tier são conferidas por `items[].extra: true` (campo novo, marca o item como acréscimo, não básico). Se o básico estiver incompleto em 4 pranchas, o servidor aciona a correção com `STORY_VISUAL_MAX_CORRECTIONS`.
- Frontend: `StoryVisualConfiguration` mostra, para a quantidade escolhida, o resumo do que o kit terá (ex.: "4 pranchas: o básico completo", "7 pranchas: básico + céu e natureza ampliado") usando o mesmo mapa de tiers, exposto pelo backend ou espelhado em `constants.ts`.
- Testes: um caso por quantidade (4 e 10 no mínimo) provando que o básico está sempre presente e que as adições crescem monotonicamente, sem remover itens do tier anterior.

### 4.2.3 Tamanho dos elementos: raciocínio no lugar de contagem

Com poucas pranchas (principalmente 4), a tentação é empilhar tudo e gerar peças minúsculas, impossíveis de recortar. O plano **não fixa quantidade de itens**. Quem decide é o prompt, com critério de tamanho:

- **Princípio:** o kit é **material do professor**: ele recorta as peças e as usa (painel, flanelógrafo, quadro) para ilustrar a história enquanto conta para a sala. Cada elemento precisa ser grande e nítido o bastante para **ser visto à distância por várias crianças sentadas** e para o professor manusear e recortar com facilidade. Nenhum elemento é encolhido para caber.
- **Orçamento de espaço:** a LLM raciocina sobre a área da prancha antes de listar os itens. Cada prancha declara, em `layoutPlan` (campo novo, texto curto), como os elementos se organizam e qual o tamanho relativo de cada um (grande, médio, pequeno). Elementos pequenos só são aceitos quando o objeto é naturalmente pequeno (pássaro, peixe, estrela) e, mesmo assim, com tamanho confortável de visualizar e manusear.
- **Se não couber, algo precisa ceder, e nunca o tamanho:** a LLM pode (a) reorganizar categorias entre as pranchas, (b) agrupar peças pequenas do mesmo tipo em linhas organizadas, (c) priorizar o essencial da história na prancha e (d) usar a margem e a orientação da prancha. Deve evitar cortar o básico (4.2.2); se for impossível, ela registra o conflito em `layoutPlan` para a revisão humana, em vez de gerar peças ilegíveis.
- **Proporção coerente:** o tamanho relativo continua respeitando a escala da seção 4.2.1 (adulto, criança, casa, árvore). Peças menores que o natural, só se ainda forem visíveis à distância e fáceis de manusear.
- **Elementos repetidos (nuvens, pássaros, estrelas):** a LLM escolhe uma quantidade racional para o espaço, sem número fixo. É melhor poucas peças bem desenhadas, com variações de tamanho e forma, do que muitas pequenas.
- **Imagem final:** o prompt de imagem repete a regra ("elementos grandes e nítidos, bordas completas, nada espremido nem minúsculo, mesmo que sobre espaço em branco"). Sobrar espaço é melhor que faltar.
- **Verificação:** o servidor valida apenas a presença e coerência do `layoutPlan` (cada item com tamanho declarado, nenhum "minúsculo"). Em fase posterior, avaliar uma checagem visual por modelo de visão para detectar elementos pequenos demais ou cortados, com regeneração automática da prancha.

### 4.3 Geração em `lesson-draft.service.ts`

- Ramificar o loop de assets (~L1049) por `visualConfig.type === CUTOUT_KIT`.
- Garantir que `CHARACTERS` seja gerada primeiro, reordenando só a execução, nunca o array salvo.
- Passar `purpose` novo `LessonImagePurpose.CUTOUT_SHEET` (em `providers/lesson-llm.types.ts`) até `generateImage`.
- `validateVisualConfig` (~L798): aceitar `CUTOUT_KIT` e manter 4–10 como pranchas; rejeitar os tipos antigos para novas gerações.

### 4.4 Política de texto e prompt final do provedor

- `utils/meditation-image.utils.ts` (`lessonImageTextPolicy`): novo ramo para `CUTOUT_SHEET`: "Sem letras, números, logotipos ou legendas. Elementos isolados em fundo branco puro."
- `open-ai-lesson.service.ts` (~L608) e `gemini-lesson-llm.provider.ts` (~L233): o prefixo "Ilustração bíblica infantil…" precisa mudar para `CUTOUT_SHEET` (hoje diz cena, e o tipo pedagógico/orientação são injetados literalmente). Para esse propósito, trocar por "Prancha de elementos ilustrados para recortar".
- Tamanho: manter `1024x1536` (retrato) e `1536x1024` (paisagem) por orientação.

### 4.5 Exportação DOCX/PDF

- `services/docx-exporter.service.ts`: `landscapeAssetPages`/`portraitAssetPages` seguem funcionando (uma prancha por página). Adicionar renderização da legenda: para cada item, o nome em texto pequeno (como nos exemplos), em uma faixa abaixo da imagem ou lista numerada no rodapé da página. Legendas nunca ficam embutidas na imagem.
- Incluir uma página inicial opcional "Lista de recortes" com o inventário (título da prancha, itens e dica de montagem). Decisão na seção 8.
- Retrocompatibilidade: lições com `visualConfig.type !== CUTOUT_KIT` seguem o caminho atual.

### 4.6 Documentação

- Atualizar `docs/api-ai-lessons.md` (contrato de `visualConfig` e dos assets) e `docs/diagrams/flow/ai-lessons/ai-lessons-flow.puml`.

## 5. Frontend (`clubinhonib-app/src/features/ai-lessons`)

- `types.ts`: novos `CUTOUT_KIT`, `CutoutCategory` e tipos dos assets com `items[]`.
- `components/StoryVisualConfiguration.tsx` (3 passos: quantidade, tipo, orientação): remover o passo "tipo pedagógico" ou deixá-lo fixo em "Kit de recortes", com texto explicando o resultado ("Pranchas com personagens, animais, casas, cenário e objetos para recortar"). A quantidade vira "número de pranchas". Sugerir o padrão com base nas categorias (3 a 5 já cobre a maioria das lições).
- `components/StoryVisualCarousel.tsx`: mostrar, por prancha, categoria, título e a lista de elementos com legendas. Hoje mostra uma cena por slide.
- `pages/admin/ai-lessons/LessonDraftDetailPage.tsx`: ajustar textos e rótulos da etapa e a validação do formulário.
- Regenerar uma única prancha (se a UI já suportar regeneração por asset): conferir compatibilidade com o novo `id` `kit-NN`.
- `constants.ts`: textos e descrições da etapa.
- Lições antigas continuam renderizando o carrossel de cenas (distinguir por `visualConfig.type`).

## 6. Testes

Backend (specs já existentes ao lado dos módulos):

- `utils.spec.ts`: `buildCutoutKitImagePrompt` contém as regras de isolamento, fundo branco e a referência de identidade.
- `lesson-draft.service.spec.ts`: cobertura faltando, `storyEvidence` inexistente e IDs fora do padrão geram `ConflictException`/correção. Caminho legado (`sourceExcerpt`) continua passando.
- `gemini-lesson-llm.provider.spec.ts` e `open-ai-lesson.service.spec.ts`: schema novo e política de texto de `CUTOUT_SHEET`.
- `docx-exporter.service.spec.ts`: legendas renderizadas e ausência de regressão no caminho legado.

Frontend: testes dos componentes de configuração e do carrossel com assets novos e legados.

Verificação manual: gerar o kit para (a) Nascimento de Jesus, (b) Pesca maravilhosa, (c) uma lição com muitos cenários, e comparar com os PDFs de exemplo. Checar fundo branco, espaçamento, cobertura e consistência dos personagens.

## 7. Riscos e evoluções

- **Modelos de imagem não garantem isolamento perfeito.** Mitigação: prompt com margens, limite de itens por prancha e revisão humana por prancha no Estúdio. Evolução: fundo transparente (a API de imagem da OpenAI permite saída PNG com transparência em alguns modelos; Gemini não) ou segmentação automática no servidor.
- **Cobertura "completa" é subjetiva.** A validação cobre o que o texto nomeia. Elementos implícitos (ex.: céu, chão) entram pela regra mínima de `SCENERY`.
- **Custo e tempo:** menos imagens que antes costumam bastar (3–5 pranchas), mas cada uma é mais densa. Medir qualidade com 6 itens por prancha.
- **Consistência de personagens entre pranchas** depende da imagem-mãe. Se faltar `CHARACTERS`, a validação rejeita.
- **Lições salvas** têm o formato antigo. Nenhuma migração de dados é necessária, mas qualquer código que leia `sourceExcerpt` precisa tolerar `undefined`.

## 8. Decisões abertas (precisam do Diego)

1. Os 4 tipos antigos de visual somem da UI ou o admin ainda pode escolher "Sequência de cenas"?
2. A **Lição Especial** (`SPECIAL_LESSON_VISUALS_INSTRUCTION`) também passa para o kit de recortes ou mantém os cartazes de cena? Hoje ela exige um cartaz por parte da história com "dica para o professor".
3. As legendas dos recortes (nome sob o elemento) ficam: abaixo da imagem no DOCX (proposta), em uma página-índice, ou sem legenda?
4. Quantidade padrão de pranchas dentro de 4 a 10 (o básico entra em qualquer quantidade, ver 4.2.2) e se a UI deve sugerir pelo conteúdo da lição ou manter a escolha manual.
6. A tabela de distribuição da seção 4.2.2 está adequada, lembrando que ela não define quantidade de itens? Em especial, o que você quer acrescentar primeiro quando passar de 4 imagens.
5. Os cenários devem vir como faixas largas recortáveis (montanhas, mar) ou também como peças pequenas? (Para nuvens, pássaros, sol e lua o plano já prevê peças soltas.)

## 9. Ordem sugerida de entrega

1. Contrato de dados (enum, schema, tipos do app) com testes de schema.
2. Prompts (template, regras da LLM, `buildCutoutKitImagePrompt`, política de texto).
3. Validação de cobertura e correção automática.
4. Geração ordenada (`CHARACTERS` primeiro) com referência de identidade.
5. Exportação DOCX com legendas.
6. Frontend (configuração, carrossel, textos).
7. Documentação e teste manual com os 3 casos.
