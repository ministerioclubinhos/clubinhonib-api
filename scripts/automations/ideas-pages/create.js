const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

const IDEAS_PAGE_TEMPLATES = [
  {
    title: 'Jogos e Brincadeiras Bíblicas',
    subtitle: 'Atividades lúdicas para aprender a Palavra de Deus',
    description: 'Coleção de jogos e brincadeiras criativas que ensinam valores bíblicos de forma divertida. Perfeito para usar nos encontros semanais do Clubinho.',
    sections: [
      {
        title: 'Quiz Bíblico',
        description: 'Perguntas e respostas sobre histórias da Bíblia. As crianças formam equipes e competem de forma saudável.',
        public: true,
      },
      {
        title: 'Caça ao Versículo',
        description: 'Os versículos são escondidos pelo salão e as crianças precisam encontrá-los e memorizá-los.',
        public: true,
      },
    ],
  },
  {
    title: 'Artesanato e Artes Visuais',
    subtitle: 'Expressando fé através da criatividade',
    description: 'Ideias de projetos de artesanato e artes visuais que ajudam as crianças a expressarem sua fé de forma criativa.',
    sections: [
      {
        title: 'Marcadores de Bíblia',
        description: 'As crianças criam marcadores de página personalizados com versículos e desenhos bíblicos.',
        public: true,
      },
      {
        title: 'Mural de Gratidão',
        description: 'Painel coletivo onde cada criança escreve ou desenha algo pelo qual é grata a Deus.',
        public: true,
      },
    ],
  },
  {
    title: 'Teatro e Encenações Bíblicas',
    subtitle: 'Vivendo as histórias da Bíblia',
    description: 'Roteiros simples de teatro para que as crianças possam encenar histórias bíblicas de forma criativa e divertida.',
    sections: [
      {
        title: 'A História de Davi e Golias',
        description: 'Roteiro simplificado da história de Davi e Golias, com orientações para a encenação.',
        public: true,
      },
      {
        title: 'A Parábola do Filho Pródigo',
        description: 'Dramatização da parábola do filho pródigo, focando nos temas de amor e perdão.',
        public: true,
      },
    ],
  },
  {
    title: 'Música e Louvor Infantil',
    subtitle: 'Adorando a Deus com alegria',
    description: 'Sugestões de músicas, corais e atividades musicais para os encontros do Clubinho.',
    sections: [
      {
        title: 'Músicas de Memória',
        description: 'Versículos transformados em músicas simples para facilitar a memorização pelas crianças.',
        public: true,
      },
      {
        title: 'Coral do Clubinho',
        description: 'Orientações para formar e treinar um coral com os clubistas para apresentações especiais.',
        public: false,
      },
    ],
  },
  {
    title: 'Missões e Evangelismo Infantil',
    subtitle: 'Ensinando as crianças a serem missionárias',
    description: 'Ideias práticas para ensinar as crianças sobre missões e como compartilhar o evangelho de forma natural e eficaz.',
    sections: [
      {
        title: 'O Mapa do Mundo Missionário',
        description: 'Atividade com mapa-múndi onde as crianças aprendem sobre países e povos ainda não alcançados.',
        public: true,
      },
      {
        title: 'Caixinha de Missões',
        description: 'Projeto de coleta mensal para apoiar missionários e projetos sociais.',
        public: true,
      },
    ],
  },
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 5;
  const list = await http.request('get', '/ideas-pages');
  const existing = Array.isArray(list.data) ? list.data : (list.data?.data || list.data?.items || []);
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[ideas-pages/create] garantindo mínimo ${min} (atual=${existing.length}, criando=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const template = IDEAS_PAGE_TEMPLATES[i % IDEAS_PAGE_TEMPLATES.length];
    const dto = {
      title: `${template.title}${i >= IDEAS_PAGE_TEMPLATES.length ? ` (${Math.floor(i / IDEAS_PAGE_TEMPLATES.length) + 1})` : ''}`,
      subtitle: template.subtitle,
      description: template.description,
      public: true,
      sections: template.sections.map((s) => ({
        ...s,
        medias: [
          {
            title: `Vídeo: ${s.title}`,
            description: 'Material de apoio em vídeo',
            mediaType: 'video',
            uploadType: 'link',
            isLocalFile: false,
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            platformType: 'youtube',
            size: '0',
          },
        ],
      })),
    };

    try {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/ideas-pages',
        fields: { ideasMaterialsPageData: JSON.stringify(dto) },
        files: {},
      });
      created.push(res.data);
      logger.info(`[ideas-pages/create] +1 "${dto.title}"`);
      await sleep(30);
    } catch (e) {
      logger.warn(`[ideas-pages/create] falhou "${dto.title}": ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[ideas-pages/create] OK criados=${created.length}`);
  return { created };
}

module.exports = { run };
