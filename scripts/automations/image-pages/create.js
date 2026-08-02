const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

const IMAGE_PAGE_TEMPLATES = [
  {
    name: 'Galeria: Atividades do Clubinho',
    description: 'Registro fotográfico das atividades realizadas nos Clubinhos durante o ano letivo.',
    public: true,
  },
  {
    name: 'Galeria: Eventos Especiais',
    description: 'Fotos dos eventos especiais realizados ao longo do ano: festas, acampamentos e formaturas.',
    public: true,
  },
  {
    name: 'Galeria: Formatura dos Clubistas',
    description: 'Cerimônia de formatura dos clubistas que completaram o ciclo anual de atividades.',
    public: true,
  },
  {
    name: 'Galeria: Missões e Projetos',
    description: 'Imagens dos projetos missionários e sociais apoiados pelo Clubinho NIB.',
    public: true,
  },
  {
    name: 'Galeria: Equipe de Professores',
    description: 'Nossos dedicados professores voluntários que fazem o Clubinho acontecer toda semana.',
    public: true,
  },
  {
    name: 'Galeria: Momentos de Adoração',
    description: 'Registros dos momentos de louvor e adoração durante os encontros do Clubinho.',
    public: true,
  },
  {
    name: 'Material de Apoio Visual',
    description: 'Recursos visuais e ilustrações para uso dos professores nas aulas do Clubinho.',
    public: false,
  },
  {
    name: 'Galeria: Interclubes',
    description: 'Fotos dos encontros regionais dos Clubinhos, onde clubes de diferentes regiões se reúnem.',
    public: true,
  },
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 5;
  const list = await http.request('get', '/image-pages');
  const existing = Array.isArray(list.data) ? list.data : (list.data?.data || list.data?.items || []);
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[image-pages/create] garantindo mínimo ${min} (atual=${existing.length}, criando=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const template = IMAGE_PAGE_TEMPLATES[i % IMAGE_PAGE_TEMPLATES.length];
    const dto = {
      name: `${template.name}${i >= IMAGE_PAGE_TEMPLATES.length ? ` (${Math.floor(i / IMAGE_PAGE_TEMPLATES.length) + 1})` : ''}`,
      description: template.description,
      public: template.public,
      route: {
        title: template.name,
        subtitle: 'Galeria de fotos do Clubinho NIB',
        description: template.description,
        public: template.public,
        current: false,
        image: null,
        idToFetch: `image-page-${Date.now()}-${i}`,
        path: `/galerias/${template.name.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '-')}-${Date.now()}${i}`,
        entityType: 'image_pages',
        entityId: '00000000-0000-0000-0000-000000000000',
        type: 'image',
      },
    };

    try {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/image-pages',
        fields: { imageData: JSON.stringify(dto) },
        files: {},
      });
      created.push(res.data);
      logger.info(`[image-pages/create] +1 "${dto.name}" (público=${dto.public})`);
      await sleep(30);
    } catch (e) {
      logger.warn(`[image-pages/create] falhou "${dto.name}": ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[image-pages/create] OK criados=${created.length}`);
  return { created };
}

module.exports = { run };
