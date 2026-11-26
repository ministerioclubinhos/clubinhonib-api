const { ensureRoleClients } = require('../common/role-users');
const { errorStatus } = require('../common/errors');
const { randomAdultBirthDate, pick } = require('../common/random');

const LOVE_LANGUAGES = ['Palavras de afirmação', 'Tempo de qualidade', 'Presentes', 'Atos de serviço', 'Toque físico'];
const TEMPERAMENTS = ['Sanguíneo', 'Colérico', 'Melancólico', 'Fleumático'];
const COLORS = ['Azul', 'Verde', 'Amarelo', 'Vermelho', 'Roxo'];

function buildProfilePayload(seed) {
  return {
    personalData: {
      birthDate: randomAdultBirthDate(),
      gender: seed % 2 === 0 ? 'M' : 'F',
      gaLeaderName: 'Líder do GA',
      gaLeaderContact: '11988887777',
    },
    preferences: {
      loveLanguages: pick(LOVE_LANGUAGES),
      temperaments: pick(TEMPERAMENTS),
      favoriteColor: pick(COLORS),
      favoriteFood: 'Pizza',
      favoriteMusic: 'Louvor',
      whatMakesYouSmile: 'Ver as crianças aprendendo',
      skillsAndTalents: 'Contar histórias',
    },
  };
}

/**
 * `/profiles` é o perfil completo (dados pessoais + preferências). Cada papel
 * cria o seu com `POST /profiles`; se já existe, a API pode recusar e aí o
 * caminho é `PUT /profiles/me`.
 */
async function run({ http, logger, ctx }) {
  logger.section('profiles/create');
  const as = await ensureRoleClients({ http, logger, ctx });

  let seed = 0;
  for (const key of ['admin', 'coordinator', 'coordinatorNoClubs', 'teacher', 'teacherUnlinked', 'googleLike']) {
    const client = as[key];
    if (!client) continue;
    seed += 1;
    const payload = buildProfilePayload(seed);
    await logger.check(`POST /profiles (ou PUT /profiles/me) como ${key}`, async () => {
      try {
        const res = await client.request('post', '/profiles', { data: payload });
        return `criado birthDate=${res.data?.personalData?.birthDate}`;
      } catch (e) {
        const status = errorStatus(e);
        if (status !== 409 && status !== 400) throw e;
        const res = await client.request('put', '/profiles/me', { data: payload });
        return `já existia; atualizado via PUT /profiles/me (${res.data?.preferences?.favoriteColor})`;
      }
    });
  }

  return { ok: true };
}

module.exports = { run, buildProfilePayload };
