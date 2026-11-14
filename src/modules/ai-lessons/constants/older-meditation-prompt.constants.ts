/**
 * Prompt base da etapa 7 (meditação das crianças maiores, 8 a 12 anos).
 *
 * Descreve o estilo das folhas feitas à mão pela equipe: cabeçalho fixo
 * (montado pelo servidor), de 2 a 4 questões numeradas, cada uma começando
 * com um parágrafo curto da história e terminando num comando claro, e a
 * oração "Falando com Deus" fechando a página. A quantidade de questões
 * depende do tamanho dos exercícios: a página A4 é sempre aproveitada inteira.
 */
export const OLDER_MEDITATION_BASE_PROMPT = `Produza a MEDITAÇÃO PARA CRIANÇAS MAIORES (8 a 12 anos): uma única página A4, baseada exclusivamente no tema e na lição aprovada, no mesmo estilo das folhas impressas do Clubinho Bíblico. As regras valem para qualquer relato bíblico.
CABEÇALHO (o servidor desenha a faixa, o logo, "Nome/Data", o quadro "Versículo para decorar" e o "Falando com Deus")
- title: o tema em poucas palavras, como "O poder de Jesus sobre as doenças".
- biblicalText: o NOME dos relatos estudados, separados por " / ", nunca a referência bíblica, sem números e sem parênteses (ex.: "A cura de um cego de nascença / A cura de um paralítico"; "O rico e Lázaro"). É impresso entre parênteses abaixo do título.
- verseText e verseReference: o único versículo aprovado, em NVI.
- introduction: deixe vazio (""). O contexto da história entra dentro de cada questão, como nas folhas impressas. Só escreva uma frase (até 25 palavras) se a lição exigir uma explicação que não caiba em nenhuma questão.
- prayer: uma oração curta, em primeira pessoa, ligada à aplicação (ex.: "Senhor Jesus, obrigado por cuidar de mim. Ajuda-me a confiar sempre em Ti!").
QUANTIDADE DE QUESTÕES E ESPAÇO
- De 2 a 4 questões (activities), numeradas 1, 2, 3, 4. Decida pela soma do tamanho dos exercícios, para preencher a página inteira sem sobrar nem faltar espaço:
  • 2 questões quando os exercícios são grandes (cruzadinha, caça-palavras com grade, labirinto ilustrado, código longo para decifrar) ou têm vários subitens;
  • 3 questões no caso comum (um exercício grande e dois médios);
  • 4 questões quando os exercícios são curtos (marcar alternativas, completar poucas frases, verdadeiro ou falso).
- Nunca encha a página com texto artificial nem corte um exercício para caber: ajuste a quantidade de questões e de subitens.
- A página deve ficar cheia como nas folhas impressas, sem grandes espaços em branco. Prefira 4 questões; use 3 só quando uma delas for um exercício grande (caça-palavras, cruzadinha, labirinto ilustrado) e 2 só quando houver dois exercícios grandes.
FORMATO DE CADA QUESTÃO (como "1. Quando Jesus desceu do monte, ... Resolva o labirinto e descubra o nome da região.")
- context: 1 a 3 frases curtas que recontam o trecho da história daquela questão, em linguagem de criança de 8 a 12 anos, com fatos da lição. Pode trazer um ensino simples ("O pecado nos afasta de Deus..."). Até 35 palavras.
- command: o que a criança deve fazer, direto e completo ("Circule a alternativa correta.", "Complete as frases de acordo com a legenda.", "Encontre no caça-palavras as palavras destacadas no texto."). Até 30 palavras.
- supportText: dados de que o exercício precisa, impressos uma única vez (legenda, banco de palavras, tabela de código, grade, lista de palavras).
- subitems: as perguntas, lacunas ou frases do exercício, com gabarito interno (a solução completa: resposta de cada subitem, caminho do labirinto ou ordem da sequência).
- PROGRESSÃO: a questão 1 tem goal NARRATIVE (recordar o que aconteceu); as do meio, COMPREHENSION (entender a mensagem); a última, APPLICATION (uma situação concreta da vida da criança que nasce do ensino central desta lição — por exemplo, numa lição sobre ouvir a Palavra de Deus, o que fazer quando é hora de ler a Bíblia ou ouvir o professor —, nunca uma situação moral genérica sem ligação com a história) — com 2 questões, NARRATIVE e depois COMPREHENSION ou APPLICATION. Cubra todos os relatos da lição sem misturá-los. Cada questão usa uma mecânica diferente.
EXERCÍCIOS NO ESTILO DAS FOLHAS (escolha os que servem à história)
- MULTIPLE_CHOICE: circular ou marcar a alternativa correta, com alternativas curtas e plausíveis ("nenhuma / bata rasgada / camisa"; "( ) Cafarnaum ( ) Caná da Galileia ( ) Jerusalém"; "(A) ... (B) ... (C) ...").
- FILL_BLANK: completar frases com lacunas (______) usando um banco de palavras ou uma legenda de símbolos (ex.: ☐ = COMPAIXÃO, ✚ = MESSIAS) ou escolhendo entre duas palavras entre parênteses ("(coragem / medo)").
- TRUE_FALSE: marcar certo ou errado em frases sobre a história ou sobre atitudes que agradam a Deus.
- WORD_SEARCH: encontrar as palavras destacadas do texto numa grade de letras.
- CROSSWORD: cruzadinha com pistas numeradas sobre a história.
- CODE: decifrar uma frase trocando números ou símbolos por letras, com a tabela de correspondência completa no supportText.
- MAZE: labirinto ilustrado ligando um personagem ao destino, com uma pergunta ligada a ele.
- SEQUENCE: ordenar acontecimentos ou cenas da história.
- MATCHING, INITIALS, SPOT_ERRORS, SHORT_ANSWER ou OTHER quando fizerem mais sentido.
- PELO MENOS UMA questão da folha é um passatempo das folhas impressas: caça-palavras com as palavras destacadas do texto, cruzadinha, código para decifrar (números ou símbolos por letras), labirinto de letras que revela um nome, completar frases com legenda de símbolos ou iniciais das figuras. A folha nunca é só de marcar alternativas e escrever respostas.
- Perguntas exigem entender a história, nunca adivinhar por eliminação de respostas absurdas.
QUESTÕES COMPLETAS
- Cada subitem tem prompt, options e answer. Options é vazio quando não houver seleção; em seleção, copie a alternativa correta literalmente em answer. Nunca escreva a resposta junto do enunciado.
- Cada questão tem de 1 a 6 subitens, conforme o exercício. Um exercício composto (associação, sequência, código) pode ser um único subitem.
- supportText traz banco, legenda, tabela de código, pistas ou grade completos, uma única vez. SEQUENCE declara sequenceEvents (story, text e order 1..N por relato, até oito no total; use exatamente o mesmo nome de story em todos os acontecimentos do mesmo relato e nunca repita um número de order no mesmo relato); o servidor embaralha e numera — não repita os acontecimentos em supportText. Caça-palavras: comando "Caça-palavras", lista na linha "Palavras:" e grade retangular de letras MAIÚSCULAS separadas por espaços, com todas as palavras inteiras na grade. Cruzadinha: grade textual (# casa bloqueada, . casa vazia, número de um dígito na casa de início) com cruzamentos consistentes. Código: tabela verificável.
IMAGENS (printableAssets)
- Use imagem só quando a questão precisar ou ganhar com ela: labirinto, cenas para ordenar, personagens a observar, ilustração da cena ao lado do texto. Questões de completar, código, marcar ou caça-palavras podem ficar sem imagem, como nas folhas impressas.
- visualRequired é true na questão que tem imagem e false nas demais. Cada imagem tem id igual ao número da sua questão ("1" a "4"), no máximo uma por questão. Prefira ao menos uma imagem na folha.
- A arte é em preto e branco, de traço limpo para colorir, mostra só os elementos do desafio ou a cena de apoio, sem repetir o enunciado, sem revelar a resposta e sem acrescentar outro jogo.
ANTES DE ENTREGAR
- Resolva todos os exercícios e confira cada gabarito com a lição. Confira se a quantidade de questões aproveita a página inteira, se a linguagem é de criança de 8 a 12 anos e se a última questão leva a uma atitude concreta. Não use Markdown.`;
