const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

const WEEK_MATERIAL_TEMPLATES = [
  {
    pageTitle: 'Material da Semana: O Amor de Deus',
    pageSubtitle: 'Tema: Jo 3:16',
    pageDescription: 'Material completo para a semana com tema sobre o amor de Deus. Inclui lição, versículo para memorizar, atividades e vídeo.',
  },
  {
    pageTitle: 'Material da Semana: Fé e Confiança',
    pageSubtitle: 'Tema: Pv 3:5-6',
    pageDescription: 'Conteúdo semanal sobre fé e confiança em Deus. Material para professores e para uso em casa com a família.',
  },
  {
    pageTitle: 'Material da Semana: O Bom Samaritano',
    pageSubtitle: 'Tema: Lc 10:25-37',
    pageDescription: 'Estudando a parábola do Bom Samaritano. A criança aprenderá sobre ajudar ao próximo com amor e compaixão.',
  },
  {
    pageTitle: 'Material da Semana: Criação do Mundo',
    pageSubtitle: 'Tema: Gn 1:1',
    pageDescription: 'Explorando a história da criação. Atividades coloridas e dinâmicas para cada dia da semana de criação.',
  },
  {
    pageTitle: 'Material da Semana: Os Frutos do Espírito',
    pageSubtitle: 'Tema: Gl 5:22-23',
    pageDescription: 'Ensinando as crianças sobre os frutos do Espírito Santo. Material com jogos, teatro e atividades práticas.',
  },
  {
    pageTitle: 'Material da Semana: Davi e Golias',
    pageSubtitle: 'Tema: 1Sm 17',
    pageDescription: 'A história de Davi e Golias ensina sobre coragem e fé em Deus. Material com dramatização e atividades.',
  },
  {
    pageTitle: 'Material da Semana: Oração',
    pageSubtitle: 'Tema: Mt 6:9-13',
    pageDescription: 'Ensinando as crianças a orar. Inclui o Pai Nosso, formas de oração e momentos de prática.',
  },
  {
    pageTitle: 'Material da Semana: Moisés e o Êxodo',
    pageSubtitle: 'Tema: Êx 14',
    pageDescription: 'A história do êxodo e a travessia do Mar Vermelho. Material com mapa bíblico e atividades interativas.',
  },
  {
    pageTitle: 'Material da Semana: O Nascimento de Jesus',
    pageSubtitle: 'Tema: Lc 2:1-20',
    pageDescription: 'Celebrando o nascimento de Jesus. Material especial de Natal com músicas, teatro e reflexões.',
  },
  {
    pageTitle: 'Material da Semana: A Ressurreição',
    pageSubtitle: 'Tema: Mt 28:1-10',
    pageDescription: 'A mensagem central da fé cristã: Jesus ressuscitou! Material de Páscoa com explicações para crianças.',
  },
];

const YOUTUBE_IDS = [
  'dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0', 'kXYiU_JCYtU',
  'CevxZvSJLk8', 'oHg5SJYRHA0', 'aCyGvpBWP58', 'o_3BBSKZ_9U',
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 5;
  const list = await http.request('get', '/week-material-pages');
  const existing = Array.isArray(list.data) ? list.data : (list.data?.data || list.data?.items || []);
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[week-material-pages/create] garantindo mínimo ${min} (atual=${existing.length}, criando=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const template = WEEK_MATERIAL_TEMPLATES[i % WEEK_MATERIAL_TEMPLATES.length];
    const ytId = YOUTUBE_IDS[i % YOUTUBE_IDS.length];
    const dto = {
      pageTitle: `${template.pageTitle}${i >= WEEK_MATERIAL_TEMPLATES.length ? ` (${Math.floor(i / WEEK_MATERIAL_TEMPLATES.length) + 1})` : ''}`,
      pageSubtitle: template.pageSubtitle,
      pageDescription: template.pageDescription,
      videos: [
        {
          title: `Vídeo da Semana: ${template.pageSubtitle}`,
          description: 'Vídeo de apoio para a lição desta semana',
          uploadType: 'link',
          mediaType: 'video',
          isLocalFile: false,
          url: `https://www.youtube.com/watch?v=${ytId}`,
          platformType: 'youtube',
        },
      ],
      documents: [
        {
          title: `Lição da Semana: ${template.pageSubtitle}`,
          description: 'Apostila completa da lição para imprimir',
          uploadType: 'link',
          mediaType: 'document',
          isLocalFile: false,
          url: `https://example.com/licao-semana-${i + 1}.pdf`,
          platformType: 'ANY',
        },
        {
          title: `Atividade das Crianças: ${template.pageSubtitle}`,
          description: 'Folha de atividades para as crianças',
          uploadType: 'link',
          mediaType: 'document',
          isLocalFile: false,
          url: `https://example.com/atividade-semana-${i + 1}.pdf`,
          platformType: 'ANY',
        },
      ],
    };

    try {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/week-material-pages',
        fields: { weekMaterialsPageData: JSON.stringify(dto) },
        files: {},
      });
      created.push(res.data);
      logger.info(`[week-material-pages/create] +1 "${dto.pageTitle}"`);
      await sleep(30);
    } catch (e) {
      logger.warn(`[week-material-pages/create] falhou "${dto.pageTitle}": ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[week-material-pages/create] OK criados=${created.length}`);
  return { created };
}

module.exports = { run };
