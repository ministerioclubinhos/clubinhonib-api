// Editorial notes curated from ../lições; do not ingest the historical folder blindly.
export const LESSON_REVIEW_QUESTION_MIN = 8;
export const LESSON_REVIEW_QUESTION_MAX = 10;

export const LESSON_EDITORIAL_FIELD_ORDER = [
  'title',
  'biblicalReference',
  'purpose',
  'songs',
  'memoryVerse',
  'principleExplanation',
  'story',
  'applicationAndAppeal',
  'counseling',
  'reviewQuestions',
  'closingPrayer',
] as const;

export const LESSON_BASE_PROMPT = `Produza somente a LIÇÃO BÍBLICA, seguindo o padrão editorial das lições manuais do Clubinho Bíblico NIB.

PÚBLICO E TOM
- Escreva em português brasileiro para crianças de 5 a 11 anos, com frases claras, calorosas, concretas e naturais para o professor falar em voz alta. Explique palavras difíceis imediatamente.
- Entregue uma aula completa pronta para ministrar, com narrativa desenvolvida, diálogos fundamentados na passagem, transições e ensino aplicado. Não entregue resumo, sinopse, lista de acontecimentos, artigo ou roteiro telegráfico. Desenvolva cada episódio essencial sem repetição artificial nem tamanho fixo.
- Inclua uma abertura participativa ligada ao cotidiano infantil, perguntas breves às crianças e orientações práticas ao professor entre parênteses, como (mostre a Bíblia), (aguarde as respostas) ou (mostre uma semente). Use recursos simples, seguros e relevantes ao princípio.
- Mantenha o conteúdo apropriado à idade, sem violência gráfica, imagens assustadoras, sexualização, romance ou debates de sexualidade. Não use comparações como múmia para pessoas ressuscitadas.

FIDELIDADE E REFERÊNCIAS
- Preserve o tema, as referências informadas e os acontecimentos essenciais. Não invente ações, pensamentos, costumes ou diálogos como fatos bíblicos. Exemplos do cotidiano devem estar claramente separados dos acontecimentos da passagem.
- Use a NVI nas citações literais. Se não puder garantir a redação exata, mantenha a referência e sinalize conferência humana junto à citação, sem apresentar uma paráfrase como NVI.
- Relatos paralelos do mesmo acontecimento podem ser harmonizados com cuidado. Histórias distintas devem ter subtítulos e referências próprios; não invente uma cronologia entre elas com expressões como algum tempo depois.
- Quando o tema exigir acontecimentos ausentes das passagens informadas, preserve biblicalReference literalmente e sinalize no trecho relevante quais referências complementares precisam de conferência humana. Não complete a fonte silenciosamente nem atribua fatos à passagem errada.
- Quando houver referência editorial fornecida nas orientações, preserve seu propósito, versículo principal, ordem dos episódios e pontos pedagógicos essenciais, salvo correção explicitamente solicitada. Não copie possíveis erros bíblicos, ortográficos ou históricos do original.
- Não copie nomes de voluntários, escalas, dados pessoais, propaganda, política, relatórios eleitorais ou anotações operacionais.

ORDEM OBRIGATÓRIA DO CONTEÚDO
1. TÍTULO (title): retorne somente o tema exato em caixa alta. O editor apresenta três linhas separadas: LIÇÃO com o número de weekNumber, TÍTULO e o tema. Não acrescente um título criativo nem substitua o tema.
2. TEXTO BÍBLICO (biblicalReference): preserve literalmente todas as referências fornecidas pelo administrador.
3. PROPÓSITO (purpose): objetivo pedagógico curto e específico, começando com verbo e preservando a ênfase do exemplo correspondente quando disponível.
4. MÚSICAS (songs): prefira duas músicas infantis conhecidas e pertinentes. Preserve as sugestões do exemplo correspondente quando apropriadas. Não invente títulos, artistas ou letras; sinalize conferência se necessário.
5. VERSÍCULO PARA MEMORIZAR (memoryVerse): defina um único texto principal e sua referência NVI. Preserve a seleção do exemplo correspondente, inclusive um trecho explicitamente delimitado como 9:22b ou 15:3b-4; não amplie o texto nem troque por outro versículo só por parecer mais fácil. Um único texto de memorização pode abranger versículos consecutivos. Para temas sem referência editorial, escolha um texto curto que expresse o propósito.
6. EXPLICAÇÃO DO PRINCÍPIO (principleExplanation): comece orientando a leitura diretamente na Bíblia; explique o sentido do versículo com exemplo concreto, participação das crianças e conexão com o propósito. Evite apenas definir conceitos abstratos.
7. LIÇÃO BÍBLICA (story): abertura participativa, contexto, episódios desenvolvidos com subtítulos quando houver mais de um relato, clímax e conclusão. Integre o princípio, o amor de Deus, o pecado, a obra de Jesus e a resposta de fé nos momentos pertinentes, sem interromper a história com sermões repetidos nem introduzir doutrina alheia ao tema. Diferencie fato bíblico, explicação e aplicação. Use apenas texto para o professor ministrar e instruções pedagógicas; não inclua descrições de imagens, prompts de arte ou marcadores scene-01 no campo story.
8. APLICAÇÃO / APELO (applicationAndAppeal): ligue a resposta da criança ao propósito e à história. Distinga a aplicação para quem já crê do convite voluntário a quem deseja seguir Jesus. Explique pecado com exemplos concretos, sem medo, pressão emocional ou promessa material. Preserve o sentido da oração do exemplo fornecido; sem exemplo, use: “Senhor Deus, perdoa os meus pecados e vem entrar no meu coração. Eu creio que Jesus, teu Filho, morreu na cruz no meu lugar e ressuscitou. Eu escolho te seguir! Quero que tu sejas o meu Senhor e Salvador, em nome de Jesus! Amém.”
9. ACONSELHAMENTO / CANTINHO DO ACONSELHAMENTO (counseling): oriente conversa individual e acolhedora para confirmar a compreensão, usando Bíblia, Livro Sem Palavras ou equivalente, Cartão de Decisão e Cartão de Aniversário de Novo Nascimento. Inclua uma pergunta de acolhida e oriente consultar o Manual do Professor; os exemplos citam páginas 17 a 21, cuja paginação deve ser conferida na edição utilizada. Não invente perguntas do manual, exponha a criança nem trate repetição de oração como prova automática de compreensão.
10. PERGUNTAS DA LIÇÃO (reviewQuestions): de oito a dez perguntas com gabarito completo, cobrindo os episódios e o princípio. Preserve quantidade e ordem quando houver exemplo correspondente. Não use apenas perguntas sobre nomes e lugares; inclua compreensão e aplicação. Não crie perguntas sobre fatos ausentes da aula.
11. FALANDO COM DEUS (closingPrayer): somente quando a orientação pedir explicitamente uma oração final separada. No padrão dos exemplos abaixo, devolva string vazia neste campo; a oração do apelo permanece em applicationAndAppeal. Não duplique a oração nem acrescente esta seção por hábito.

LIÇÕES COM DUAS OU MAIS SUB-HISTÓRIAS
- Quando o tema ou a orientação do administrador indicar duas ou mais histórias, apresente explicitamente essa quantidade na abertura da aula e desenvolva cada relato separadamente, na ordem solicitada. Não transforme episódios distintos em um único acontecimento.
- No campo story, escreva cada subtítulo em uma linha própria com o prefixo exato "### ", seguido do nome específico do relato e da referência bíblica correspondente. Deixe uma linha em branco antes e depois. Esse marcador será convertido em um título destacado no editor e no PDF; não use outros marcadores Markdown no restante da narrativa.
- Exemplo: "### A Primeira Multiplicação dos Pães (Mateus 14:13-21)" e, após a narrativa e uma transição clara de tempo/contexto, "### A Segunda Multiplicação dos Pães (Mateus 15:29-39; Marcos 8:1-10)". Desenvolva cada história com contexto, personagens, acontecimentos e conclusão próprios. Preserve o princípio comum e uma aplicação final conjunta, sem duplicar todas as seções da lição.
- Não use o número de evangelhos citados para contar histórias: passagens paralelas podem narrar o mesmo acontecimento. Não invente subdivisões quando houver apenas um relato. As perguntas devem contemplar todas as sub-histórias.

CENAS VISUAIS SEPARADAS
- Preencha visualScenes separadamente, com IDs únicos scene-01, scene-02 etc., propósito, descrição visual e texto alternativo, usando apenas acontecimentos explicitamente presentes em story.
- Nunca copie essas descrições para story. A narrativa deve continuar legível sem qualquer arte; a etapa posterior produzirá os visuais da história.

REFERÊNCIAS EDITORIAIS DO ACERVO (NOTAS CURADAS)
Estas notas descrevem escolhas e estilo reais; não são transcrições bíblicas nem confirmação automática de exatidão NVI. Use o conteúdo temático apenas quando o tema e as passagens corresponderem; o número da semana sozinho não autoriza reutilizar fatos, músicas ou versículos de outro tema.
- Semana 14, O poder de Jesus sobre a morte (João 11:1-44; Lucas 7:11-17): propósito de mostrar o poder de Jesus sobre a morte, sua ressurreição e a futura ressurreição dos filhos de Deus. Texto de memorização: João 11:25, sem acrescentar 11:26. Músicas: Deus é bom pra mim; Obedecer. A explicação usa uma semente mostrada às crianças. A abertura pergunta sobre um amigo doente. Primeiro desenvolve Lázaro, depois o filho da viúva de Naim, com subtítulos. Inclui dez perguntas.
- Semana 15, A primeira e a segunda multiplicação dos pães (Mateus 14:13-21; Marcos 6:30-44; Lucas 9:10-17; João 6:1-15; Mateus 15:29-39; Marcos 8:1-10): duas histórias distintas, com subtítulos próprios e transição entre elas. Primeira: cinco pães, dois peixes, cinco mil homens e doze cestos de sobras. Segunda: sete pães, alguns peixes, quatro mil homens e sete cestos de sobras. Nunca misture essas quantidades. Não apresente uma estimativa de mulheres e crianças como número bíblico informado. Propósito de mostrar que Jesus supre necessidades físicas e espirituais; texto principal de memorização João 6:48. A abertura relaciona a fome ao cotidiano das crianças. Preserve a ordem primeira/segunda e formule perguntas sobre ambas; não replique as omissões ou imprecisões do original.
- Semana 25, Julgamento e morte de Jesus: propósito de a criança crer em Jesus como Salvador, confiando em sua morte como pagamento pelo pecado. Texto de memorização: Hebreus 9:22b. Músicas: No meu coração, vem hoje entrar ó Cristo; Limpa o meu coração Jesus. A explicação conecta os sacrifícios do Antigo Testamento ao sacrifício de Jesus. Desenvolve prisão, julgamento e morte, ensinando inocência, entrega voluntária, perdão e amor de Jesus durante a narrativa. Inclui dez perguntas. Não acrescente a queda de Jesus carregando a cruz como fato bíblico; o sepultamento exige referência complementar quando as passagens informadas terminarem antes dele.
- Semana 26, Ressurreição, ascensão de Jesus e a grande comissão: propósito de mostrar que Jesus se entregou na cruz por nós e voltou a viver, mostrando seu poder sobre a morte. Texto de memorização 1 Coríntios 15:3b-4; músicas Pare, eu vou contar-lhe; Ouvir e obedecer. Abre perguntando se a morte foi o fim. Desenvolve ressurreição, aparições a Maria e aos discípulos, Tomé e o ensino sobre crer sem ver, grande comissão e ascensão. Não omita Tomé ao resumir as aparições de João 20. Inclui oito perguntas. O cabeçalho histórico não lista todas as passagens usadas: a grande comissão requer conferir Mateus 28:18-20, e a ascensão Lucas 24:50-53 e Atos 1:1-11. Não atribua a ascensão a João 20 nem misture palavras de comissões distintas como uma única citação.

REVISÃO ANTES DE ENTREGAR
Confira se o professor consegue ministrar sem completar lacunas essenciais, se todos os episódios foram ensinados, se o versículo e o propósito foram preservados, se a narrativa contém participação e aplicações concretas, se as citações estão identificadas corretamente e se faltam referências. Não crie brincadeira, fixação ou meditação nesta etapa. Responda somente nos campos do JSON Schema. A revisão humana continua necessária.`;
