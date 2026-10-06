export const YOUNGER_MEDITATION_BASE_PROMPT = `Produza somente a MEDITAÇÃO PARA CRIANÇAS MENORES, seguindo os modelos reais do Clubinho Bíblico NIB: O Semeador, os poderes de Jesus sobre os demônios, as doenças, a natureza e a morte, e a multiplicação dos pães.

PÚBLICO E FOLHA
- Crianças de 4 a 7 anos, inclusive em alfabetização inicial; leitura com apoio do professor. Comandos concretos e desafios visuais simples.
- Exatamente duas atividades complementares, numeradas 1 e 2. O renderer monta duas cópias idênticas na mesma página A4 retrato: logo oficial à esquerda, faixa preta, título, Nome/Data, versículo destacado, duas colunas e oração no rodapé.
- Use o tema, os fatos e o único versículo NVI aprovados na lição. Não copie os temas, versículos ou soluções dos exemplos para outra semana.
- Cada instruction deve reunir uma contextualização bíblica curta e o comando completo da atividade. Use 35 a 75 palavras, no máximo duas ou três pequenas subperguntas, e não repita título, versículo ou cabeçalho.
- As duas questões formam uma sequência do mesmo tema: compreender o acontecimento e reconhecer sua mensagem. Retome personagens, ações e propósito da lição em cada contextualização; não crie passatempo genérico apenas com um personagem bíblico ao lado. A oração conclui essa mesma mensagem.
- Quando houver dois relatos bíblicos na lição, cubra ambos, distribuindo os fatos entre as duas atividades sem misturá-los.

ESTILO DAS ATIVIDADES — NÃO É UMA FOLHA DE COLORIR
- Padrão preferencial: uma atividade de percurso/descoberta e uma de reconhecimento/compreensão ou aplicação, com mecânicas diferentes.
- Varie entre semanas: não torne labirinto obrigatório. Inclua também ordenar cenas, ligar acontecimentos, contar objetos e marcar quantidades, cobrir pontilhados e selecionar imagens, conforme a narrativa.
- Para 4 anos, a tarefa deve ser realizável ouvindo o comando e observando figuras; não exija leitura autônoma, escrita de frases ou cálculo abstrato. Para 6–7 anos, palavras curtas e contagem simples são adequadas, sem tornar alfabetização um pré-requisito.
- Atividade 1: labirinto simples levando um personagem ao destino bíblico correto; percurso de letras que revela um nome/lugar; ou ligar personagem, ação e objeto. O caminho deve ter início e destino identificáveis, corredores largos e uma solução verificável.
- Atividade 2: circular/marcar a alternativa certa; associar fatos; completar uma palavra curta com pistas; escolher e pintar somente a imagem correta entre alternativas; ou revelar uma figura pintando apenas as áreas com pontos. Forneça todas as opções/pistas na própria folha.
- Pintar a alternativa certa é uma atividade de reconhecimento, não um desenho livre para colorir. Desenho livre para colorir é excepcional, nunca o padrão e nunca as duas atividades; use apenas quando solicitado ou quando houver uma finalidade pedagógica concreta.
- Exemplos de mecânica, não de conteúdo obrigatório: levar o semeador à boa terra + descobrir a figura pelas áreas com pontos; seguir letras até o nome de uma região + circular respostas sobre o relato; levar o personagem a Jesus + escolher o local correto da cura entre casa e hospital.
- Não gere duas cenas decorativas para pintar, caça-palavras denso, texto abstrato, tarefa dependente de internet/material externo ou desafio com leitura longa para essa idade.

ELEMENTOS IMPRIMÍVEIS
- De uma a duas artes funcionais, no máximo uma por atividade. A primeira atividade deve ter apoio visual executável. A segunda pode ser apenas texto com alternativas: nesse caso, não gere uma ilustração decorativa.
- printableAssets.id deve ser literalmente "1" ou "2", correspondente ao número da atividade. Não associe uma arte ao desafio errado e não repita ids.
- Use traço limpo, fundo branco, poucos elementos e boa legibilidade dentro de uma coluna de meia folha A4. Personagens e ambientes são apoio contextual, não substituem o desafio.
- O prompt de cada arte deve especificar início, destino, trajetos, símbolos, letras ou alternativas indispensáveis e a composição completa. Letras, números, nomes curtos e rótulos são permitidos quando necessários para resolver a atividade e devem estar em português, legíveis e sem erros.
- Labirinto: descreva o percurso correto no gabarito, assegure saída alcançável e não marque o caminho solucionado na arte. Letras em percurso: o caminho correto precisa formar exatamente a resposta. Associação: inclua todos os elementos dos dois grupos. Áreas com pontos: defina as regiões marcadas e a figura revelada. Escolha visual: todas as alternativas precisam estar presentes e distinguíveis.
- Não desenhe cabeçalho, logo, instrução completa, versículo, oração, número externo da atividade ou gabarito na arte; o renderer cuida desses elementos.

GABARITO, ORAÇÃO E CONFERÊNCIA
- answer é interno para o professor: dê a solução completa, com caminho/sequência ou a resposta de cada subitem, coerente com os fatos aprovados. Não imprima nem destaque a alternativa correta no material infantil.
- prayer: uma frase curta iniciada por "Jesus," ou "Senhor," ligada à aplicação da lição.
- Antes de devolver o JSON, confira: exatamente duas atividades diferentes; desafios completos e solucionáveis; imagens associadas aos ids corretos; todas as pistas/alternativas necessárias; resposta determinística; versículo preservado; ausência de conteúdo assustador; textos e artes que cabem na folha duplicada. Corrija qualquer incoerência antes de responder.`;

export const OLDER_MEDITATION_BASE_PROMPT = `Produza somente a MEDITAÇÃO PARA CRIANÇAS MAIORES, conforme as folhas do Clubinho Bíblico NIB para crianças de 8 a 11 anos.
- Uma única página A4 retrato inteira, sem duplicação e sem atividades de desenho livre para colorir. O renderer aplica logo, faixa preta, título, Nome/Data, versículo destacado, texto bíblico, "Entendendo a lição", desafios e oração no rodapé.
- Preserve o tema, os relatos e o único versículo principal NVI aprovados, sem copiar fatos ou versículos de outra semana.
- Interligue as questões pelo tema e pelo propósito aprovados: parta dos fatos da narrativa, avance para compreensão e conclua com aplicação concreta à vida da criança. Cada enigma deve revelar uma palavra, fato ou mensagem relevante dessa lição; evite jogos genéricos com decoração bíblica. Introduction e prayer devem reforçar o mesmo fio condutor.
- Leitores de 8 a 11 anos: vocabulário claro, frases curtas, inferências simples e escrita breve; dificuldade moderada, sem exigir conhecimento externo ou linguagem de adulto.
- Crie exatamente três desafios variados que cubram narrativa, compreensão e aplicação. Quando houver mais de um relato, cubra todos sem misturar seus detalhes.
- Use os estilos dos modelos: labirinto/percurso de letras; alternativas certas; completar frases com banco de palavras ou legenda de símbolos; associação; sequência; caça-palavras simples; código/sequência de letras; ou encontre os erros. Não repita a mesma mecânica nos três desafios.
- Inclua também cruzadinhas com pistas e grade compatível com todas as respostas, certo/errado, ordenar cenas e descobrir palavras pelas iniciais das figuras, como nos novos exemplos. Pintar ou circular apenas a alternativa correta é válido como seleção de resposta; pintar livremente uma cena não é o objetivo.
- Respeite o espaço de uma página: introduction de 20–45 palavras; cada instruction de 50–130 palavras incluindo pistas e alternativas; no máximo 450 palavras no corpo completo. Reserve espaço para a grade/arte e para respostas curtas. Não reduza um desafio a instrução vaga para caber: simplifique sua mecânica e preserve todos os dados.
- Cada instruction deve conter contextualização breve, comando, alternativas, legenda, palavras ou pistas necessárias e espaço indicado para resposta. O gabarito interno deve trazer todas as soluções e subitens. Não dependa de conhecimento externo à lição.
- printableAssets pode conter zero a três imagens, somente quando indispensáveis ao enigma, nunca desenhos para colorir ou artes decorativas. Os ids devem ser literalmente "1", "2" ou "3", correspondentes ao desafio. Questões textuais, legendas e alternativas podem estar na própria instruction sem imagem.
- Conferência específica: cruzadinha tem números, pistas, comprimentos e cruzamentos consistentes; caça-palavras tem grade e lista completa, com posições de cada palavra no gabarito; iniciais de figuras usam nomes inequívocos em português e formam exatamente a resposta; certo/errado tem resposta por afirmação; ordenar cenas fornece todos os acontecimentos em ordem embaralhada. Não entregue apenas a descrição do jogo: entregue todos os dados para executá-lo.
- Imagem de enigma: inclua o desafio completo e solucionável. Labirinto tem entrada/saída alcançáveis; caça-palavras contém exatamente as palavras pedidas; código tem legenda completa e decodifica a solução; encontre erros tem a quantidade exata de diferenças significativas entre duas cenas. Letras/números curtos são permitidos quando necessários ao enigma, legíveis e em português.
- Não imprima gabarito nem marque respostas. Não inclua cabeçalho, logo, instrução completa, versículo ou oração na arte. Use fundo claro e composição legível em A4.
- Inclua introduction curta para "Entendendo a lição" e prayer de uma frase ligada à aplicação.
- Revise fidelidade bíblica, legenda/pistas, solução determinística, correspondência de cada arte e espaço de impressão antes de devolver o JSON.`;
