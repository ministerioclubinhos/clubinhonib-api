const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');
const { expectFields, runEditContractChecks } = require('../common/update-helpers');

/** `PUT /profiles/me` e `PUT /profiles/:id`: blocos inteiros, parciais e regras de papel. */
async function run({ http, logger, ctx }) {
  logger.section('profiles/update');
  const as = await ensureRoleClients({ http, logger, ctx });

  const full = {
    personalData: { birthDate: '1990-05-20', gender: 'F', gaLeaderName: 'Líder Editada', gaLeaderContact: '11911112222' },
    preferences: { loveLanguages: 'Tempo de qualidade', temperaments: 'Fleumático', favoriteColor: 'Roxo', favoriteFood: 'Feijoada', favoriteMusic: 'Hinos', whatMakesYouSmile: 'Crianças cantando', skillsAndTalents: 'Violão' },
  };

  for (const key of ['teacher', 'coordinator', 'admin']) {
    const client = as[key];
    if (!client) continue;
    await logger.check(`PUT /profiles/me como ${key} edita dados pessoais e preferências`, async () => {
      const res = await client.request('put', '/profiles/me', { data: full });
      expectFields(res.data.personalData ?? {}, full.personalData, 'personalData');
      expectFields(res.data.preferences ?? {}, full.preferences, 'preferences');
      const again = (await client.request('get', '/profiles/me')).data;
      expectFields(again.preferences ?? {}, full.preferences, 'GET /profiles/me');
      return `favoriteColor=${again.preferences?.favoriteColor}`;
    });
  }

  if (as.teacher) {
    await logger.check('PUT /profiles/me parcial (só favoriteFood) preserva o resto', async () => {
      const res = await as.teacher.request('put', '/profiles/me', { data: { preferences: { favoriteFood: 'Pizza' } } });
      expectFields(res.data.preferences ?? {}, { favoriteFood: 'Pizza', favoriteColor: 'Roxo' }, 'parcial');
      return 'ok';
    });
    await logger.check('PUT /profiles/me com birthDate inválida responde 400/422', () =>
      expectHttpError(() => as.teacher.request('put', '/profiles/me', { data: { personalData: { birthDate: 'ontem' } } }), [400, 422], 'birthDate'),
    );
    await logger.check('PUT /profiles/me com campo desconhecido responde 400/422 (whitelist)', () =>
      expectHttpError(() => as.teacher.request('put', '/profiles/me', { data: { role: 'admin' } }), [400, 422], 'profiles whitelist'),
    );
  }

  const target = ctx.roleUsers?.teacher?.id;
  if (target) {
    const edit = (client, id, body) => client.request('put', `/profiles/${id}`, { data: body });
    edit.sampleId = target;
    await logger.check('PUT /profiles/:id como admin edita o perfil de outra pessoa', async () => {
      const res = await edit(http, target, { personalData: { gaLeaderName: 'Líder pelo Admin' } });
      expectFields(res.data.personalData ?? {}, { gaLeaderName: 'Líder pelo Admin' }, 'admin edit');
      return 'ok';
    });
    await runEditContractChecks({
      logger, as, http, label: 'PUT /profiles/:id', edit,
      validBody: { preferences: { favoriteColor: 'Verde' } },
      invalidBodies: [{ preferences: { favoriteColor: 123 } }, { personalData: { birthDate: 'x' } }],
      forbiddenRoles: ['coordinator', 'teacher'],
    });
  }
  return { ok: true };
}

module.exports = { run };
