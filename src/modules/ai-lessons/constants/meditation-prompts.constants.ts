/** The printed models for the younger children are always black line art to be coloured. */
export const YOUNGER_MEDITATION_LINE_ART_RULE =
  'Desenho em preto e branco para a criança pintar: somente contornos pretos nítidos sobre fundo branco puro, com interiores brancos. Sem cores, tons de cinza, sombreado, degradê ou preenchimentos. Desenhe grande, ocupando todo o quadro, com poucos elementos e traço grosso.';

export const YOUNGER_MEDITATION_BASE_PROMPT = `Produza somente a MEDITAÇÃO PARA CRIANÇAS MENORES, seguindo os modelos reais do Clubinho Bíblico NIB: O Semeador, os poderes de Jesus sobre os demônios, as doenças, a natureza e a morte, e a multiplicação dos pães.

PÚBLICO E FOLHA
- Crianças de 5 a 8 anos, inclusive em alfabetização inicial; leitura com apoio do professor. Comandos concretos e desafios visuais simples.
- Exatamente duas atividades complementares, numeradas 1 e 2. O renderer monta duas cópias idênticas na mesma página A4 retrato: logo oficial à esquerda, faixa preta, título, Nome/Data, versículo destacado, duas colunas e oração no rodapé.
- Use o tema, os fatos e o único versículo NVI aprovados na lição. Não copie os temas, versículos ou soluções dos exemplos para outra semana.
- Cada instruction deve reunir uma contextualização bíblica curta e o comando completo da atividade. Use 20 a 45 palavras, como nas folhas impressas, e no máximo três pequenas subperguntas; na múltipla escolha escrita, cada pergunta tem 3 opções curtas. Quando usar círculo e X na mesma atividade, o círculo marca o que é certo e o X o que não é, e não repita título, versículo ou cabeçalho.
- As duas questões formam uma sequência do mesmo tema: compreender o acontecimento e reconhecer sua mensagem. Retome personagens, ações e propósito da lição em cada contextualização; não crie passatempo genérico apenas com um personagem bíblico ao lado. A oração conclui essa mesma mensagem.
- FOCO NO ENSINO CENTRAL: a resposta correta de cada atividade representa a mensagem central e o propósito da lição aprovada, não um detalhe secundário da história (por exemplo, numa lição sobre o destino eterno, o acerto é o lugar junto de Deus/Abraão ou ouvir a Palavra de Deus, e não a mesa ou a porta da casa). Pelo menos uma das duas atividades trata diretamente dessa mensagem.
- Quando houver dois relatos bíblicos na lição, cubra ambos, distribuindo os fatos entre as duas atividades sem misturá-los.

ESTILO DAS ATIVIDADES — COMO AS FOLHAS IMPRESSAS DO CLUBINHO
- As duas atividades usam mecânicas DIFERENTES entre si e variam de uma semana para outra; escolha as que melhor servem à história e à mensagem desta lição. Não repita sempre o mesmo par de questões.
- Cardápio das folhas reais (exemplos de forma, não de conteúdo): labirinto simples levando um personagem ao destino certo (ajudar o semeador a encontrar a terra boa; levar o cego até Jesus); labirinto de letras em círculos cujo caminho certo revela um nome, com uma linha para escrever a resposta (REGIÃO DOS G_______); pintar somente as áreas com pontinhos para revelar uma figura; cobrir linhas pontilhadas para completar um desenho e depois pintar; pintar o local ou a figura certa entre 2 ou 3 (hospital ou casa); pintar as cenas que mostram o fato da história; circular ou marcar X em figuras rotuladas; ligar figuras; numerar cenas na ordem; múltipla escolha escrita com 2 ou 3 perguntas curtas (a, b, c), cada uma com 3 opções curtas para circular.
- Para 5 anos a tarefa deve ser realizável ouvindo o comando e olhando as figuras; para 7–8 anos, palavras curtas, perguntas simples e contagem são adequadas. Não exija escrita de frases, leitura longa ou cálculo abstrato.
- Pintar ou colorir só vale ligado ao fato (pintar a cena certa, revelar pelos pontinhos, completar o pontilhado); desenho livre para colorir nunca é usado nas duas atividades.
- Não use caça-palavras denso, cruzadinha, texto abstrato ou tarefa que dependa de material externo.

ELEMENTOS IMPRIMÍVEIS
- A atividade 1 sempre tem arte. A atividade 2 tem arte, exceto quando for múltipla escolha escrita: nesse caso todas as perguntas e opções ficam no próprio comando.
- Se o comando de uma atividade pedir para observar, pintar, ligar, circular ou resolver figuras, imagens, desenhos, labirinto ou caminho, a arte daquela atividade é obrigatória e mostra exatamente esses elementos. Nunca escreva "figuras abaixo" sem a arte.
- printableAssets.id deve ser literalmente "1" ou "2", correspondente ao número da atividade. Não associe uma arte ao desafio errado e não repita ids.
- Toda arte é desenho em preto e branco para pintar: contornos pretos, interiores e fundo brancos, sem cores, cinza ou sombreado. Traço limpo, figuras grandes e legíveis numa coluna de meia folha A4.
- O prompt de cada arte especifica cada elemento e a composição completa. Labirinto: entrada e destino desenhados e identificáveis, corredores largos, poucos caminhos e um único caminho que chega ao destino. Letras no labirinto: o caminho certo forma exatamente a resposta. Pontinhos: só as áreas da figura escondida têm pontos. Pontilhado: o contorno a cobrir é tracejado. Escolha: todas as alternativas presentes, do mesmo tamanho e em quadros separados, com rótulo curto em MAIÚSCULAS quando ajudar.
- Não desenhe cabeçalho, logo, instrução completa, versículo, oração, número externo da atividade, o caminho resolvido ou a resposta marcada na arte; o renderer cuida desses elementos.

GABARITO, ORAÇÃO E CONFERÊNCIA
- answer é interno para o professor: dê a solução completa, com caminho/sequência ou a resposta de cada subitem, coerente com os fatos aprovados. Não imprima nem destaque a alternativa correta no material infantil.
- prayer: uma frase curta iniciada por "Jesus," ou "Senhor," ligada à aplicação da lição.
- Antes de devolver o JSON, confira: exatamente duas atividades com mecânicas diferentes; arte para toda atividade que cita figuras, labirinto ou caminho; a resposta correta de cada uma ligada à mensagem central da lição; desafios completos e solucionáveis; imagens associadas aos ids corretos; todas as pistas/alternativas necessárias; resposta determinística; versículo preservado; ausência de conteúdo assustador; textos e artes que cabem na folha duplicada. Corrija qualquer incoerência antes de responder.`;

export const OLDER_MEDITATION_BASE_PROMPT = `Produza uma meditação de uma página A4 para crianças de 8 a 11 anos, baseada exclusivamente no tema e na lição aprovada. As regras são gerais para qualquer relato bíblico e qualquer mecânica de exercício.
ESTRUTURA E PROGRESSÃO
- title é o tema; biblicalText contém somente as referências; preserve o único versículo aprovado. Introduction é breve e clara, com até 45 palavras, sem mínimo artificial; prayer é uma frase curta. Não use Markdown.
- Exatamente três blocos: goal NARRATIVE (recordar acontecimentos), COMPREHENSION (entender a mensagem) e APPLICATION (uma situação concreta da vida da criança). Cubra os relatos relevantes sem misturá-los. Não repita fatos perguntados ou a mesma mecânica.
- Cada atividade declara mechanic, goal, sourceExcerpt (trecho ou síntese fiel da lição que a fundamenta, interno), context (até 35 palavras), command (até 30 palavras), supportText, subitems e visualRequired. O servidor monta instruction e answer a partir desses elementos; não gere esses dois campos.
- Contexto e comando devem ser curtos. Não preencha a página com introduções, explicações sobre o exercício ou repetição. Não existe mínimo de palavras: a qualidade vem dos elementos executáveis e do desafio. Máximo 170 palavras imprimíveis por bloco e 450 na folha; reserve espaço para escrever ou marcar.
QUESTÕES COMPLETAS
- Cada subitem tem prompt, options e answer interno. O enunciado inclui os dados necessários. Options é vazio quando não houver seleção; em seleção use alternativas plausíveis, distintas, sem respostas absurdas. Answer copia a alternativa correta literalmente. Nunca escreva a resposta junto ao enunciado.
- Cada bloco tem 1–6 subitens, conforme a complexidade, os dados de apoio e o espaço disponível. Não acrescente perguntas para atingir uma quantidade fixa. Um exercício composto de associação, sequência ou enigma pode ser um único subitem com vários elementos completos. A revisão avalia substância, compreensão e cobertura da lição, não uma contagem mínima de perguntas. Para aplicação aberta, gabarito contém critérios e exemplos aceitáveis, sem impor uma única experiência pessoal.
- Varie entre cruzadinhas, códigos, sequências, associação e outras mecânicas completas: MULTIPLE_CHOICE, FILL_BLANK, TRUE_FALSE, MATCHING, SEQUENCE, WORD_SEARCH, CROSSWORD, CODE, INITIALS, MAZE, SPOT_ERRORS, SHORT_ANSWER ou OTHER para outra mecânica completa. Não imponha uma mecânica ao tema. Perguntas devem exigir entender a história, não apenas eliminar respostas ridículas.
- supportText contém banco, legenda, pistas, acontecimentos embaralhados ou grade completos, uma única vez. Completar tem lacunas; associação tem os dois grupos; SEQUENCE declara sequenceEvents com story, text e order (1..N por relato), no máximo oito acontecimentos no total; outros tipos usam sequenceEvents vazio. Não numere nem embaralhe manualmente e não duplique acontecimentos em supportText ou subitems: o servidor imprime grupos separados, embaralha a lista e calcula o gabarito. Use apenas um subitem de resposta por relato e um comando curto de ordenação; código tem legenda verificável; iniciais usam nomes inequívocos e a quantidade correta de letras; cruzadinha tem numeração e cruzamentos consistentes (grade textual usa # para casa bloqueada, . para casa vazia e números de um dígito nas casas de início, separados por espaços); labirinto tem entrada e destino alcançável; encontrar erros tem diferenças significativas conferíveis.
- Caça-palavras mantém a grade textual nativa: supportText contém comando Caça-palavras, lista na linha Palavras: e grade retangular com letras MAIÚSCULAS separadas por espaços. Cada palavra inteira precisa estar na grade, e o gabarito informa posições. A imagem obrigatória do bloco é um apoio relacionado às palavras/ao relato, sem repetir a grade.
ARTES
- printableAssets contém SEMPRE exatamente TRÊS imagens, ids "1", "2" e "3", uma por bloco. Todos os blocos usam visualRequired true. Cada imagem serve de anexo ou apoio visual específico à questão, inclusive nas atividades textuais; pode ilustrar a situação, personagens ou elementos a observar, sem repetir o enunciado, revelar respostas ou acrescentar outro jogo.
- Arte visual contém os elementos do desafio ou uma ilustração de apoio pertinente àquela questão, nunca outro exercício, instrução completa, banco já impresso, cabeçalho ou solução. O prompt especifica todos os dados e alternativas de forma coerente com os subitens e gabaritos. Não marque a resposta, não ligue o par correto nem desenhe o caminho resolvido.
- Antes de entregar, resolva todos os desafios, confira cada gabarito, relações com a lição, variedade e aplicação concreta. Não substitua um enigma por questionário longo para atingir contagem de palavras.`;

/**
 * A younger-meditation command that depends on pictures (figures, a maze, a
 * path) needs its art; when the model forgets to plan it, it is added.
 */
export const VISUAL_ACTIVITY_REFERENCE =
  /\b(figuras?|imagens?|desenhos?|cenas?|labirinto|caminho|pontilhad[ao]s?|pontinhos)\b/i;

export const MISSING_ACTIVITY_ART = {
  purpose: 'Figuras indispensáveis ao comando da atividade.',
  prompt:
    'Desenhe somente os elementos indispensáveis citados no comando da atividade (figuras para circular ou pintar, labirinto ou caminho com entrada e destino, cenas para ordenar), grandes e bem separados, em preto e branco para pintar: contornos pretos limpos, fundo e interiores brancos, sem destacar a resposta nem desenhar o caminho resolvido.',
  altText: 'Figuras da atividade.',
} as const;
