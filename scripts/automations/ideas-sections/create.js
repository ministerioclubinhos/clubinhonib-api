const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

const IDEAS_SECTION_TEMPLATES = [
  {
    title: 'Dinâmica: A Família de Deus',
    description: 'Atividade para explorar o conceito de família na Bíblia. As crianças aprendem que fazem parte da família de Deus e que são amadas por Ele.',
  },
  {
    title: 'Jogo: Viagem Bíblica',
    description: 'Jogo de tabuleiro bíblico onde as crianças viajam pelos lugares mencionados na Bíblia, respondendo perguntas sobre as histórias.',
  },
  {
    title: 'Atividade: Memorizar Versículos com Gestos',
    description: 'Técnica de memorização usando gestos corporais para fixar os versículos bíblicos de forma lúdica e divertida.',
  },
  {
    title: 'Teatro: A História de José no Egito',
    description: 'Roteiro simplificado para encenação da história de José. Ensina sobre perseverança, perdão e a providência de Deus.',
  },
  {
    title: 'Dinâmica: A Videira e os Ramos',
    description: 'Usando a metáfora da videira (Jo 15), as crianças aprendem sobre permanecer ligadas a Jesus para dar frutos.',
  },
  {
    title: 'Jogo: Quiz das Parábolas',
    description: 'Perguntas e respostas sobre as parábolas de Jesus. As crianças aprendem os ensinamentos de forma competitiva e divertida.',
  },
  {
    title: 'Arte: Painel dos Dez Mandamentos',
    description: 'As crianças criam um painel ilustrado com os Dez Mandamentos. Cada criança ilustra um mandamento de forma criativa.',
  },
  {
    title: 'Dinâmica: O Bem e o Mal',
    description: 'Atividade para ajudar as crianças a entender a diferença entre o bem e o mal através de situações do dia a dia.',
  },
  {
    title: 'Música: Versículos Cantados',
    description: 'Versículos bíblicos transformados em músicas simples. As crianças aprendem enquanto cantam e se movimentam.',
  },
  {
    title: 'Projeto: Bíblia dos Sonhos',
    description: 'As crianças criam sua própria "Bíblia dos Sonhos" ilustrada, com as histórias e versículos favoritos.',
  },
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 5;
  const list = await http.request('get', '/ideas-sections');
  const existing = Array.isArray(list.data) ? list.data : (list.data?.data || list.data?.items || []);
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[ideas-sections/create] garantindo mínimo ${min} (atual=${existing.length}, criando=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const template = IDEAS_SECTION_TEMPLATES[i % IDEAS_SECTION_TEMPLATES.length];
    const dto = {
      title: `${template.title}${i >= IDEAS_SECTION_TEMPLATES.length ? ` #${Math.floor(i / IDEAS_SECTION_TEMPLATES.length) + 1}` : ''}`,
      description: template.description,
      public: i % 4 !== 0, // 75% público
      medias: [
        {
          title: `Material de Apoio: ${template.title}`,
          description: 'Imagem ilustrativa da atividade',
          uploadType: 'link',
          mediaType: 'image',
          isLocalFile: false,
          url: `https://picsum.photos/seed/${i + 50}/800/600`,
          platformType: 'ANY',
          size: '0',
        },
      ],
    };

    try {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/ideas-sections',
        fields: { sectionData: JSON.stringify(dto) },
        files: {},
      });
      created.push(res.data);
      logger.info(`[ideas-sections/create] +1 "${dto.title}"`);
      await sleep(30);
    } catch (e) {
      logger.warn(`[ideas-sections/create] falhou "${dto.title}": ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[ideas-sections/create] OK criados=${created.length}`);
  return { created };
}

module.exports = { run };
