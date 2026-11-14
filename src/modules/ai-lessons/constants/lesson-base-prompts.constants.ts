import { LessonStageType } from '../enums/lesson.enums';
import { LESSON_BASE_PROMPT } from './lesson-editorial.constants';
import { YOUNGER_MEDITATION_BASE_PROMPT } from './meditation-prompts.constants';
import { OLDER_MEDITATION_BASE_PROMPT } from './older-meditation-prompt.constants';

/** Immutable base prompt of each regular stage; administrators only append to it. */
export const LESSON_STAGE_BASE_PROMPTS: Record<LessonStageType, string> = {
  [LessonStageType.LESSON]: LESSON_BASE_PROMPT,
  [LessonStageType.LESSON_VISUALS]: `Produza somente os VISUAIS DA HISTÓRIA da lição aprovada no formato KIT DE RECORTES do Clubinho Bíblico NIB. Estes visuais auxiliam o professor a contar a narrativa e são diferentes dos visuais de fixação do versículo, que pertencem a outra etapa.

OBJETIVO
- Entregue pranchas de elementos isolados em fundo branco, que o professor recorta e monta enquanto conta a história. Não gere cenas completas nem cartazes de cena.
- Faça primeiro o inventário da LIÇÃO BÍBLICA aprovada: personagens, animais, construções, cenário, céu e natureza e objetos. Todo elemento relevante da narrativa precisa existir no kit.
- As peças destinam-se a crianças de 5 a 11 anos e devem permanecer apropriadas para essa idade, sem sexualização, romance, violência gráfica ou elementos assustadores desnecessários.

CONFIGURAÇÃO ESCOLHIDA PELO ADMINISTRADOR
- Respeite exatamente a quantidade de 4 a 10 pranchas e a orientação recebidas em visualConfig. Não escolha valores diferentes.
- Use ids sequenciais kit-01, kit-02 e assim por diante. Cada prancha declara categoria, título, itens, layoutPlan, prompt e altText.
- O conjunto básico entra em qualquer quantidade; pranchas adicionais reorganizam categorias e acrescentam variantes e peças extras, nunca substituem o básico.

ITENS E COBERTURA
- Cada item declara label, description, category, size, storyEvidence, variantOf e extra. storyEvidence é o trecho literal da lição que justifica o item; fica vazio apenas em itens neutros de céu e natureza ou em itens marcados como extra.
- Elementos que mudam de estado ou pose na história recebem uma variante cada, vinculada por variantOf.
- Preencha coverageChecklist com as seis categorias, marcando COVERED ou NOT_APPLICABLE com justificativa.
- Não crie elementos sem apoio na lição, salvo os neutros de céu e natureza.

CONTINUIDADE VISUAL
- Crie antes uma ficha mental consistente para cada personagem: faixa etária, pele, cabelo, roupa, cores, acessórios e expressão típica.
- Preserve esses atributos em todas as pranchas. Não troque roupa, idade, etnia ou traço sem motivo narrativo.
- Preserve época e ambiente bíblicos. Evite objetos modernos, arquitetura incompatível, estereótipos e símbolos religiosos anacrônicos.
- Siga o ESTILO DE DESENHO escolhido pelo administrador, descrito no prompt de sistema, sempre com contornos nítidos e contraste suficiente para impressão e recorte.

REGRAS DE ARTE
- Nunca coloque palavras, versículos, legendas, balões, números, marcas, molduras ou logotipos dentro da imagem gerada; as legendas são aplicadas depois pelo sistema.
- Cada elemento tem linha de corte: contorno externo preto, grosso e contínuo em volta de toda a silhueta, para recortar com tesoura.
- Elementos grandes e bem separados, com margem para recorte e longe das bordas. Nunca encolha um elemento para caber: reorganize as pranchas e descreva o tamanho relativo em layoutPlan.
- Não represente Deus Pai fisicamente. Trate cenas sensíveis com reverência e adequação infantil.
- Não altere fatos, diálogos ou ênfase teológica já aprovados na lição.
- A lição aprovada é a única fonte narrativa. Use somente seus personagens, ambientes, ações e objetos; não preencha lacunas criativamente nem repense a história.
- Não crie cartões, palavras, símbolos mnemônicos ou imagens para o versículo nesta etapa.`,
  [LessonStageType.STANDARD_GAME]: `Produza somente a BRINCADEIRA DIVERTIDA da semana, seguindo o padrão dos materiais manuais do Clubinho Bíblico NIB.

O QUE É A BRINCADEIRA DIVERTIDA
- É o momento de recreação do Clubinho: gincana, desafio, correria e risada. As crianças têm de sair suadas, rindo e pedindo "de novo!". Pense em festa junina, gincana de escola e brincadeira de quintal — não em aula.
- Inspire-se no repertório clássico de recreação infantil e crie uma versão própria ou adapte um clássico: estoura balão no pé, pescaria, tiro ao alvo com bolinha, cabo de guerra, pênalti, corrida do saco, ovo na colher, boliche de garrafa PET, batata quente, caça ao tesouro, corrida de revezamento, morto-vivo, coelhinho sai da toca, circuito de obstáculos, transporte de água com copo furado, bexiga entre as costas.
- A mecânica principal é FÍSICA e DE AÇÃO: correr, pular, mirar, arremessar, equilibrar, puxar, buscar, estourar, encher, derrubar. Desafios com tempo, contagem regressiva, surpresa e reviravolta são bem-vindos.
- Equipes e competição saudável são bem-vindas: placar, rodadas, vencedor e prêmio simbólico (salva de palmas, medalha de papel). No fim, todos comemoram juntos.
- A ligação com a lição é LEVE: aparece no nome, no tema/enfeite (ex.: "pescadores de homens" numa pescaria, "muralhas de Jericó" num boliche de garrafas) e numa frase curta no PRINCÍPIO BÍBLICO depois de brincar. A mecânica não precisa ensinar o conteúdo.
- Regra central explicável em até 1 minuto. Todas as crianças jogam ao mesmo tempo ou em rodadas rápidas; ninguém fica parado assistindo por muito tempo. Se alguém sair numa rodada, volta na seguinte ou vira juiz/torcida.
- Planeje para crianças de 5 a 11 anos juntas, com uma simplificação concreta para 5 a 7 anos e um desafio extra para 8 a 11 anos.
- Nome curto, alegre e com cara de gincana. Linguagem oral e comandos curtos e animados.
- Materiais baratos e fáceis: balões, bolas, corda, baldes, copos plásticos, garrafas PET, fita crepe, jornal, colheres, sacos, cones improvisados.

ESTRUTURA OBRIGATÓRIA — DOCUMENTO CURTO, QUE CABE EM UMA PÁGINA A4
O professor lê em 1 minuto e já sai brincando. Frases curtas, sem repetir a mesma informação em duas seções, sem explicações longas.
1. NOME: até 5 palavras, com cara de gincana.
2. OBJETIVO: uma frase.
3. MECÂNICAS DIVERTIDAS: 2 ou 3 itens de até 6 palavras.
4. MATERIAIS: até 6 itens curtos, com quantidade.
5. PREPARAÇÃO: no máximo 2 frases.
6. COMO BRINCAR: de 3 a 6 passos, cada um uma frase de comando.
7. REGRAS E SEGURANÇA: até 4 regras curtas, incluindo a duração (10 a 15 minutos) e como se vence.
8. ADAPTAÇÕES POR IDADE: uma frase para 5 a 7 anos e uma para 8 a 11 anos.
9. PRINCÍPIO BÍBLICO: até 2 frases curtas para o professor dizer depois de brincar.
10. VISUAL DE APOIO: crie UMA única imagem-resumo que compile toda a brincadeira — materiais, preparação do espaço, a sequência do passo a passo em painéis na ordem de leitura e o encerramento —, para o professor entender a dinâmica de relance. Mostre crianças genéricas e alegres fazendo cada ação, em clima de festa e gincana. Não crie uma imagem por passo, nem cenas da história bíblica; não gere imagem meramente decorativa nem um infográfico só de objetos.

REGRAS
- PROIBIDO como mecânica principal: desenhar, colorir, fazer gestos ou mímica parados, apontar para cartazes, responder perguntas, quiz, reflexão, ouvir explicação, encenar a história, atividade de mesa ou "andar tranquilamente". Se a brincadeira couber dentro de uma sala de aula sentada, ela está errada.
- Segurança básica: espaço livre de obstáculos, nada cortante, sem alimento sem alerta de alergia, sem venda nos olhos sem assistência, puxões e corridas só em piso seguro e sem empurrar.
- Não dependa de leitura quando houver crianças pequenas.
- A vitória de uma equipe nunca é apresentada como sinal de maior fé ou favor de Deus.
- A imagem-resumo é um infográfico vertical (retrato, A4), colorido e alegre, com o título da brincadeira, as faixas MATERIAIS, PREPARAÇÃO e COMO BRINCAR, os passos numerados com títulos curtos e o encerramento escritos em português correto.`,
  [LessonStageType.VERSE_VISUALS]: `Produza somente os VISUAIS DO VERSÍCULO PRINCIPAL, como uma sequência mnemônica imprimível. Esta etapa não é uma brincadeira e não é a dinâmica de fixação.

FONTE FECHADA
- Use exclusivamente o versículo principal aprovado na lição: texto integral, referência e versão NVI. Não escolha outro texto, não parafraseie e não acrescente palavras.
- Receba e considere juntos o texto completo do versículo e sua referência completa antes de decidir a sequência.
- Analise a estrutura do versículo e divida-o na melhor sequência de unidades de sentido para crianças de 5 a 11 anos. Cada trecho precisa ser curto o bastante para memorizar, mas completo o bastante para fazer sentido.
- Os trechos, lidos em ordem, devem reconstruir exatamente o texto integral, sem lacunas, repetições ou troca de ordem.

SEQUÊNCIA VISUAL OBRIGATÓRIA
- Crie um cartão tipográfico para cada trecho. A quantidade não é informada pelo administrador: derive-a da quebra semântica mais pedagógica, entre uma e nove imagens de conteúdo.
- Depois de decidir a quantidade de trechos, acrescente sempre uma última imagem exclusiva para a referência bíblica. Nessa última peça, displayText e a imagem devem conter somente a referência completa; nunca misture referência e texto do versículo.
- Informe a justificativa pedagógica da quebra e, em cada item, a ordem, o trecho exato, a finalidade, o conceito visual e o texto alternativo.
- O texto exato do trecho é o protagonista absoluto e deve ser gerado dentro da própria imagem, ocupando aproximadamente 90% da composição final; os outros 10% são de pequenos detalhes ligados ao sentido do trecho.

ARTE E IMPRESSÃO
- Fundo infantil vibrante, escolhido a partir do sentido do versículo (não use azul com nuvens por padrão), simples e com bom contraste, indo até as bordas: sem moldura, margem ou contorno branco.
- Defina uma única paleta de no máximo três cores para toda a sequência. Texto, fundo, contornos, sombras e detalhes devem usar somente essas três cores, permitindo apenas variações de luminosidade e saturação. Não escolha uma cor diferente para cada letra e não altere a paleta entre cartões.
- Não inclua pessoas, personagens, cenas, paisagens completas ou cenas bíblicas. Em cada cartão, primeiro o texto ocupa cerca de 90% da imagem; depois, só nas sobras (cantos, bordas e vãos entre as linhas), entram desenhos minúsculos e variados, em quantidade decidida pelo espaço livre, pelo estilo e pelo sentido do trecho (sem número fixo), que remetem ao sentido do trecho (ex.: ouvido para "ouvir", pergaminho para "Moisés e os Profetas") e pequenos brilhos da mesma paleta, somando no máximo 10% da imagem, sem tocar nas letras. Nunca diminua o texto para caber detalhes.
- Gere dentro da imagem somente o trecho exato ou a referência exata solicitada, em tipografia infantil extragrande e arredondada, limitada à mesma paleta de três cores, com contorno e sombra suaves numa cor da paleta (nunca branco). Não acrescente nenhuma outra letra, palavra, número, moldura pesada ou logotipo.
- Preserve adequação para crianças de 5 a 11 anos e fidelidade bíblica NVI. Não inclua sexualização, romance, violência gráfica ou elementos assustadores.`,
  [LessonStageType.VERSE_FIXATION]: `Produza somente a BRINCADEIRA DIVERTIDA DE FIXAÇÃO DO VERSÍCULO da semana, seguindo o padrão dos materiais manuais do Clubinho Bíblico NIB. Esta etapa é diferente dos Visuais do Versículo já produzidos.

O QUE É A FIXAÇÃO DIVERTIDA
- É uma gincana/recreação de verdade cujo prêmio é o versículo na cabeça: as crianças correm, pulam, buscam, arremessam e montam, e cada rodada as faz FALAR, MONTAR ou RECUPERAR o versículo. Elas têm de sair rindo e sabendo o versículo de cor.
- Use o único versículo principal aprovado na lição. Preserve exatamente o texto, a referência e a versão NVI; não escolha outro, não parafraseie, não complete nem reduza.
- Inspire-se em mecânicas clássicas adaptadas ao versículo: caça às palavras escondidas, revezamento que monta o versículo em ordem, estoura balão com um trecho dentro, pescaria de palavras, batata quente que para em quem completa o trecho, eco que vai sumindo palavras a cada rodada, corrida até o trecho certo, varal do versículo.
- Repetição progressiva e divertida: primeiro todos repetem juntos, depois partes vão sumindo e as crianças completam, até recitarem o versículo inteiro sem apoio.
- Equipes, rodadas, tempo e placar são bem-vindos; todos comemoram no fim e terminam recitando juntos o versículo completo com a referência.
- Funciona com crianças que ainda não leem: use fala, gestos, cores e ajuda do grupo.
- Planeje para 5 a 11 anos juntas, com uma simplificação para 5 a 7 e um desafio extra para 8 a 11 anos.
- Materiais baratos: papel, fita crepe, balões, copos, bola, barbante, prendedores.

ESTRUTURA OBRIGATÓRIA — DOCUMENTO CURTO, QUE CABE EM UMA PÁGINA A4
O professor lê em 1 minuto e já sai brincando. Frases curtas, sem repetir a mesma informação em duas seções.
1. NOME: até 5 palavras, com cara de gincana.
2. OBJETIVO: uma frase.
3. MECÂNICAS DIVERTIDAS: 2 ou 3 itens de até 6 palavras.
4. MATERIAIS: até 6 itens curtos, com quantidade.
5. PREPARAÇÃO: no máximo 2 frases.
6. COMO BRINCAR: de 3 a 6 passos, cada um uma frase de comando, terminando com a recitação coletiva.
7. REGRAS E SEGURANÇA: até 4 regras curtas, incluindo a duração (10 a 15 minutos) e como se vence.
8. ADAPTAÇÕES POR IDADE: uma frase para 5 a 7 anos e uma para 8 a 11 anos.
9. COMO AVALIAR: uma frase (ex.: cada equipe recita sem ajuda).
10. PRINCÍPIO BÍBLICO: até 2 frases curtas sobre o sentido do versículo.
11. VISUAL DE APOIO: crie UMA única imagem-resumo que compile toda a brincadeira — o versículo em destaque, materiais, preparação, a sequência do passo a passo em painéis na ordem de leitura e o encerramento —, com crianças genéricas e alegres fazendo cada ação. Não crie uma imagem por passo, nem cenas da história bíblica, nem um infográfico só de objetos.

REGRAS
- PROIBIDO como mecânica principal: desenhar, colorir, ficar sentado repetindo, quiz de perguntas, cartaz parado ou ouvir explicação. Se a brincadeira couber dentro de uma sala com as crianças sentadas, ela está errada.
- Segurança básica: espaço livre de obstáculos, nada cortante, sem alimento sem alerta de alergia, sem venda nos olhos sem assistência, corridas só em piso seguro e sem empurrar; ninguém é exposto ou constrangido ao recitar.
- A imagem-resumo é um infográfico vertical (retrato, A4), colorido e alegre, com o título da brincadeira, o versículo e a referência exatamente como aprovados, as faixas MATERIAIS, PREPARAÇÃO e COMO BRINCAR, os passos numerados com títulos curtos e o encerramento escritos em português correto.`,
  [LessonStageType.MEDITATION_YOUNGER]: YOUNGER_MEDITATION_BASE_PROMPT,
  [LessonStageType.MEDITATION_OLDER]: OLDER_MEDITATION_BASE_PROMPT,
  [LessonStageType.MANUAL_WORK]: `Produza somente o TRABALHO MANUAL PARA COLORIR, conforme a folha manual da Semana 26 do Clubinho Bíblico NIB.

CONTRATO
- Use o único versículo principal NVI aprovado na lição, preservando texto completo e referência sem paráfrase.
- Escolha uma cena ou símbolo concreto, imediatamente reconhecível e fiel à passagem, que ajude a criança a recordar o sentido do versículo.
- Forneça título “TRABALHO MANUAL”, instrução curta e uma única arte principal. A saída final terá duas cópias idênticas na mesma folha A4 retrato, separadas para recorte.

PROMPT DA ARTE
- Line art infantil preto e branco puro para colorir, fundo totalmente branco, traço preto grosso, contínuo e nítido, formas grandes, áreas internas amplas, poucos detalhes pequenos e alto contraste.
- Sem cor, cinza, sombras, hachuras pesadas, textura, fotografia, realismo perturbador, borda cortada ou elementos encostados na margem.
- Não gerar texto, letras, versículo, referência, título, marca ou logotipo dentro da imagem; o renderer aplicará o texto NVI e os cabeçalhos oficiais.
- Composição horizontal dentro de cada meia folha A4 retrato e adequada a crianças de 5 a 11 anos.
- Preserve época, personagens e fatos bíblicos; não represente Deus Pai fisicamente e trate morte, cruz e sofrimento com reverência e sem violência gráfica.`,
};

export const ADMIN_PROMPT_CONFLICT = {
  save: 'O prompt foi alterado em outra sessão. Recarregue antes de salvar.',
  reset:
    'O prompt foi alterado em outra sessão. Recarregue antes de redefinir.',
} as const;

/** Base prompt of the story visuals when a weekly lesson chooses complete scenes instead of the kit. */
export const REGULAR_SCENE_VISUALS_BASE_PROMPT = `Produza somente os VISUAIS DA HISTÓRIA da lição aprovada como CENAS COMPLETAS do Clubinho Bíblico NIB. Estes visuais auxiliam o professor a contar a narrativa e são diferentes dos visuais de fixação do versículo.

OBJETIVO
- Entregue uma ilustração completa por trecho da LIÇÃO BÍBLICA aprovada: ambiente, personagens e a ação principal daquele momento, com enquadramento claro para o professor mostrar à distância. Não gere pranchas de recorte nem elementos soltos.
- As cenas destinam-se a crianças de 5 a 11 anos e devem permanecer apropriadas para essa idade, sem sexualização, romance, violência gráfica ou elementos assustadores desnecessários.

CONFIGURAÇÃO ESCOLHIDA PELO ADMINISTRADOR
- Respeite exatamente a quantidade de 4 a 10 cenas e a orientação recebidas em visualConfig. Não escolha valores diferentes.
- Use ids sequenciais visual-01, visual-02 e assim por diante.
- Divida toda a LIÇÃO BÍBLICA em trechos literais, contínuos, consecutivos e sem sobreposição, um por cena, em sourceExcerpt. Juntos, os trechos reproduzem a história inteira, sem omitir, repetir ou reescrever nada.
- Escolha os cortes nos momentos que mudam a cena (lugar, personagem ou ação principal), para cada imagem mostrar um acontecimento diferente.

CONTINUIDADE VISUAL
- Crie antes uma ficha consistente para cada personagem: faixa etária, pele, cabelo, roupa, cores, acessórios e expressão típica, e preserve-a em todas as cenas.
- Preserve época e ambiente bíblicos. Evite objetos modernos, arquitetura incompatível, estereótipos e símbolos religiosos anacrônicos.
- Siga o ESTILO DE DESENHO escolhido pelo administrador, descrito no prompt de sistema, com contraste suficiente para impressão.

REGRAS DE ARTE
- Nunca coloque palavras, versículos, legendas, balões, números, marcas, molduras ou logotipos dentro da imagem.
- Ilustre somente o que o trecho narra; orientações ao professor entre parênteses e perguntas às crianças não são cena.
- Não represente Deus Pai fisicamente. Trate cenas sensíveis com reverência e adequação infantil, sem detalhes assustadores.
- A lição aprovada é a única fonte narrativa: não altere fatos, diálogos ou ênfase teológica nem preencha lacunas criativamente.`;
