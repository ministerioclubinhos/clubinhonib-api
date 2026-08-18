const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

const VIDEO_PAGE_TEMPLATES = [
  {
    title: 'Músicas do Clubinho',
    description: 'Playlist com as músicas mais cantadas nos encontros do Clubinho. Perfeito para as crianças cantarem em casa também!',
  },
  {
    title: 'Histórias Bíblicas Animadas',
    description: 'Vídeos animados contando as histórias bíblicas de forma divertida e acessível para crianças.',
  },
  {
    title: 'Devocional das Crianças',
    description: 'Vídeos devocionais especialmente produzidos para as crianças, com versículos, reflexões e orações.',
  },
  {
    title: 'Ensinamentos do Clubinho',
    description: 'Gravações das aulas e ensinamentos ministrados nos Clubinhos para revisão e aprendizado em casa.',
  },
  {
    title: 'Apresentações e Louvor',
    description: 'Registros em vídeo das apresentações de louvor realizadas pelos clubistas em eventos especiais.',
  },
  {
    title: 'Testemunhos das Crianças',
    description: 'Vídeos com testemunhos das crianças e famílias sobre como o Clubinho impactou suas vidas.',
  },
  {
    title: 'Atividades para Casa',
    description: 'Vídeos com sugestões de atividades bíblicas que as crianças podem fazer em casa com a família.',
  },
  {
    title: 'Formações e Capacitações',
    description: 'Vídeos de capacitação para professores e coordenadores do Clubinho NIB.',
  },
];

const YOUTUBE_IDS = [
  'dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0', 'kXYiU_JCYtU',
  'CevxZvSJLk8', 'oHg5SJYRHA0', 'aCyGvpBWP58', 'o_3BBSKZ_9U',
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 5;
  const list = await http.request('get', '/video-pages');
  const existing = Array.isArray(list.data) ? list.data : (list.data?.data || list.data?.items || []);
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[video-pages/create] garantindo mínimo ${min} (atual=${existing.length}, criando=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const template = VIDEO_PAGE_TEMPLATES[i % VIDEO_PAGE_TEMPLATES.length];
    const ytId = YOUTUBE_IDS[i % YOUTUBE_IDS.length];
    const dto = {
      title: `${template.title}${i >= VIDEO_PAGE_TEMPLATES.length ? ` (${Math.floor(i / VIDEO_PAGE_TEMPLATES.length) + 1})` : ''}`,
      description: template.description,
      public: i % 4 !== 0, // 75% público
      videos: [
        {
          title: `${template.title} - Vídeo 1`,
          description: 'Primeiro vídeo da página',
          uploadType: 'link',
          mediaType: 'video',
          isLocalFile: false,
          url: `https://www.youtube.com/watch?v=${ytId}`,
          platformType: 'youtube',
        },
        {
          title: `${template.title} - Vídeo 2`,
          description: 'Segundo vídeo da página',
          uploadType: 'link',
          mediaType: 'video',
          isLocalFile: false,
          url: `https://www.youtube.com/watch?v=${YOUTUBE_IDS[(i + 1) % YOUTUBE_IDS.length]}`,
          platformType: 'youtube',
        },
      ],
    };

    try {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/video-pages',
        fields: { videosPageData: JSON.stringify(dto) },
        files: {},
      });
      created.push(res.data);
      logger.info(`[video-pages/create] +1 "${dto.title}" (público=${dto.public})`);
      await sleep(30);
    } catch (e) {
      logger.warn(`[video-pages/create] falhou "${dto.title}": ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[video-pages/create] OK criados=${created.length}`);
  return { created };
}

module.exports = { run };
