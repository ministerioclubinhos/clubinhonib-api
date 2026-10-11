# Estúdio Clubinho — produção de lições

O cabeçalho da lição gerada apresenta blocos separados: `LIÇÃO <semana>`,
`TÍTULO` e o tema, seguidos de `TEXTO BÍBLICO` e `PROPÓSITO` com seus
conteúdos. O número vem da semana cadastrada; o campo `title` contém o tema.
Títulos antigos com número e tema unidos também são separados na prévia PDF
e na exportação, inclusive para versões já salvas, sem regenerar o conteúdo.
O documento editado continua sendo a fonte da exportação; somente os blocos
do cabeçalho são normalizados.
O detalhe da lição também entrega o cabeçalho normalizado no documento do
editor, inclusive em versões antigas, sem exigir uma nova geração.

O Estúdio Clubinho é um fluxo administrativo autenticado para produzir um pacote de oito itens: lição, visuais da história, brincadeira, visuais e fixação do versículo, meditações para duas faixas etárias e trabalho manual.

O acervo histórico em `../lições` é referência de formato, não uma fonte automaticamente confiável. Arquivos políticos, nomes de voluntários, variantes de corte, rascunhos, erros ortográficos e citações não conferidas nunca são copiados. Cada etapa gera um único produto canônico; imposições de impressão são responsabilidade do renderer.

O número da semana, o tema e todas as referências bíblicas são obrigatórios na criação. A geração da lição preserva literalmente o campo de referências e define um único texto principal NVI para memorização (inclusive um trecho explicitamente delimitado ou versículos consecutivos).

### Padrão editorial da lição (template 4.4.0)

O prompt-base contém notas editoriais curadas dos exemplos das Semanas 14, 15, 25 e 26, em `src/modules/ai-lessons/constants/lesson-editorial.constants.ts`, usadas por OpenAI e Gemini. Essas notas orientam músicas, propósito, ordem dos episódios e ênfases pedagógicas; os versículos históricos são sugestões sujeitas aos critérios de brevidade e contexto quando tema e passagens corresponderem; a semana sozinha nunca seleciona o conteúdo. Não se trata de ingestão automática da pasta nem de confirmação textual da NVI. Outros exemplos podem ser descritos nas orientações complementares do administrador.

A narrativa deve ser uma aula desenvolvida para crianças de 5 a 11 anos, com abertura participativa, instruções práticas ao professor, exemplos concretos, episódios completos e ensino integrado. Descrições de arte permanecem exclusivamente em `visualScenes`, com IDs únicos `scene-01` etc.; não entram em `story` nem aparecem no editor como fala do professor. Versões antigas com marcadores de cena continuam legíveis.

O contrato aceita de oito a dez perguntas com gabarito, preservando a quantidade do exemplo correspondente. `closingPrayer` mantém seu campo string por compatibilidade com os schemas estruturados, mas fica vazio por padrão. O editor não exibe uma seção de oração vazia; uma oração final separada só é gerada quando solicitada explicitamente. A oração do apelo continua obrigatoriamente dentro de `applicationAndAppeal`. A ordem editorial do editor é determinística, independentemente da ordem das propriedades retornadas pelo provedor: aconselhamento, perguntas e, quando solicitada, oração final.

O prompt exige sinalizar referências complementares ausentes, citações NVI não conferidas e divergências relevantes, sem copiar erros do acervo ou inventar fatos. Na Semana 26, as notas destacam a falta das referências de grande comissão e ascensão no cabeçalho histórico. As instruções são critérios de geração; fidelidade bíblica e qualidade pedagógica continuam exigindo revisão humana. A mudança vale para novas gerações/regenerações; conteúdos já salvos não são reescritos automaticamente.

Os visuais da história usam como fonte canônica o conteúdo completo do tópico `LIÇÃO BÍBLICA` da versão atual da primeira etapa. O administrador informa uma quantidade inteira de 4 a 10 imagens: a LLM divide integralmente a narrativa nessa quantidade exata de trechos literais, contínuos e consecutivos, sem omitir, repetir ou reescrever conteúdo. Cada trecho e a história completa são incluídos no prompt final de sua imagem; personagens, ações, objetos, ambientes ou emoções ausentes dessa fonte não podem ser acrescentados. Quando a lição é editada no editor, o tópico estruturado é sincronizado antes de uma geração posterior.

A primeira cena gerada estabelece a identidade visual da sequência. Todas as cenas seguintes recebem essa mesma imagem-mãe como referência, além da história completa e de sua própria cena aprovada. A referência não é encadeada entre cenas: todas partem da primeira imagem para evitar deriva acumulativa de personagens, roupas, traço, paleta, iluminação e ambientes.

Nos visuais do versículo, a LLM decide a quantidade e os limites semânticos da sequência, mas o backend recompõe cada `displayText` diretamente a partir das palavras do versículo NVI aprovado. Isso preserva a divisão proposta sem permitir paráfrase e evita falhas causadas por espaços ou pontuação nas fronteiras entre dois visuais. A última peça permanece exclusiva para a referência bíblica.

O request da etapa envia à LLM um objeto `canonicalVerse` separado, contendo texto completo, referência completa e versão. A LLM escolhe de uma a nove partes para o texto e acrescenta obrigatoriamente uma última parte isolada somente para a referência. Cada prompt de imagem volta a receber o versículo inteiro, a referência inteira e o trecho específico daquela peça.

Cada visual do versículo é uma imagem final inspirada na referência `lições/Semana 7/versciculo`: o modelo gera o próprio trecho canônico dentro da arte, ocupando aproximadamente 95% da área em tipografia infantil extragrande, arredondada, multicolorida, com contorno branco e sombra. Não existe texto sobreposto pelo frontend ou pelo PDF. O fundo usa raios, nuvens e brilhos periféricos, sem pessoas, personagens, animais, cenas ou objetos reconhecíveis.

Na brincadeira, cada item do passo a passo possui exatamente um visual instrucional na mesma ordem. O prompt de imagem recebe a brincadeira completa e a instrução literal do passo, devendo demonstrar sua execução; imagens decorativas sem função de instrução são rejeitadas pelo contrato estruturado. O preview PDF da etapa imprime o número e a instrução do passo acima da imagem correspondente. Instrução e imagem formam um bloco indivisível para nunca serem separadas pela paginação.

A geração da brincadeira exige uma experiência lúdica de 10 a 15 minutos para crianças de 5 a 11 anos: combina poucas mecânicas fáceis de entender, mantém o grupo ativo, evita eliminação, filas e atividades com aparência de prova, e inclui uma simplificação para 5 a 7 anos e um desafio opcional para 8 a 11 anos.

Ao regenerar uma brincadeira existente, todas as versões anteriores são enviadas à LLM somente como referências negativas. A nova versão deve trocar nome, mecânica principal, materiais característicos, organização e sequência de ações; nenhum nome histórico pode ser reutilizado, mesmo com variações superficiais de acentuação, pontuação ou ordem. Se a primeira resposta repetir qualquer dinâmica anterior, o backend faz uma segunda tentativa automática; uma nova repetição é rejeitada e nunca substitui a versão atual.

Prompts personalizados são anexados ao prompt-base da etapa. Eles nunca substituem as regras editoriais, a segurança infantil, o formato de impressão ou o contrato bíblico.

## Provedor de IA

O Estúdio usa exclusivamente as configurações persistidas por `/adm/config-provedores-ia` na tabela `ai_provider_settings`. Nenhum provedor, modelo, chave ou parâmetro de LLM é lido de variáveis de ambiente. Sem configurações salvas, a API devolve valores iniciais editáveis e chaves vazias; não importa credenciais do ambiente nem usa chaves embutidas.

`GET /api/v1/lessons/providers/settings` retorna `{ llmProvider, openai, gemini }`. `PUT` no mesmo endpoint valida o DTO aninhado e salva os dois provedores e a escolha ativa em uma única transação. A escolha ativa ocupa o registro `provider = active`; os registros `openai` e `gemini` mantêm seus respectivos parâmetros. Os endpoints individuais de configurações continuam disponíveis. Todas essas rotas exigem JWT e papel administrativo.

Cada chamada de geração de texto ou imagem resolve o provedor e cria um snapshot de seus parâmetros salvos, sem alterar estado global ou exigir reinício. Não existe fallback entre provedores: selecionar Gemini nunca tenta OpenAI. O fallback de texto do Gemini usa somente o modelo Gemini configurado na página. A seleção da página só entra em vigor após salvar; erros de validação ou persistência não podem aparecer como sucesso, e a tela não usa localStorage como fonte das configurações nem armazena chaves nele.

OpenAI permite configurar chave, modelo de texto, modelo de imagem, qualidade e esforço de raciocínio. O campo `reasoning.effort` é enviado apenas para as famílias GPT-5, GPT-6 e o1/o3/o4, excluindo variantes `-chat`. GPT-4o, GPT-4o mini e GPT-4.1 omitem esse campo, inclusive com esforço salvo `none`. A configuração salva é preservada; os valores aceitos dependem do modelo. Gemini permite chave, modelo de texto e fallback, modelo e tamanho de imagem, quantidade de tentativas extras (inteiro de 0 a 10) e atraso base em milissegundos (inteiro de 0 a 10000). Valores numéricos são retornados como números, inclusive zero; strings numéricas legadas são transformadas no DTO. Erros transitórios `429/5xx` do Gemini usam os parâmetros salvos de backoff exponencial.

O Gemini usa saída JSON estruturada em `generateContent` e geração de imagem pela Interactions API. Chaves nunca são persistidas em versões, logs ou respostas públicas.

## Máquina de estados

Uma lição percorre `DRAFT`, `IN_PROGRESS`, `PACKAGE_READY`, `IN_REVIEW`, `CHANGES_REQUESTED`, `READY_FOR_PUBLICATION`, `PUBLISHING` e `PUBLISHED`. Cada etapa mantém seu próprio estado e versões imutáveis. Alterar uma etapa invalida as posteriores.

`GET /api/v1/lessons/:id` é leitura pura: nunca cria etapas, atualiza templates ou revoga aprovação. A criação do pacote grava a lição e suas oito etapas numa única transação.

`GET /api/v1/lessons/:id/events` mantém um stream SSE autenticado com snapshots do pacote. `POST /api/v1/lessons/:id/stages/generate` persiste a solicitação e retorna sem aguardar o LLM; o processamento continua em background e é retomado na inicialização da API quando uma etapa permaneceu em `GENERATING`.

## Listagem

`GET /api/v1/lessons` aceita `status`, `search`, `page`, `limit`, `sort` (`createdAt`, `updatedAt`, `theme`, `weekNumber`) e `order` (`ASC`, `DESC`). Busca considera tema e referência bíblica. A ordenação usa allowlist e desempate por id.

## Publicação idempotente

`POST /api/v1/lessons/:id/publish-week-material` reserva a lição sob lock pessimista, alterando-a de `READY_FOR_PUBLICATION` para `PUBLISHING`. Requisições concorrentes recebem conflito. Após a criação da página semanal, a lição recebe `weekMaterialId` e passa a `PUBLISHED`; chamadas posteriores devolvem o mesmo vínculo sem criar outra página.

Se o provedor falhar antes de criar a página, o estado volta para `READY_FOR_PUBLICATION`. Se a página for criada e a confirmação no banco falhar, a lição permanece em `PUBLISHING` para impedir duplicação e exigir reconciliação operacional.

## Arquivos e privacidade

Uploads de uma geração são rastreados e removidos se qualquer imagem ou persistência posterior falhar. Na exclusão, os registros são removidos antes dos objetos; uma falha de S3 gera órfão auditável em vez de manter registros apontando para arquivos inexistentes.

As respostas usam DTOs públicos. Snapshots de prompt, IDs da OpenAI, checksums, chaves internas e identificadores de autoria não são expostos.

### Documento editado e PDF

A edição manual conserva o AST Tiptap como fonte da prévia e da exportação.
O renderer preserva fontes, tamanhos em pt/px, cores, negrito, itálico,
sublinhado, destaque, alinhamento, espaçamento entre linhas, parágrafos vazios,
links externos e tabelas com células mescladas e larguras definidas.
Links aceitam http, https, mailto e tel; endereços incompatíveis viram texto simples.
Fontes dependem das famílias disponíveis no servidor LibreOffice.
A meditação dos menores usa uma folha A4 retrato com duas cópias idênticas,
atividades lado a lado, moldura preta, faixa de título preta, destaque amarelo
no versículo e oração em faixa cinza. O único logo é
`MEDITATION_HEADER_LEFT_PATH` (padrão: `header_esquerdo_meditação.png`).
As edições de título, versículo, instruções e oração alimentam essa mesma folha;
as imagens salvas são preservadas. ASTs antigos sem instruções recuperam os
textos das atividades estruturadas. O gabarito fica fora da folha infantil.
Documentos livres antigos sem atividades mantêm a exportação do AST.
A meditação dos maiores usa um core isolado e uma página A4 inteira; os campos revisados alimentam a mesma composição no PDF.
As artes recebem a instrução e a solução interna: desafios visuais funcionais,
com letras e rótulos somente quando necessários. Questões textuais não exigem arte.
Cada desenho ocupa no máximo 290 × 160 px no DOCX, mantendo sua proporção.
As duas metades têm altura fixa; tamanho do texto e das artes se adapta ao
conteúdo para evitar que a segunda cópia passe à próxima página.
O editor exclusivo de `MEDITATION_YOUNGER` mostra essa folha com duas cópias
sincronizadas e campos editáveis. Salvar conserva um único AST; a prévia usa
os mesmos textos. O item 7 também tem core exclusivo, com três desafios na página inteira.
Os demais itens continuam com o editor e o formato existentes.
Imagens já salvas precisam de regeneração para receber essa orientação.
Salvar antes de exportar continua obrigatório na interface.

### Duas ou mais sub-histórias

Quando o tema ou as orientações indicarem mais de uma história, o prompt exige
a quantidade na abertura, títulos próprios com as referências e desenvolvimento
separado na ordem solicitada. Passagens paralelas de um mesmo episódio não
contam como histórias diferentes. O campo `story` continua string: linhas
`### Nome do relato (referência)` viram títulos H3 alinhados à esquerda no
editor e no PDF; os marcadores não aparecem para o professor. A edição salva
conserva os subtítulos ao atualizar a narrativa estruturada.
As notas da Semana 15 distinguem as duas multiplicações e suas quantidades;
as perguntas devem cobrir ambos os relatos. Versões já geradas sem subtítulos
não são reescritas automaticamente: é necessário editar ou regenerar.

### Propósito, memorização e aplicação (template 4.4.0)

O propósito é uma única frase curta com verbo, objetivo concreto para a criança
e vínculo com o tema, sem restringir o público sem apoio na passagem.
O versículo escolhido deve ser curto, fiel e plenamente contextualizado,
preferencialmente até 20 palavras. Esse número é uma orientação do prompt,
não uma validação rígida: permite trechos delimitados sem distorcer o sentido
e respeita solicitações explícitas do administrador. Não precisa repetir o
versículo do acervo. Explicação e perguntas acompanham a seleção atual.
Sentimentos, intenções e diálogos devem ter apoio nas referências; ilustrações
fictícias e reconto são diferenciados da narrativa e das citações literais.
A aplicação inclui parágrafos distintos para quem já crê e quem deseja seguir
Jesus, atitudes infantis concretas, explicação de pecado, morte e ressurreição
de Jesus e convite voluntário. As orientações de músicas permanecem iguais.

### Revisão obrigatória da saída (template 4.4.0)

O prompt manda revisar e reescrever os trechos antes de devolver o JSON:
prefere uma frase de 3 a 12 palavras quando suficiente ao princípio, remove
introduções narrativas da memorização, diferencia trechos e citações completas,
proíbe atribuir ao versículo títulos que ele não contém e exige dois exemplos
concretos de pecado. Emoções e intenções sem apoio devem ser retiradas.
Não existe corte automático de citações bíblicas. A referência estruturada
é normalizada para retirar uma sigla NVI redundante; editor e fallback PDF
apresentam a versão uma única vez. Documentos antigos editados não são
reescritos automaticamente.

### Regras genéricas e integridade (template 4.4.0)

As regras valem para qualquer tema: concluir cada relato, preservar detalhes
atribuídos a personagens específicos nos evangelhos, adequar o sofrimento
ao público infantil, manter o convite voluntário e conferir perguntas/gabarito
contra o conteúdo efetivamente ensinado. Não são correções exclusivas da
Semana 10 nem substituições automáticas de narrativa.
O backend rejeita story vazio, fala com aspas sem fechamento, término com
sinal de continuação ou subtítulo sem texto. Essas verificações detectam
sinais formais de incompletude; não certificam a exatidão bíblica nem
garantem que todo desfecho foi semanticamente desenvolvido.
O Gemini rejeita candidatos cujo finishReason informado seja diferente de
STOP, mesmo com JSON válido, e mantém o fallback de modelo já configurado.
OpenAI já rejeita incomplete_details. Quando as tentativas não retornam
conteúdo válido, a etapa falha e a versão anterior permanece preservada.
O código AI_INCOMPLETE_RESPONSE identifica corte por limite de saída ou
sinais formais de narrativa incompleta; bloqueios continuam AI_CONTENT_BLOCKED.

### Shared quality across production stages

All eight stage base prompts and provider template contracts include the same generic quality policy, including administrator-customized prompts. Each stage also receives specific completeness checks: narrative endings and scene fidelity, executable games and verse dynamics, complete verse card sequences, age-appropriate meditations with solvable activities and checked answers, and usable printable craft instructions. Derived stages preserve the approved verse verbatim; only the lesson selects a short contextual verse. These instructions require provider self-review and do not replace human semantic review. Lesson template version is 4.5.0; other stage contracts increment their minor versions. Existing saved materials are unchanged until regeneration.

Meditation prompts use the reference worksheet styles for ages 4–7 (younger)
and 8–11 (older). Each question must connect to the approved theme, narrative
and application. Recognition, sequencing, counting, tracing, crossword clues,
codes and word searches include all necessary alternatives and clues. Free
coloring is exceptional; selective painting may indicate the correct answer.
Functional images may include puzzle labels; other stages retain their image
text policy. Teacher answers remain internal.

Meditation exports preserve inline emphasis, font family/size, text color,
highlight, alignment and lists from the saved meditation AST. Both meditation
renderers keep their fixed page composition while reading the styled fields;
structured-only and legacy documents retain their text fallback.

Older meditation uses three substantial activity blocks with multiple subitems
and complete puzzle clues. Sparse generated worksheets trigger up to two targeted correction
attempts before image generation; incomplete output after those attempts fails
instead of being saved as a ready worksheet. Generated titles use the lesson
theme and biblicalText uses canonical references. Text and artwork share each
activity panel, and panel height follows its content instead of equal thirds.

Item 7 reserves space for the prayer and nested-table paragraphs before
allocating activity heights. Longer titles, verses and prayers reduce the
activity budget. Textual word searches are checked for rectangular rows and
the presence of every listed word in eight directions, with normalized accents.
Invalid grids trigger the same bounded corrections, which receive
the specific diagnostic, previous JSON and word counts per activity; invalid output is not saved. Raster puzzles still
require visual review. Each generated image must belong to only its activity.
The older meditation template is version 1.4.0; saved question content and
images are preserved until regeneration or manual editing.
Item 7 accepts an empty printableAssets array and still inherits the approved
NVI verse. Local validation conflicts retain their reason as AI_CONTENT_INVALID.
Its generation source is the approved lesson narrative, verse and application,
not the younger worksheet. Image assets and unrelated lesson fields are omitted.
OpenAI text requests for item 7 use a 4096-token output cap on models without
reasoning. Temporary 429 rate_limit_exceeded/slow_down errors allow two retries,
honoring Retry-After or the provider's seconds hint with jitter. Server delays
above 60 seconds are not retried early; quota and billing errors are not retried.

Story visual generation validates literal coverage of the complete approved narrative,
sequential IDs and the requested asset count before creating images. Invalid output
receives up to two targeted corrections using the approved story and previous JSON.
Valid output makes no extra text calls. Persistent content failures retain
AI_CONTENT_INVALID; provider errors are propagated without content correction retries.

Older meditation rebuilds invalid recognizable text word-search grids locally
from their listed words before validation and after each text correction. The
rectangular grid includes every listed word, with a regenerated coordinate answer
and no duplicate image for the repaired activity. Ambiguous lists still follow
the bounded correction path and retain AI_CONTENT_INVALID on persistent failure.

Older meditation exports also repair saved text puzzles after applying editor
edits, synchronize the corrected activity in the renderable AST and retain
formatting in unaffected fields. The word list is matched on its own line,
so the heading "Caça-palavras:" cannot be mistaken for the list. Puzzle letters
render in equal native DOCX cells; activity numbers are not duplicated and
extra generic answer lines are omitted. Sparse text uses a larger readable font.
If two full-sheet corrections still leave fewer than 200 words and an approved
narrative exists, generation makes at most three focused block corrections.
Each requests six complete subitems and six paired answers with at least 110
words, merges only the corrected block and removes its obsolete artwork.
Malformed or insufficient block output is not merged; persistent invalid content
still fails with AI_CONTENT_INVALID. This applies to both configured providers.

The older sheet fits font and image size against estimated wrapped prose,
native grid row height and reserved prayer space. Grid letters never count as
prose words for density validation, even when they are separated by spaces.

## Meditação dos maiores: contrato 2.0.0

A etapa 7 usa regras gerais, independentes do tema. Novas gerações têm três
atividades estruturadas: narrativa, compreensão e aplicação em uma situação
concreta. Cada atividade declara `mechanic`, `goal`, `sourceExcerpt`, `context`,
`command`, `supportText`, `subitems` (`prompt`, `options`, `answer`) e
`visualRequired`. O adaptador monta `instruction` e o gabarito interno; esses
metadados e as respostas não entram no documento infantil.

O contrato admite alternativas, lacunas, verdadeiro/falso, associação, sequência,
caça-palavras, cruzadinha, código, iniciais, labirinto, encontrar erros, resposta
aberta e `OTHER` para outra mecânica completa. Não há seleção de conteúdo por
semana, tema ou nome de personagem. São verificadas completude dos subitens,
alternativas e gabaritos, variedade, fundamentação na fonte, extensão máxima e
espaço legível. Não há mínimo artificial de palavras nem correção que transforme
um enigma em questionário para preencher a folha.

Uma chamada de revisão separada usa o mesmo provedor configurado para conferir
fidelidade, dificuldade, repetição semântica, aplicação e soluções. Há até duas
correções do JSON completo. Isso acrescenta chamadas de texto; revisão por IA não
substitui a aprovação humana. Falha do revisor não é tratada como aprovação.

Artes são permitidas somente para atividades que precisam delas. As imagens reais
são enviadas ao modelo de texto com visão, identificadas pelo número da atividade,
antes de qualquer upload. Artes rejeitadas recebem até duas correções; persistindo
o problema, a geração falha e mantém a versão anterior. Um modelo configurado que
não aceite imagens precisa ser substituído na configuração para gerar esses
exercícios visuais; não há aceitação silenciosa sem revisão.

Questões textuais não recebem imagens redundantes. Caça-palavras usa grade nativa
validada, sem bitmap de letras. Cruzadinhas textuais usam `#` como casa bloqueada,
`.` como casa vazia e dígitos para início de pistas. O editor mantém texto e grades
editáveis, e o PDF usa células nativas para grades reconhecidas.

Editor e exportação usam o documento editado como fonte. Salvar sincroniza os
campos da meditação com os dados estruturados; a exportação preserva a formatação.
O editor mostra aviso quando o conteúdo transborda. O PDF não usa altura exata
que corte o conteúdo e rejeita folhas que excedem o ajuste legível (mínimo 10 pt),
com erro 422 no envelope global. Versões antigas continuam legíveis, mas não são
reescritas pedagogicamente: é necessário editar ou regenerar para corrigir seu
conteúdo. Nenhuma alteração de banco é necessária.

A fundamentação (`sourceExcerpt`) do item 7 aceita trechos e paráfrases fiéis. A validação local exige evidência preenchida; a revisão semântica obrigatória confronta evidência e exercícios com a lição aprovada. Diferenças literais não provocam rejeição automática; fatos sem apoio continuam sujeitos a correção e falha após o limite de tentativas.

O item 7 aceita de 1 a 6 subitens completos por bloco para todas as mecânicas. Não há mínimo fixo de quatro perguntas para narrativa ou compreensão. A revisão obrigatória avalia substância e cobertura da lição; blocos vazios, incompletos ou excessivos continuam rejeitados.

Diagnóstico do item 7: logs `[meditation-older]` identificam fase, tentativa, responseId, contagens de palavras/subitens e motivos de rejeição, sem imprimir a folha ou os prompts. Introduções não vazias de até 45 palavras não exigem mínimo de 15 palavras. Correções que repetem a mesma falha local com as mesmas contagens são interrompidas antes de nova chamada paga; a mensagem explica a ausência de progresso.

O encaixe estimado do item 7 é diagnóstico de diagramação, não motivo para regenerar texto via IA. Após aprovação semântica, a versão é salva para edição mesmo com overflow estimado; o log `phase=layout` informa alturas disponível/necessária, alturas por bloco e fonte. Editor sinaliza excesso e exportação continua bloqueando cortes. Alternativas curtas são impressas juntas na mesma linha, preservando ordem, numeração e gabarito.

Regra vigente do item 7: sempre três imagens, IDs 1, 2 e 3, uma por questão como anexo ou apoio visual. A exigência inclui questões textuais e substitui a antiga regra de imagens opcionais. Caça-palavras mantém grade nativa e recebe ilustração de apoio sem duplicar a grade. Revisão aceita apoio contextual relacionado à questão, preservando proibição de respostas expostas, enunciados duplicados e jogos não solicitados.

Revisão do item 7 declara `reviewPhase` TEXT (antes da geração de artes) ou IMAGES (após). Issues possuem severity BLOCKER/SUGGESTION e code categorizado. Sugestões editoriais não causam regeneração; ausência de imagem pronta não bloqueia TEXT. IMAGES avalia somente defeitos das artes relacionadas ao texto aprovado, sem reabrir redação/aplicação. Gabarito incorreto, fatos sem apoio e exercícios incompletos continuam bloqueantes na fase textual. Logs distinguem advisory e outside-phase sem uma chamada adicional de classificação.

SEQUENCE no item 7 usa `sequenceEvents` com relato (`story`), acontecimento (`text`) e posição cronológica dentro do relato (`order`). O servidor separa relatos, embaralha sem entregar a ordem resolvida, atribui `displayedId` e calcula o gabarito a partir desses identificadores. Posições faltantes/repetidas, grupos unitários e eventos duplicados são rejeitados localmente. A revisão semântica confere acontecimentos na fonte; uma inversão precisa identificar os fatos concretos envolvidos, nunca presumir que o gabarito de uma lista embaralhada seja 1,2,3. O servidor ignora apontamentos ANSWER_KEY somente quando lista e gabarito da sequência correspondem exatamente ao cálculo local; cronologia semanticamente errada permanece bloqueante como SOURCE_FACT. Gabaritos alterados ou listas divergentes não recebem essa exceção. A mesma instrução montada alimenta edição e PDF.

Item 8 (Trabalho manual): a geração de arte aplica finalidade MANUAL_COLORING e um prompt obrigatório de contornos pretos, fundo e interiores brancos, sem cores, cinza, sombras ou preenchimentos. Essa regra é aplicada após a composição proposta, inclusive se o texto gerado sugerir uma paleta colorida. Gera uma única arte para pintar; o exportador monta as duas cópias de impressão.

O PDF do item 8 usa A4 retrato explícito e duas cópias idênticas empilhadas numa única linha de tabela não divisível. O dimensionamento reserva cabeçalho e versículo antes da imagem, preserva proporções e inclui separador para recorte. Texto excepcionalmente longo que elimina o espaço mínimo da arte é rejeitado antes da conversão, sem reduzir a legibilidade nem separar cópias em páginas distintas.

Cada uma das duas cópias do trabalho manual possui moldura preta contínua nos quatro lados, com margem interna segura; ambas permanecem no mesmo bloco indivisível em A4.

Falhas ao carregar a lição, exportar ou converter o PDF durante a publicação também restauram READY_FOR_PUBLICATION quando nenhum material foi criado; não deixam a lição presa em PUBLISHING. A meditação dos maiores reduz os limites de altura das três imagens gradualmente (até 140px) antes de rejeitar encaixe, preservando fontes de pelo menos 10pt e todos os textos/imagens.

Weekly material publication now renders the eight approved stages as eight independently named PDF documents, each with a unique upload field and filename. All PDFs must succeed before the weekly page is created. The page title includes the week number and theme, and its public route follows the existing weekly-material route generator (`materiais_semanal_` + normalized title). Consolidated PDF export remains available separately. Already published lessons retain their existing link and are not silently duplicated or rewritten.

Image generation retries a transient socket reset (ECONNRESET/EPIPE) or temporary DNS failure (EAI_AGAIN) exactly once after 1.5 seconds, recreating only the same image request. Text and previously completed artwork are not regenerated during that retry. Invalid requests, authorization/billing/429 errors, and ambiguous timeouts are not retried by this policy. Exhausted connection failures expose AI_CONNECTION_INTERRUPTED rather than AI_UNKNOWN_ERROR; the previous persisted version remains intact. Provider retries can incur additional image charges.
