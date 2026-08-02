const { sleep } = require('../common/sleep');

const INFORMATIVES = [
  {
    title: 'Bem-vindo ao Clubinho NIB!',
    description: 'O Clubinho NIB é um ministério dedicado às crianças, oferecendo um ambiente seguro, amoroso e divertido para que elas possam conhecer e crescer na fé cristã. Participe conosco!',
    public: true,
  },
  {
    title: 'Inscrições Abertas para o Ano Letivo',
    description: 'As inscrições para o ano letivo estão abertas! Venha participar do Clubinho e fazer parte de uma comunidade incrível. Crianças de 6 a 14 anos são bem-vindas.',
    public: true,
  },
  {
    title: 'Evento Especial: Festa de Encerramento',
    description: 'Estamos preparando uma festa especial para comemorar o encerramento do ano letivo. Haverá apresentações, brincadeiras e muito louvor. Venha com sua família!',
    public: true,
  },
  {
    title: 'Formação de Professores Voluntários',
    description: 'Você tem vontade de servir às crianças? O Clubinho NIB está recrutando professores voluntários. Oferecemos capacitação completa. Entre em contato para saber mais!',
    public: true,
  },
  {
    title: 'Meditações Semanais Disponíveis',
    description: 'As meditações semanais já estão disponíveis no site. Acompanhe os versículos e temas que suas crianças estão estudando no Clubinho e continue o aprendizado em casa.',
    public: true,
  },
  {
    title: 'Material Didático da Semana',
    description: 'Os materiais didáticos desta semana estão disponíveis para download. Professores, acessem a área de materiais e baixe as lições e atividades para o próximo encontro.',
    public: false,
  },
  {
    title: 'Comunicado: Feriado da Semana',
    description: 'Em virtude do feriado nacional desta semana, os Clubinhos que funcionam neste dia não terão atividades. Os encontros retomam normalmente na semana seguinte.',
    public: true,
  },
  {
    title: 'Novidade: Sistema de Pagelas Online',
    description: 'Informamos que o registro de presença (pagelas) das crianças agora é feito digitalmente pelo nosso sistema. Professores, realizem o lançamento semanalmente.',
    public: false,
  },
  {
    title: 'Parceria com Escolas Locais',
    description: 'O Clubinho NIB firmou parceria com escolas da região para divulgar o ministério e alcançar mais crianças. Se você conhece crianças que gostariam de participar, convide-as!',
    public: true,
  },
  {
    title: 'Semana Missionária do Clubinho',
    description: 'Durante a semana missionária, os Clubinhos realizarão atividades especiais com tema missionário. As crianças aprenderão sobre o alcance do evangelho ao mundo.',
    public: true,
  },
];

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 10;

  // Verifica quantos informativos já existem
  let existing = 0;
  try {
    const listRes = await http.request('get', '/informatives', { params: { page: 1, limit: 1 } });
    existing = listRes.data?.total ?? listRes.data?.meta?.totalItems ?? (Array.isArray(listRes.data) ? listRes.data.length : 0);
  } catch (_) {}

  const toCreate = Math.max(0, min - existing);
  logger.info(`[informatives/create] garantindo mínimo ${min} informativos (atual=${existing}, criando=${toCreate})...`);

  let created = 0;
  const informativos = [...INFORMATIVES];
  // Se precisar de mais do que os templates, embaralha e reutiliza
  while (informativos.length < toCreate) {
    informativos.push(...INFORMATIVES.map((inf) => ({
      ...inf,
      title: `${inf.title} (${new Date().getFullYear()})`,
    })));
  }

  for (let i = 0; i < toCreate; i++) {
    const inf = informativos[i % informativos.length];
    try {
      const res = await http.request('post', '/informatives', { data: inf });
      created++;
      logger.info(`[informatives/create] +1 "${inf.title}" (público=${inf.public})`);
      await sleep(30);
    } catch (e) {
      logger.warn(`[informatives/create] falhou "${inf.title}": ${e.response?.data?.message || e.message}`);
    }
  }

  logger.info(`[informatives/create] OK criados=${created}`);
  return { created };
}

module.exports = { run };
