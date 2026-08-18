const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

const SECTION_TEMPLATES = [
  {
    title: 'Atividade: A Criação do Mundo',
    description: 'Sequência de imagens ilustrando os 7 dias da criação, ideal para contar a história de forma visual e interativa com as crianças.',
  },
  {
    title: 'Galeria: Festa Junina do Clubinho',
    description: 'Registros fotográficos da festa junina realizada pelos clubistas. Momentos de alegria e confraternização.',
  },
  {
    title: 'Fotos: Acampamento de Verão',
    description: 'Memórias do acampamento de verão. Atividades ao ar livre, momentos de devoção e muita amizade.',
  },
  {
    title: 'Ilustrações Bíblicas: O Nascimento de Jesus',
    description: 'Coleção de imagens que ilustram a história do nascimento de Jesus, para uso nas aulas do Natal.',
  },
  {
    title: 'Galeria: Encerramento do Ano Letivo',
    description: 'Fotos da cerimônia de encerramento do ano letivo, com formatura dos clubistas e homenagens especiais.',
  },
  {
    title: 'Mapas Bíblicos Ilustrados',
    description: 'Mapas das terras bíblicas com ilustrações das principais histórias. Recurso didático para aulas de geografia bíblica.',
  },
  {
    title: 'Arte das Crianças',
    description: 'Trabalhos artísticos produzidos pelos clubistas durante as atividades de artes. Cada criança expressa sua fé através da criatividade.',
  },
  {
    title: 'Galeria: Dia da Família',
    description: 'Momentos especiais do Dia da Família realizado no parque. Pais, filhos e amigos reunidos em alegria.',
  },
  {
    title: 'Fotos: Gincana Bíblica Regional',
    description: 'Registros da competição bíblica regional. Nossas equipes representaram o Clubinho com excelência.',
  },
  {
    title: 'Projetos de Missões em Fotos',
    description: 'Imagens dos projetos missionários apoiados pelo Clubinho ao redor do mundo. Mostrando às crianças o alcance do evangelho.',
  },
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 5;
  const list = await http.request('get', '/image-sections');
  const existing = Array.isArray(list.data) ? list.data : (list.data?.data || list.data?.items || []);
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[image-sections/create] garantindo mínimo ${min} (atual=${existing.length}, criando=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const template = SECTION_TEMPLATES[i % SECTION_TEMPLATES.length];
    const dto = {
      caption: `${template.title}${i >= SECTION_TEMPLATES.length ? ` #${Math.floor(i / SECTION_TEMPLATES.length) + 1}` : ''}`,
      description: template.description,
      public: i % 5 !== 0, // 80% público
      mediaItems: [
        {
          title: `Imagem 1: ${template.title}`,
          description: 'Primeira imagem da galeria',
          uploadType: 'link',
          mediaType: 'image',
          isLocalFile: false,
          url: `https://picsum.photos/seed/${i + 100}/800/600`,
          platformType: 'ANY',
        },
        {
          title: `Imagem 2: ${template.title}`,
          description: 'Segunda imagem da galeria',
          uploadType: 'link',
          mediaType: 'image',
          isLocalFile: false,
          url: `https://picsum.photos/seed/${i + 200}/800/600`,
          platformType: 'ANY',
        },
      ],
    };

    try {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/image-sections',
        fields: { sectionData: JSON.stringify(dto) },
        files: {},
      });
      created.push(res.data);
      logger.info(`[image-sections/create] +1 "${dto.caption}"`);
      await sleep(30);
    } catch (e) {
      logger.warn(`[image-sections/create] falhou "${dto.caption}": ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[image-sections/create] OK criados=${created.length}`);
  return { created };
}

module.exports = { run };
