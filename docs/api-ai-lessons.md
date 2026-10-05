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

OpenAI permite configurar chave, modelo de texto, modelo de imagem, qualidade e esforço de raciocínio. Gemini permite chave, modelo de texto e fallback, modelo e tamanho de imagem, quantidade de tentativas extras (inteiro de 0 a 10) e atraso base em milissegundos (inteiro de 0 a 10000). Valores numéricos são retornados como números, inclusive zero; strings numéricas legadas são transformadas no DTO. Erros transitórios `429/5xx` do Gemini usam os parâmetros salvos de backoff exponencial.

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
Meditações com versão `MANUAL_EDIT` imprimem o documento revisado, evitando
o conteúdo estruturado antigo; meditações geradas mantêm a imposição original.
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
