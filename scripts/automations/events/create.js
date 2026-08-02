const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

function isoDatePlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const EVENT_TEMPLATES = [
  {
    title: 'Festa Junina do Clubinho',
    location: 'Salão da Igreja Central',
    description: 'Venha celebrar a festa junina com quadrilha, comidas típicas e muita alegria! Um momento especial para toda a família.',
  },
  {
    title: 'Formatura dos Clubistas',
    location: 'Auditório Principal',
    description: 'Celebração da formatura dos clubistas que completaram o ano letivo. Haverá entrega de certificados, apresentações e homenagens.',
  },
  {
    title: 'Acampamento de Verão',
    location: 'Sítio Esperança',
    description: 'Três dias de acampamento com atividades esportivas, estudos bíblicos, adoração e momentos de comunhão. Vagas limitadas!',
  },
  {
    title: 'Gincana Bíblica Regional',
    location: 'Centro de Convenções da Igreja',
    description: 'Competição bíblica entre os Clubinhos da região. As crianças demonstrarão o conhecimento adquirido durante o ano letivo.',
  },
  {
    title: 'Dia da Família no Clubinho',
    location: 'Parque Municipal',
    description: 'Um sábado especial para as famílias dos clubistas. Haverá piquenique, jogos, apresentações das crianças e tempo de oração.',
  },
  {
    title: 'Semana Missionária',
    location: 'Igreja Sede',
    description: 'Uma semana dedicada a conhecer as missões ao redor do mundo. As crianças aprenderão sobre povos alcançados e não alcançados.',
  },
  {
    title: 'Rally de Bicicletas',
    location: 'Avenida Principal da Cidade',
    description: 'Percurso de bicicletas com paradas temáticas bíblicas ao longo do trajeto. Evento aberto para toda a comunidade.',
  },
  {
    title: 'Noite de Talentos',
    location: 'Salão de Eventos',
    description: 'As crianças mostrarão seus talentos em música, teatro, dança e artes. Uma noite de celebração dos dons que Deus deu a cada criança.',
  },
  {
    title: 'Visita ao Lar de Idosos',
    location: 'Lar São Francisco',
    description: 'Os clubistas visitarão o lar de idosos para levar alegria, música e carinho. Uma lição de amor ao próximo na prática.',
  },
  {
    title: 'Culto de Encerramento do Ano',
    location: 'Igreja Central',
    description: 'Culto especial de encerramento do ano letivo com participação dos Clubinhos. Celebração de tudo que Deus realizou durante o ano.',
  },
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;
  const list = await http.request('get', '/events');
  const existing = Array.isArray(list.data) ? list.data : (list.data?.data || list.data?.items || []);
  const toCreate = Math.max(0, min - existing.length);
  logger.info(`[events/create] garantindo mínimo ${min} (atual=${existing.length}, criando=${toCreate})...`);

  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const template = EVENT_TEMPLATES[i % EVENT_TEMPLATES.length];
    const eventData = {
      title: `${template.title}${i >= EVENT_TEMPLATES.length ? ` #${Math.floor(i / EVENT_TEMPLATES.length) + 1}` : ''}`,
      date: isoDatePlus(7 + i * 14), // eventos a cada 2 semanas
      location: template.location,
      description: template.description,
      media: {
        title: `Capa: ${template.title}`,
        description: 'Imagem de capa do evento',
        uploadType: 'upload',
        mediaType: 'image',
        isLocalFile: true,
      },
    };

    try {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/events',
        fields: { eventData: JSON.stringify(eventData) },
        files: {
          file: {
            filename: 'capa-evento.jpg',
            contentType: 'image/jpeg',
            content: Buffer.alloc(1024, 0xFF), // 1KB dummy image
          },
        },
      });
      created.push(res.data);
      logger.info(`[events/create] +1 "${eventData.title}" em ${eventData.date}`);
      await sleep(40);
    } catch (e) {
      logger.warn(`[events/create] falhou "${eventData.title}": ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[events/create] OK criados=${created.length}`);
  return { created };
}

module.exports = { run };
