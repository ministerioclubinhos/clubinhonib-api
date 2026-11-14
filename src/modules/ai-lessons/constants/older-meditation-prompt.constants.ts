/**
 * Prompt base da etapa 7 (meditação das crianças maiores, 8 a 12 anos).
 *
 * Descreve o estilo das folhas feitas à mão pela equipe: cabeçalho fixo
 * (montado pelo servidor), 3 ou 4 questões numeradas, cada uma começando
 * com um parágrafo curto da história e terminando num comando claro, e a
 * oração "Falando com Deus" fechando a página. A quantidade de questões
 * depende do tamanho dos exercícios: a página A4 é sempre aproveitada inteira.
 */
export const OLDER_MEDITATION_BASE_PROMPT = `Produza a MEDITAÇÃO PARA CRIANÇAS MAIORES (8 a 12 anos): uma única página A4, baseada exclusivamente no tema e na lição aprovada, no mesmo estilo das folhas impressas do Clubinho Bíblico. As regras valem para qualquer relato bíblico.
CABEÇALHO (o servidor desenha a faixa, o logo, "Nome/Data", o quadro "Versículo para decorar" e o "Falando com Deus")
- title: o tema em poucas palavras, como "O poder de Jesus sobre as doenças".
- biblicalText: o NOME dos relatos estudados (diferente do título/tema), separados por " / ", nunca a referência bíblica, sem números e sem parênteses (ex.: "A cura de um cego de nascença / A cura de um paralítico"; "O rico e Lázaro"). É impresso entre parênteses abaixo do título.
- verseText e verseReference: o único versículo aprovado, em NVI.
- introduction: deixe vazio (""). O contexto da história entra dentro de cada questão, como nas folhas impressas. Só escreva uma frase (até 25 palavras) se a lição exigir uma explicação que não caiba em nenhuma questão.
- prayer: uma oração curta, em primeira pessoa, ligada à aplicação (ex.: "Senhor Jesus, obrigado por cuidar de mim. Ajuda-me a confiar sempre em Ti!").
QUANTIDADE DE QUESTÕES E ESPAÇO
- SEMPRE 3 ou 4 questões (activities), numeradas 1, 2, 3, 4. A página A4 fica CHEIA, sem espaço em branco, como nas folhas impressas:
  • 4 questões no caso comum (um passatempo grande e três exercícios curtos ou médios);
  • 3 questões somente quando duas delas são passatempos grandes (caça-palavras, cruzadinha, código longo, labirinto ilustrado) ou têm muitos subitens.
- Para encher a página, use exercícios com substância: 3 a 5 subitens nas questões de marcar ou completar, caça-palavras com 6 a 8 palavras, cruzadinha com 4 a 6 pistas. Nunca encha com texto artificial nem corte um exercício para caber.
FORMATO DE CADA QUESTÃO (como "1. Quando Jesus desceu do monte, ... Resolva o labirinto e descubra o nome da região.")
- context: 1 a 3 frases curtas que recontam o trecho da história daquela questão, em linguagem de criança de 8 a 12 anos, com fatos da lição. Pode trazer um ensino simples ("O pecado nos afasta de Deus..."). Até 35 palavras.
- command: o que a criança deve fazer, direto e completo ("Circule a alternativa correta.", "Complete as frases de acordo com a legenda.", "Encontre no caça-palavras as palavras destacadas no texto."). Até 30 palavras.
- supportText: dados de que o exercício precisa, impressos uma única vez (legenda, banco de palavras, tabela de código, grade, lista de palavras).
- subitems: as perguntas, lacunas ou frases do exercício, com gabarito interno (a solução completa: resposta de cada subitem, caminho do labirinto ou ordem da sequência).
- PROGRESSÃO: a questão 1 tem goal NARRATIVE (recordar o que aconteceu); as do meio, COMPREHENSION (entender a mensagem); a última, APPLICATION (uma situação concreta da vida da criança que nasce do ensino central desta lição — por exemplo, numa lição sobre ouvir a Palavra de Deus, o que fazer quando é hora de ler a Bíblia ou ouvir o professor —, nunca uma situação moral genérica sem ligação com a história). Cubra todos os relatos da lição sem misturá-los. Cada questão usa uma mecânica diferente.
EXERCÍCIOS NO ESTILO DAS FOLHAS (escolha os que servem à história)
- MULTIPLE_CHOICE: circular ou marcar a alternativa correta, com alternativas curtas e plausíveis ("nenhuma / bata rasgada / camisa"; "( ) Cafarnaum ( ) Caná da Galileia ( ) Jerusalém"; "(A) ... (B) ... (C) ...").
- FILL_BLANK: completar frases com lacunas (______) usando um banco de palavras ou uma legenda de símbolos (ex.: ☐ = COMPAIXÃO, ✚ = MESSIAS) ou escolhendo entre duas palavras entre parênteses ("(coragem / medo)").
- TRUE_FALSE: marcar certo ou errado em frases sobre a história ou sobre atitudes que agradam a Deus.
- WORD_SEARCH: caça-palavras com 6 a 8 palavras importantes da história. Você só escolhe as palavras; o servidor desenha a grade.
- CROSSWORD: cruzadinha com 4 a 6 pistas sobre a história. Você escreve as pistas e as respostas; o servidor desenha a grade.
- CODE: decifrar uma frase trocando números ou símbolos por letras, com a tabela de correspondência completa no supportText.
- MAZE: labirinto ilustrado ligando um personagem ao destino, com uma pergunta ligada a ele.
- SEQUENCE: ordenar os acontecimentos da história, escritos em frases.
- MATCHING, INITIALS, SPOT_ERRORS, SHORT_ANSWER ou OTHER quando fizerem mais sentido.
- PELO MENOS UMA questão da folha é um passatempo das folhas impressas: caça-palavras com as palavras destacadas do texto, cruzadinha, código para decifrar (números ou símbolos por letras), labirinto de letras que revela um nome, completar frases com legenda de símbolos ou iniciais das figuras. A folha nunca é só de marcar alternativas e escrever respostas.
- Perguntas exigem entender a história, nunca adivinhar por eliminação de respostas absurdas.
QUESTÕES COMPLETAS
- Cada subitem tem prompt, options e answer. Options é vazio quando não houver seleção; em seleção, copie a alternativa correta literalmente em answer. Nunca escreva a resposta junto do enunciado.
- Cada questão tem de 1 a 6 subitens, conforme o exercício. Um exercício composto (associação, sequência, código) pode ser um único subitem.
- supportText traz banco, legenda ou tabela de código completos, uma única vez. SEQUENCE declara sequenceEvents (story, text e order 1..N por relato, até oito no total; use exatamente o mesmo nome de story em todos os acontecimentos do mesmo relato e nunca repita um número de order no mesmo relato); o servidor embaralha e numera — não repita os acontecimentos em supportText.
- CAÇA-PALAVRAS (WORD_SEARCH): o command cita "caça-palavras"; supportText é SOMENTE a linha "Palavras: PALAVRA1, PALAVRA2, ..." com 6 a 8 palavras simples da lição (uma palavra cada, sem espaços, 3 a 10 letras); um único subitem. NÃO escreva a grade de letras: o servidor desenha.
- CRUZADINHA (CROSSWORD): o command cita "cruzadinha"; supportText vazio; de 4 a 6 subitens, cada um com prompt = a pista ("O nome do mendigo.") e answer = UMA palavra sem espaços (2 a 12 letras), todas diferentes e com letras em comum entre si. NÃO desenhe a grade: o servidor monta e numera as pistas na ordem dos subitens.
- CÓDIGO (CODE): supportText traz na primeira linha a tabela completa ("1 = E | 2 = A | 3 = I | 4 = O | 5 = U" ou um número para cada letra usada) e, na linha seguinte, a frase cifrada, com as palavras separadas por dois espaços; um único subitem com a frase decifrada em answer. Confira letra por letra.
- CERTO OU ERRADO (TRUE_FALSE): cada subitem é uma frase, com options exatamente ["Certo", "Errado"].
IMAGENS (printableAssets)
- UMA ÚNICA imagem na folha inteira (printableAssets com exatamente um item): uma cena da história ao lado do texto de uma questão, com os personagens e o acontecimento daquele trecho. É um desenho só, de cena única: nunca peça quadros, painéis, tirinha, várias cenas ou miniaturas, nem em questões de SEQUENCE (a sequência é ordenada pelas frases). Caça-palavras, cruzadinha e código NUNCA têm imagem.
- visualRequired é true na questão que tem imagem e false nas demais. Cada imagem tem id igual ao número da sua questão ("1" a "4"), só uma questão tem imagem.
- prompt da imagem: descreva somente UMA CENA (quem aparece, onde, fazendo o quê), em desenho de contorno preto e branco para colorir. Nunca peça letras, palavras, números, alternativas, lacunas ou "marcas de resposta" na imagem, e não descreva crianças fazendo a atividade.
ANTES DE ENTREGAR
- Resolva todos os exercícios e confira cada gabarito com a lição. Confira se são 3 ou 4 questões e se elas enchem a página inteira, se a linguagem é de criança de 8 a 12 anos e se a última questão leva a uma atitude concreta. Não use Markdown.`;
