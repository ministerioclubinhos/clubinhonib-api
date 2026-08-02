const { fetchAllPages } = require('../common/pagination');
const { ACADEMIC_YEAR } = require('../common/config');

async function run({ http, logger }) {
  const year = ACADEMIC_YEAR;
  logger.info(`[accepted-christs/create] criando registros de aceitação de Cristo para o ano ${year}...`);

  // Busca todas as crianças
  const children = await fetchAllPages(http.request, 'get', '/children', {}, { limit: 100, maxPages: 500 });

  if (children.length === 0) {
    logger.warn('[accepted-christs/create] nenhuma criança encontrada. Pulando.');
    return { created: 0, skipped: 0 };
  }

  // Cerca de 20-30% das crianças aceitam Cristo
  const eligibleCount = Math.max(1, Math.floor(children.length * (0.2 + Math.random() * 0.1)));
  // Embaralha e pega uma amostra
  const shuffled = [...children].sort(() => Math.random() - 0.5);
  const eligible = shuffled.slice(0, eligibleCount);

  const decisions = ['ACCEPTED', 'RECONCILED'];
  const noteTemplates = [
    'Criança aceitou Cristo durante a reunião semanal com muito fervor.',
    'Declarou publicamente sua fé durante o encerramento do Clubinho.',
    'Tomou a decisão de aceitar Cristo após uma semana de reflexão sobre os versículos.',
    'Reconciliou-se com Cristo após um período de afastamento. Família também participou.',
    'Aceitou Cristo pela primeira vez. Família ficou muito emocionada.',
    'Decisão espontânea durante o momento de oração do Clubinho.',
    'Após várias semanas ouvindo sobre o amor de Deus, tomou a decisão de aceitar Cristo.',
    'Reconciliação marcada por muito choro e alegria. Toda a turma celebrou.',
    null,
    null,
  ];

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const child of eligible) {
    const decision = decisions[Math.floor(Math.random() * decisions.length)];
    const notes = noteTemplates[Math.floor(Math.random() * noteTemplates.length)];

    try {
      await http.request('post', '/accepted-christs', {
        data: {
          childId: child.id,
          decision,
          notes,
        },
      });
      created++;
      logger.info(`[accepted-christs/create] +1 ${decision}: ${child.name || child.id}`);
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.message || e.message;
      // 409 = duplicado, ignora silenciosamente
      if (status === 409 || (typeof msg === 'string' && msg.toLowerCase().includes('already'))) {
        skipped++;
      } else {
        errors++;
        logger.warn(`[accepted-christs/create] falhou child=${child.id}: ${msg}`);
      }
    }
  }

  logger.info(
    `[accepted-christs/create] OK criados=${created} duplicados=${skipped} erros=${errors} total_crianças=${children.length}`,
  );
  return { created, skipped, errors };
}

module.exports = { run };
