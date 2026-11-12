import { LessonStageType } from '../enums/lesson.enums';
import { LESSON_BASE_PROMPT } from './lesson-editorial.constants';
import {
  OLDER_MEDITATION_BASE_PROMPT,
  YOUNGER_MEDITATION_BASE_PROMPT,
} from './meditation-prompts.constants';

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
  [LessonStageType.STANDARD_GAME]: `Produza somente a BRINCADEIRA NORMAL da semana, seguindo o padrão dos materiais manuais do Clubinho Bíblico NIB.

CONTRATO PEDAGÓGICO
- A brincadeira precisa reforçar o tema e o princípio da lição aprovada; não pode ser apenas uma competição com um versículo colado ao final.
- Crie uma experiência que as crianças realmente queiram brincar, e não uma explicação, encenação passiva, questionário ou tarefa escolar disfarçada de jogo.
- Use uma combinação simples de 2 ou 3 elementos lúdicos adequados ao tema: movimento, missão cooperativa, descoberta, surpresa, faz de conta, imitação, ritmo, construção, busca ou desafio coletivo. Não acumule mecânicas demais.
- Estruture a experiência com início que desperte curiosidade, ação principal dinâmica e final marcante. O professor deve conseguir explicar a regra central em até 1 minuto.
- Mantenha todas as crianças participando na maior parte do tempo. Evite filas demoradas, turnos longos, crianças apenas assistindo e espera superior a aproximadamente 30 segundos.
- Planeje para crianças de 5 a 11 anos juntas. A regra central deve funcionar para todas; inclua uma simplificação concreta para 5 a 7 anos e um desafio adicional opcional para 8 a 11 anos, sem separar ou constranger ninguém.
- Prefira cooperação, escolhas, pequenas conquistas e repetição prazerosa. Se houver pontuação, ela é secundária; ninguém é eliminado e o grupo sempre chega a uma conclusão positiva.
- Dê à brincadeira um nome curto, alegre e convidativo. Use linguagem oral, comandos curtos e ações fáceis de imaginar.
- Priorize materiais baratos, comuns, reutilizáveis e de preparação realista.

ESTRUTURA OBRIGATÓRIA
1. NOME curto e memorável.
2. OBJETIVO pedagógico e objetivo da dinâmica.
3. MATERIAIS com quantidades ou regra de cálculo por criança/equipe.
4. PREPARAÇÃO do espaço e dos materiais antes da chegada das crianças.
5. COMO BRINCAR em passos numerados, sem saltos lógicos.
6. REGRAS, duração total entre 10 e 15 minutos, forma de dividir grupos, critério de encerramento e maneiras de manter todos ativos.
7. SEGURANÇA e adaptação para espaço pequeno, criança tímida ou criança com mobilidade reduzida.
8. ADAPTAÇÕES POR IDADE: simplificação para 5 a 7 anos e desafio opcional para 8 a 11 anos.
9. PRINCÍPIO BÍBLICO: roteiro curto para o professor conectar a experiência à lição depois da atividade, sem transformar a brincadeira em sermão.
10. VISUAIS DE APOIO: crie exatamente uma imagem instrucional para cada passo, na mesma ordem. Cada imagem deve demonstrar visualmente como executar sua instrução; não gere imagens meramente decorativas.

REGRAS
- Não proponha corrida perigosa, contato físico forçado, eliminação humilhante, alimento sem alerta de alergia, venda nos olhos sem assistência ou materiais cortantes para crianças.
- Não dependa de leitura avançada quando puder haver crianças pequenas.
- Não use como mecânica principal apenas ouvir uma explicação, responder perguntas, passar um objeto em sequência ou representar literalmente a história. Transforme o conteúdo em uma ação lúdica com decisões e participação simultânea.
- Se houver equipes, evite que a vitória seja apresentada como sinal de maior fé ou favor de Deus.
- As imagens de apoio devem usar cores claras e suaves, sempre em composição horizontal/paisagem adequada a uma folha A4. Não devem conter texto gerado; palavras, números, cartões e linhas de corte serão compostos pelo renderer para manter ortografia e impressão corretas.`,
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
- O texto exato do trecho é o protagonista absoluto e deve ser gerado dentro da própria imagem, ocupando aproximadamente 95% da composição final.

ARTE E IMPRESSÃO
- Fundo infantil vibrante no padrão visual da Semana 7: azul/ciano luminoso, degradês, raios, nuvens estilizadas, brilhos e pequenas formas apenas nas bordas; centro livre para o texto dominante.
- Defina uma única paleta de no máximo três cores para toda a sequência. Texto, fundo, contornos, sombras e detalhes devem usar somente essas três cores, permitindo apenas variações de luminosidade e saturação. Não escolha uma cor diferente para cada letra e não altere a paleta entre cartões.
- Não inclua pessoas, personagens, animais, cenários, paisagens, construções, objetos reconhecíveis ou cenas bíblicas. Admita somente pequenos detalhes abstratos nos cantos ou extremidades.
- Gere dentro da imagem somente o trecho exato ou a referência exata solicitada, em tipografia infantil extragrande e arredondada, limitada à mesma paleta de três cores, com contorno e sombra suaves. Não acrescente nenhuma outra letra, palavra, número, moldura pesada ou logotipo.
- Preserve adequação para crianças de 5 a 11 anos e fidelidade bíblica NVI. Não inclua sexualização, romance, violência gráfica ou elementos assustadores.`,
  [LessonStageType.VERSE_FIXATION]: `Produza somente uma BRINCADEIRA SUPER DIVERTIDA DE FIXAÇÃO DO VERSÍCULO, no mesmo padrão completo da Brincadeira Normal do Clubinho Bíblico NIB. Esta etapa é diferente dos Visuais do Versículo já produzidos.

CONTRATO PEDAGÓGICO
- Use o único versículo principal escolhido e aprovado na lição. Preserve exatamente o texto, a referência e a versão NVI. Não escolha outro versículo, não parafraseie, complete, reduza ou troque a tradução.
- O objetivo central e verificável é fazer as crianças compreenderem e memorizarem o versículo completo; toda mecânica deve provocar repetição significativa, reconstrução, associação ou recuperação ativa do texto.
- Crie uma experiência que crianças de 5 a 11 anos realmente queiram brincar. Combine somente 2 ou 3 elementos como movimento, missão cooperativa, surpresa, busca, ritmo, montagem, descoberta ou desafio coletivo.
- Estruture curiosidade inicial, ação dinâmica e final marcante. Mantenha todas as crianças participando, sem eliminação, filas demoradas, exposição individual constrangedora ou atividade escolar disfarçada.
- A regra central deve ser explicável em até 1 minuto e funcionar mesmo com crianças ainda não alfabetizadas, usando fala, gestos, imagens, cores ou ajuda do grupo.
- A brincadeira deve durar de 10 a 15 minutos e terminar com todas as crianças recitando juntas o versículo completo e explicando seu sentido em linguagem simples.

ESTRUTURA OBRIGATÓRIA
1. NOME curto, alegre e memorável.
2. OBJETIVO pedagógico de memorização e objetivo da dinâmica.
3. MECÂNICAS DIVERTIDAS: informe as 2 ou 3 mecânicas combinadas.
4. MATERIAIS com quantidades ou regra de cálculo.
5. PREPARAÇÃO do espaço e dos materiais.
6. COMO BRINCAR em passos numerados, incluindo apresentação, repetição progressiva, dinâmica e recapitulação final, sem saltos lógicos.
7. REGRAS E SEGURANÇA: duração de 10 a 15 minutos, organização dos grupos, encerramento, espaço pequeno, criança tímida, não alfabetizada ou com mobilidade reduzida.
8. ADAPTAÇÕES POR IDADE: simplificação para 5 a 7 anos e desafio opcional para 8 a 11 anos.
9. COMO AVALIAR a compreensão e a memorização sem constrangimento.
10. PRINCÍPIO BÍBLICO: conexão final curta em linguagem infantil.
11. VISUAIS DE APOIO: crie exatamente uma imagem instrucional para cada passo, na mesma ordem. Cada imagem deve mostrar claramente como executar aquela instrução, e nunca ser apenas decorativa.

REGRAS DOS VISUAIS
- Use composição horizontal/paisagem, cores claras e suaves e identidade consistente entre todas as imagens.
- Não coloque texto, letras ou números dentro das imagens; a instrução literal será exibida como legenda pelo sistema.
- Mostre posições, materiais, organização e ação necessárias para executar cada passo. Não refaça os cartões tipográficos dos Visuais do Versículo.
- Não proponha corrida perigosa, contato forçado, eliminação, humilhação, venda nos olhos sem assistência ou materiais cortantes.`,
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
