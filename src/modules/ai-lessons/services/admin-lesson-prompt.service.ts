import { ConflictException, Injectable } from '@nestjs/common';
import { AdminLessonPromptEntity } from '../entities/admin-lesson-prompt.entity';
import { LESSON_STAGE_ORDER, LessonStageType } from '../enums/lesson.enums';
import { AdminLessonPromptRepository } from '../repositories/admin-lesson-prompt.repository';

export type AdminLessonPromptView = {
  stage: LessonStageType;
  basePrompt: string;
  customPrompt: string | null;
  effectivePrompt: string;
  lockVersion: number | null;
};

// ... BASE_PROMPTS definition ...

@Injectable()
export class AdminLessonPromptService {
  constructor(private readonly promptsRepo: AdminLessonPromptRepository) {}

  async list(adminId: string): Promise<AdminLessonPromptView[]> {
    const saved = await this.promptsRepo.findByAdminId(adminId);
    return LESSON_STAGE_ORDER.map((stage) =>
      this.view(stage, saved.find((item) => item.stage === stage) ?? null),
    );
  }

  async effective(adminId: string, stage: LessonStageType): Promise<string> {
    const saved = await this.promptsRepo.findByAdminIdAndStage(adminId, stage);
    return this.composeEffectivePrompt(stage, saved?.customPrompt ?? null);
  }

  async save(
    adminId: string,
    stage: LessonStageType,
    prompt: string,
    lockVersion?: number,
  ): Promise<AdminLessonPromptView> {
    const normalized = prompt.trim();
    const current = await this.promptsRepo.findByAdminIdAndStage(
      adminId,
      stage,
    );
    if (current && lockVersion !== current.lockVersion)
      throw new ConflictException(
        'O prompt foi alterado em outra sessão. Recarregue antes de salvar.',
      );
    const entity =
      current ??
      this.promptsRepo.createPrompt({
        adminId,
        stage,
        customPrompt: normalized,
      });
    entity.customPrompt = normalized;
    return this.view(stage, await this.promptsRepo.savePrompt(entity));
  }

  async reset(
    adminId: string,
    stage: LessonStageType,
  ): Promise<AdminLessonPromptView> {
    await this.promptsRepo.deletePrompt(adminId, stage);
    return this.view(stage, null);
  }

  private view(
    stage: LessonStageType,
    entity: AdminLessonPromptEntity | null,
  ): AdminLessonPromptView {
    return {
      stage,
      basePrompt: BASE_PROMPTS[stage],
      customPrompt: entity?.customPrompt ?? null,
      effectivePrompt: this.composeEffectivePrompt(
        stage,
        entity?.customPrompt ?? null,
      ),
      lockVersion: entity?.lockVersion ?? null,
    };
  }

  private composeEffectivePrompt(
    stage: LessonStageType,
    customPrompt: string | null,
  ): string {
    if (!customPrompt) return BASE_PROMPTS[stage];
    return `${BASE_PROMPTS[stage]}\n\nORIENTAÇÃO COMPLEMENTAR DO ADMINISTRADOR\n${customPrompt}\n\nA orientação complementar não substitui estrutura, fidelidade bíblica, segurança infantil, formato de impressão ou critérios editoriais obrigatórios acima.`;
  }
}

const BASE_PROMPTS: Record<LessonStageType, string> = {
  [LessonStageType.LESSON]: `Produza somente a LIÇÃO BÍBLICA, seguindo o padrão editorial das lições manuais do Clubinho Bíblico NIB.

PÚBLICO E TOM
- Escreva em português brasileiro especificamente para crianças de 5 a 11 anos, com frases claras, calorosas, concretas e fáceis de o professor falar em voz alta. Quando uma palavra difícil for indispensável, explique-a imediatamente.
- Mantenha o conteúdo apropriado para essa faixa etária: sem conteúdo sexual, romântico, erotizado, violência gráfica ou debates de sexualidade de qualquer orientação. O foco deve permanecer exclusivamente na passagem bíblica e no objetivo pedagógico.
- Seja fiel ao texto bíblico informado. Não misture personagens, lugares, cronologia ou acontecimentos de outras passagens.
- Use a Bíblia NVI como versão textual de referência. Não invente versículo, redação da NVI, promessa, doutrina, costume histórico ou detalhe narrativo como se estivesse na Bíblia. Quando não houver segurança sobre a citação literal da NVI, sinalize revisão humana.
- Transforme explicações abstratas em exemplos do cotidiano infantil: família, escola, amigos, igreja, obediência, oração e cuidado com o próximo.
- O texto deve orientar o professor, não falar como um artigo acadêmico e não mencionar inteligência artificial.

ORDEM OBRIGATÓRIA DO CONTEÚDO
1. LIÇÃO E TÍTULO: o título da lição ("title") DEVE incorporar e preservar obrigatoriamente o tema exato fornecido pelo usuário no input ("theme"), em caixa alta. Nunca substitua, trunque nem altere o assunto definido no tema.
2. TEXTO/REFERÊNCIA BÍBLICA: preserve exatamente todas as referências bíblicas fornecidas pelo administrador (suportando múltiplas passagens ou relatos paralelos como Mateus, Marcos e Lucas separados por barra ou vírgula). Unifique a narrativa dos evangelhos/passagens de forma harmoniosa e sem contradições.
3. PROPÓSITO: comece com verbo pedagógico, explicando claramente o que as crianças deverão compreender e praticar.
4. MÚSICAS: sugira de duas a quatro músicas infantis coerentes com o tema; não invente letras.
5. VERSÍCULO PRINCIPAL PARA MEMORIZAR: escolha exatamente um versículo central para toda a lição. Ele deve resumir o princípio ensinado, ser adequado para crianças de 5 a 11 anos e permanecer como fonte única da etapa posterior de fixação. Informe o texto completo, referência e versão NVI. Se não houver segurança sobre a redação exata da NVI, sinalize revisão humana em vez de fabricar o texto.
6. EXPLICAÇÃO DO PRINCÍPIO: explique o versículo palavra por palavra quando necessário e conecte-o à vida da criança.
7. HISTÓRIA BÍBLICA: crie uma narrativa completa, em ordem, com começo, desenvolvimento e conclusão, dividida em parágrafos claros. As indicações de cenas visuais devem ser colocadas SEMPRE em uma linha própria (um parágrafo isolado do texto narrativo) no formato scene-01: [Descrição da cena], sem escrever “[Image #]” e sem colocar marcadores no meio de frases.
8. APLICAÇÃO E APELO: diferencie a aplicação para a criança salva do convite à criança que deseja seguir Jesus. Explique pecado como tudo o que pensamos, falamos ou fazemos que desagrada a Deus. Não use medo, pressão emocional ou promessa de resultado material. Quando houver oração de decisão, preserve o texto oficial: “Senhor Deus, perdoa os meus pecados e vem entrar no meu coração. Eu creio que Jesus, teu Filho, morreu na cruz no meu lugar e ressuscitou. Eu escolho te seguir! Quero que tu sejas o meu Senhor e Salvador, em nome de Jesus! Amém.”
9. CANTINHO DO ACONSELHAMENTO: oriente o professor a conversar individualmente, usar a Bíblia, o Livro Sem Palavras, o Cartão de Decisão e o Cartão de Aniversário de Novo Nascimento, confirmar a compreensão da criança e registrar a decisão sem constrangimento.
10. PERGUNTAS DA LIÇÃO: gere exatamente dez perguntas numeradas com respostas completas; cubra fatos da narrativa, significado espiritual, versículo e aplicação prática.
11. FALANDO COM DEUS: oração final curta, coerente com a lição, compreensível e sem introduzir doutrina não trabalhada.

QUALIDADE OBRIGATÓRIA
- Use como referência de formato o acervo manual do Clubinho NIB: uma lição pronta para o professor ministrar, com seções editoriais explícitas e não um resumo, roteiro telegráfico ou artigo.
- Nunca copie nomes de voluntários, escalas de personagens, dados pessoais, conteúdo político, propaganda, relatórios eleitorais ou anotações operacionais encontradas em arquivos de referência.
- Trate a referência informada como fonte fechada. Quando relatos paralelos forem fornecidos, harmonize somente fatos compatíveis e deixe qualquer divergência para revisão humana.
- Não declare que uma citação é NVI se não puder garantir sua redação exata. Nesse caso, mantenha a referência e escreva claramente no conteúdo que a citação precisa de conferência humana antes da aprovação.
- Mantenha nomes e características consistentes em todo o texto.
- Evite repetição, moralismo genérico, linguagem adulta, clichês vazios e conteúdo fora da referência.
- Não crie a brincadeira normal nem a atividade de fixação nesta etapa; elas serão produzidas depois da aprovação.
- Entregue conteúdo suficientemente detalhado para o professor ministrar a aula sem precisar completar lacunas essenciais.`,
  [LessonStageType.LESSON_VISUALS]: `Produza somente os VISUAIS DA HISTÓRIA da lição aprovada, seguindo o padrão dos conjuntos de imagens manuais do Clubinho Bíblico NIB. Estes visuais auxiliam o professor a contar a narrativa e são diferentes dos visuais de fixação do versículo, que pertencem a outra etapa.

OBJETIVO
- Transforme os principais momentos da narrativa aprovada em uma sequência visual clara para apoiar a contação da história.
- Cada imagem deve representar um acontecimento específico e estar vinculada ao sceneId correspondente da lição.
- As imagens destinam-se a crianças de 5 a 11 anos e devem permanecer apropriadas para essa idade, sem sexualização, romance, violência gráfica ou elementos assustadores desnecessários.

CONFIGURAÇÃO ESCOLHIDA PELO ADMINISTRADOR
- Respeite exatamente a quantidade de 4 a 10 imagens e a orientação retrato ou paisagem recebidas. Não escolha valores diferentes.
- STORY_SEQUENCE: organize cenas cronológicas que permitam à criança reconstruir começo, desenvolvimento, clímax e conclusão da história.
- CHARACTER_AND_EMOTION: destaque personagens, ações e emoções observáveis para ajudar a criança a reconhecer motivações e consequências sem inventar pensamentos.
- VISUAL_ANCHORS: crie imagens-âncora simples, cada uma focada em um objeto, lugar ou momento central que facilite associação e recordação.
- INTERACTIVE_COLORING: produza cenas em line art preto e branco, com contornos grossos e áreas amplas, para a criança colorir enquanto relembra a narrativa.
- A opção selecionada define a estratégia do conjunto inteiro. Não misture abordagens nem transforme a etapa em uma nova interpretação da lição.

CONTINUIDADE VISUAL
- Crie antes uma ficha mental consistente para cada personagem: faixa etária, pele, cabelo, roupa, cores, acessórios e expressão típica.
- Preserve esses atributos em todas as cenas. Não troque roupa, idade, etnia, quantidade de personagens ou cenário sem motivo narrativo.
- Preserve época e ambiente bíblicos. Evite objetos modernos, arquitetura incompatível, estereótipos e símbolos religiosos anacrônicos.
- Use estilo de ilustração bíblica infantil, acolhedor e expressivo, com cores claras, luminosas e suaves, sombras leves, contraste suficiente para impressão e leitura visual simples.

COBERTURA
- Inclua abertura/contexto, acontecimentos decisivos, reação dos personagens, clímax e conclusão/aplicação visual quando ela puder ser representada sem alegoria confusa.
- Não crie cenas decorativas repetidas. Cada visual deve acrescentar informação narrativa.
- Para cada visual, descreva finalidade, composição, personagens, ação, ambiente, emoção, enquadramento, iluminação, paleta e continuidade com a cena anterior.
- Gere texto alternativo objetivo e útil para acessibilidade.

REGRAS DE ARTE
- Nunca coloque palavras, versículos, legendas, balões, números, marcas, molduras ou logotipos dentro da imagem gerada.
- Não represente Deus Pai fisicamente. Trate cenas sensíveis com reverência e adequação infantil.
- Toda arte da lição deve ser horizontal, em modo paisagem, preparada para composição e impressão em folha A4 paisagem. Mantenha personagens e elementos importantes dentro de uma margem segura, longe das bordas e de futuras áreas de corte.
- Não altere fatos, diálogos ou ênfase teológica já aprovados na lição.
- A lição aprovada é a única fonte narrativa. Use somente seus personagens, ambientes, ações e objetos; não preencha lacunas criativamente nem repense a história.
- Não crie cartões, palavras, símbolos mnemônicos ou imagens para o versículo nesta etapa. Aqui entram exclusivamente personagens, ambientes, cenários, objetos e acontecimentos da história bíblica.`,
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
  [LessonStageType.MEDITATION_YOUNGER]: `Produza somente a MEDITAÇÃO PARA CRIANÇAS MENORES, conforme a folha manual da Semana 26 do Clubinho Bíblico NIB.

PÚBLICO E FORMATO
- Destine o material a crianças de 5 a 7 anos, inclusive crianças em alfabetização inicial. Use frases curtas, comandos concretos, letras legíveis e forte apoio visual.
- A saída final será uma folha A4 retrato com duas cópias idênticas, uma em cada metade da página, contendo cabeçalho oficial, título, campos Nome e Data, versículo, duas atividades e a faixa “FALANDO COM DEUS”.
- Use exatamente o título, a referência bíblica e o único versículo principal NVI aprovados na lição.

CONTEÚDO OBRIGATÓRIO
- Crie exatamente duas atividades diferentes e diretamente ligadas aos fatos centrais da lição.
- Crie exatamente duas imagens, uma para cada atividade e na mesma ordem. Cada imagem deve ser necessária para executar a instrução, não meramente decorativa.
- Cada atividade deve conter uma pequena explicação fiel à Bíblia, uma instrução executável e uma resposta/gabarito objetivo.
- Priorize colorir, traçar, circular, ligar, completar palavra curta ou reconhecer personagem/objeto. Não dependa de leitura avançada.
- Inclua uma oração final de uma frase, começando com “Jesus,” ou “Senhor,” e conectada à aplicação da lição.

ARTES
- Gere apenas as ilustrações indispensáveis para as duas atividades, em line art preto e branco puro, fundo branco, contornos grossos, formas simples e áreas amplas para colorir.
- Não coloque letras, nomes, versículos, instruções, números ou logotipos dentro da imagem; o renderer adicionará todo texto.
- Preserve margem segura e composição adequada aos pequenos quadros de uma folha A4 retrato duplicada.
- Não invente fatos bíblicos nem represente conteúdo assustador, violência gráfica ou anatomia inadequada para crianças.`,
  [LessonStageType.MEDITATION_OLDER]: `Produza somente a MEDITAÇÃO PARA CRIANÇAS MAIORES, conforme a folha manual da Semana 26 do Clubinho Bíblico NIB.

PÚBLICO E FORMATO
- Destine o material a crianças de 8 a 11 anos, com linguagem clara, desafiadora e apropriada à leitura autônoma.
- Componha uma única folha A4 retrato com cabeçalho oficial, título, campos Nome e Data, caixa destacada do versículo principal, texto bíblico, seção “Entendendo a lição”, três desafios e a faixa “FALANDO COM DEUS”.
- Preserve exatamente o título, a referência da passagem e o único versículo principal NVI aprovados na lição.

TRÊS DESAFIOS OBRIGATÓRIOS
- Crie exatamente três atividades variadas e não repetitivas que cubram compreensão da narrativa, significado do ensino e aplicação/missão.
- Crie exatamente três imagens, uma vinculada a cada desafio e na mesma ordem. Labirintos, diferenças, associações e códigos visuais devem vir completos e solucionáveis.
- Combine recursos como código de símbolos/letras, sequência de letras, palavras embaralhadas, associação, labirinto, encontre diferenças ou preenchimento de frase bíblica.
- Toda atividade deve ter instrução completa, dados suficientes para ser resolvida e resposta determinística. Gere um gabarito completo para revisão e uso do professor.
- Não crie enigma ambíguo, informação ausente, símbolo sem legenda nem solução dependente de conhecimento fora da lição.

ARTES E SEGURANÇA
- Gere ilustrações em line art preto e branco, fundo branco, contornos nítidos e sem texto, apenas quando necessárias aos desafios.
- O renderer adicionará letras, símbolos, frases, campos, caixas, numeração e identidade visual para evitar erros de imagem.
- Mantenha tudo legível em A4 retrato, sem conteúdo sexual, romântico, assustador ou violência gráfica.`,
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
