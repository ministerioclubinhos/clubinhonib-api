const { multipartRequest } = require('../common/multipart');
const { sleep } = require('../common/sleep');

const MEDITATION_WEEKS = [
  {
    topic: 'O Amor de Deus por Você',
    days: [
      { day: 'Monday', verse: 'Jo 3:16', topic: 'Deus amou o mundo' },
      { day: 'Tuesday', verse: '1Jo 4:8', topic: 'Deus é amor' },
      { day: 'Wednesday', verse: 'Rm 5:8', topic: 'Cristo morreu por nós' },
      { day: 'Thursday', verse: 'Sl 136:1', topic: 'O amor eterno de Deus' },
      { day: 'Friday', verse: 'Jr 31:3', topic: 'Amor eterno e misericórdia' },
    ],
  },
  {
    topic: 'Fé e Confiança em Deus',
    days: [
      { day: 'Monday', verse: 'Hb 11:1', topic: 'O que é fé?' },
      { day: 'Tuesday', verse: 'Pv 3:5-6', topic: 'Confiar no Senhor' },
      { day: 'Wednesday', verse: 'Mt 17:20', topic: 'Fé como grão de mostarda' },
      { day: 'Thursday', verse: 'Rm 10:17', topic: 'A fé vem pelo ouvir' },
      { day: 'Friday', verse: 'Mc 9:23', topic: 'Tudo é possível ao que crê' },
    ],
  },
  {
    topic: 'Oração: Falando com Deus',
    days: [
      { day: 'Monday', verse: 'Mt 6:9-13', topic: 'O Pai Nosso' },
      { day: 'Tuesday', verse: 'Fp 4:6', topic: 'Oração com ação de graças' },
      { day: 'Wednesday', verse: '1Ts 5:17', topic: 'Ore sem cessar' },
      { day: 'Thursday', verse: 'Tg 5:16', topic: 'A oração do justo' },
      { day: 'Friday', verse: 'Jr 33:3', topic: 'Clama a mim e te responderei' },
    ],
  },
  {
    topic: 'Frutos do Espírito',
    days: [
      { day: 'Monday', verse: 'Gl 5:22-23', topic: 'Os frutos do Espírito' },
      { day: 'Tuesday', verse: 'Gl 5:22', topic: 'Amor e alegria' },
      { day: 'Wednesday', verse: 'Gl 5:22', topic: 'Paz e longanimidade' },
      { day: 'Thursday', verse: 'Gl 5:23', topic: 'Bondade e mansidão' },
      { day: 'Friday', verse: 'Gl 5:23', topic: 'Domínio próprio e fidelidade' },
    ],
  },
  {
    topic: 'Jesus: O Bom Pastor',
    days: [
      { day: 'Monday', verse: 'Jo 10:11', topic: 'O Bom Pastor' },
      { day: 'Tuesday', verse: 'Sl 23:1-2', topic: 'O Senhor é meu pastor' },
      { day: 'Wednesday', verse: 'Jo 10:27-28', topic: 'Minhas ovelhas ouvem minha voz' },
      { day: 'Thursday', verse: 'Lc 15:4', topic: 'A ovelha perdida' },
      { day: 'Friday', verse: 'Jo 10:14', topic: 'Eu sou o Bom Pastor' },
    ],
  },
  {
    topic: 'Honrando Pai e Mãe',
    days: [
      { day: 'Monday', verse: 'Êx 20:12', topic: 'Honra teu pai e tua mãe' },
      { day: 'Tuesday', verse: 'Pv 1:8-9', topic: 'Sabedoria dos pais' },
      { day: 'Wednesday', verse: 'Ef 6:1-3', topic: 'Filhos, obedecei' },
      { day: 'Thursday', verse: 'Pv 22:6', topic: 'Ensina a criança no caminho certo' },
      { day: 'Friday', verse: 'Lc 2:51-52', topic: 'Jesus crescia em sabedoria' },
    ],
  },
  {
    topic: 'Servindo com Alegria',
    days: [
      { day: 'Monday', verse: 'Mc 10:44-45', topic: 'O maior é servo de todos' },
      { day: 'Tuesday', verse: 'Gl 5:13', topic: 'Servindo pelo amor' },
      { day: 'Wednesday', verse: 'Jo 13:14-15', topic: 'Jesus lavou os pés' },
      { day: 'Thursday', verse: 'Mt 25:40', topic: 'O que fez aos pequeninos' },
      { day: 'Friday', verse: 'Rm 12:11', topic: 'Servindo ao Senhor' },
    ],
  },
  {
    topic: 'A Bíblia: A Palavra de Deus',
    days: [
      { day: 'Monday', verse: 'Sl 119:105', topic: 'Lâmpada para os meus pés' },
      { day: 'Tuesday', verse: '2Tm 3:16', topic: 'Toda Escritura é inspirada' },
      { day: 'Wednesday', verse: 'Hb 4:12', topic: 'A Palavra é viva e eficaz' },
      { day: 'Thursday', verse: 'Mt 4:4', topic: 'De toda palavra de Deus' },
      { day: 'Friday', verse: 'Rm 15:4', topic: 'Para nosso ensinamento' },
    ],
  },
  {
    topic: 'Perdoando como Deus Perdoa',
    days: [
      { day: 'Monday', verse: 'Mt 6:14', topic: 'Se perdoardes os outros' },
      { day: 'Tuesday', verse: 'Ef 4:32', topic: 'Perdoai um ao outro' },
      { day: 'Wednesday', verse: 'Lc 23:34', topic: 'Perdoa-lhes, Pai' },
      { day: 'Thursday', verse: 'Cl 3:13', topic: 'Suportando e perdoando' },
      { day: 'Friday', verse: 'Sl 103:12', topic: 'Como o oriente do ocidente' },
    ],
  },
  {
    topic: 'Amizade Verdadeira',
    days: [
      { day: 'Monday', verse: 'Pv 17:17', topic: 'O amigo ama em todo tempo' },
      { day: 'Tuesday', verse: 'Jo 15:13', topic: 'Maior amor não há' },
      { day: 'Wednesday', verse: 'Jo 15:15', topic: 'Eu vos chamei amigos' },
      { day: 'Thursday', verse: 'Ec 4:9-10', topic: 'Dois são melhor que um' },
      { day: 'Friday', verse: 'Pv 27:10', topic: 'Não deixes o teu amigo' },
    ],
  },
];

function pad2(n) { return String(n).padStart(2, '0'); }
function toYYYYMMDDLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseYYYYMMDD(yyyyMMdd) {
  const datePart = String(yyyyMMdd).split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function nextMondayFrom(date) {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = (1 - dow + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function run({ http, logger, ctx }) {
  const min = ctx?.minPagesItems ?? 5;

  // Busca meditações existentes para não sobrepor datas
  let existingRanges = [];
  try {
    const existingRes = await http.request('get', '/meditations');
    const raw = Array.isArray(existingRes.data) ? existingRes.data : [];
    const existing = raw.map((x) => x?.meditation || x).filter(Boolean);
    existingRanges = existing
      .map((m) => ({
        start: m?.startDate ? parseYYYYMMDD(m.startDate) : null,
        end: m?.endDate ? parseYYYYMMDD(m.endDate) : null,
      }))
      .filter((r) => r.start && r.end);

    if (existing.length >= min) {
      logger.info(`[meditations/create] OK já existem ${existing.length} meditações`);
      return { created: 0, existing: existing.length };
    }
  } catch (_) {}

  const hasConflict = (s, e) =>
    existingRanges.some(
      (r) => (s >= r.start && s <= r.end) || (e >= r.start && e <= r.end) || (s <= r.start && e >= r.end),
    );

  const toCreate = Math.max(0, min - existingRanges.length);
  logger.info(`[meditations/create] criando ${toCreate} meditações semanais...`);

  // Começa da próxima segunda-feira após hoje
  let base = nextMondayFrom(new Date());
  let created = 0;

  for (let i = 0; i < toCreate; i++) {
    const template = MEDITATION_WEEKS[i % MEDITATION_WEEKS.length];

    // Encontra a próxima segunda disponível
    let start = new Date(base);
    let end = addDays(start, 4);
    let tries = 0;
    while (hasConflict(start, end) && tries < 60) {
      start = addDays(start, 7);
      end = addDays(start, 4);
      tries++;
    }

    const startDate = toYYYYMMDDLocal(start);
    const endDate = toYYYYMMDDLocal(end);

    const meditationData = {
      topic: `${template.topic}${i >= MEDITATION_WEEKS.length ? ` (${i + 1})` : ''}`,
      startDate,
      endDate,
      media: {
        title: `Áudio: ${template.topic}`,
        description: 'Arquivo de áudio da meditação semanal',
        uploadType: 'upload',
        mediaType: 'audio',
        isLocalFile: true,
      },
      days: template.days,
    };

    try {
      const res = await multipartRequest({
        http,
        method: 'POST',
        path: '/meditations',
        fields: { meditationData: JSON.stringify(meditationData) },
        files: {
          file: {
            filename: `meditacao-${startDate}.mp3`,
            contentType: 'audio/mpeg',
            content: Buffer.alloc(512, 0x00),
          },
        },
      });

      existingRanges.push({ start, end });
      created++;
      logger.info(`[meditations/create] +1 "${template.topic}" (${startDate} - ${endDate})`);

      // Avança para a semana seguinte para a próxima meditação
      base = addDays(end, 3);
      await sleep(50);
    } catch (e) {
      logger.warn(`[meditations/create] falhou "${template.topic}": ${e.response?.data?.message || e.message}`);
      base = addDays(base, 7);
    }
  }

  logger.info(`[meditations/create] OK criadas=${created}`);
  return { created };
}

module.exports = { run };
