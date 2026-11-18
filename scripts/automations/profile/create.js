const { multipartRequest } = require('../common/multipart');
const { fixture } = require('../common/fixtures');
const { ensureRoleClients } = require('../common/role-users');
const { expectHttpError } = require('../common/errors');

/**
 * `/profile` é a conta de quem está logado. "Criar" aqui é dar uma foto de
 * perfil real (PNG gerado) para cada papel: multipart com `imageData` + campo
 * `file`, e depois a variante por link em JSON puro.
 */
async function run({ http, logger, ctx }) {
  logger.section('profile/create');
  const as = await ensureRoleClients({ http, logger, ctx });

  for (const key of ['admin', 'coordinator', 'teacher', 'googleLike']) {
    const client = as[key];
    if (!client) continue;
    await logger.check(`PATCH /profile/image (upload PNG) como ${key}`, async () => {
      const res = await multipartRequest({
        http: client,
        method: 'PATCH',
        path: '/profile/image',
        fields: { imageData: JSON.stringify({ title: `Foto ${key}`, description: 'Automação', uploadType: 'upload', isLocalFile: true, fieldKey: 'file' }) },
        files: { file: fixture('png', { seed: key.length, name: `perfil-${key}.png` }) },
      });
      if (!res.data?.image?.url) throw new Error('resposta sem image.url');
      if (res.data.image.isLocalFile !== true) throw new Error('image.isLocalFile deveria ser true');
      return res.data.image.url;
    });
  }

  if (as.teacher) {
    await logger.check('PATCH /profile/image (link JSON) como teacher', async () => {
      const res = await as.teacher.request('patch', '/profile/image', {
        data: { imageData: JSON.stringify({ title: 'Foto link', uploadType: 'link', url: 'https://picsum.photos/seed/teacher/200', isLocalFile: false }) },
      });
      if (res.data?.image?.isLocalFile !== false) throw new Error('image.isLocalFile deveria ser false');
      return res.data.image.url;
    });

    await logger.check('PATCH /profile/image sem imageData e sem arquivo responde 400/422', () =>
      expectHttpError(() => as.teacher.request('patch', '/profile/image', { data: {} }), [400, 422], 'image vazio'),
    );
  }

  await logger.check('PATCH /profile/image anônimo responde 401', () =>
    expectHttpError(() => as.anonymous.request('patch', '/profile/image', { data: { imageData: '{}' } }), 401, 'image anônimo'),
  );

  return { ok: true };
}

module.exports = { run };
