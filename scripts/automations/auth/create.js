const { randomName, randomEmail, randomPhone } = require('../common/random');
const { DEFAULT_PASSWORD } = require('../common/config');
const { createHttpClient } = require('../common/http');
const { expectHttpError } = require('../common/errors');

/**
 * `POST /auth/register` é público e cria a conta **inativa** (aguarda a
 * confirmação de e-mail). O login dessa conta responde sem tokens; é isso que
 * se confere aqui. O envio do e-mail depende do SMTP local, por isso o cenário
 * é "soft".
 */
async function run({ http, logger, ctx }) {
  logger.section('auth/create');
  const anonymous = http.anonymous();
  const dto = {
    name: randomName(),
    email: randomEmail('register'),
    phone: randomPhone(),
    password: DEFAULT_PASSWORD,
    role: 'teacher',
  };

  const registered = await logger.check(
    `POST /auth/register cria conta inativa (${dto.email})`,
    async () => {
      const res = await anonymous.request('post', '/auth/register', { data: dto });
      if (res.data?.user?.active !== false) throw new Error(`esperava user.active=false, veio ${JSON.stringify(res.data?.user)}`);
      ctx.registeredUser = { ...dto, id: res.data.user.id };
      return `id=${res.data.user.id}`;
    },
    { soft: true },
  );

  if (registered.ok) {
    await logger.check('POST /auth/register com e-mail repetido responde 409', () =>
      expectHttpError(() => anonymous.request('post', '/auth/register', { data: dto }), 409, 'register duplicado'),
    );

    await logger.check('POST /auth/login de conta inativa não devolve tokens', async () => {
      const res = await anonymous.request('post', '/auth/login', { data: { email: dto.email, password: dto.password } });
      if (res.data?.accessToken) throw new Error('conta inativa recebeu accessToken');
      return `message="${res.data?.message}"`;
    });

    await logger.check('POST /auth/resend-verification para a conta inativa', async () => {
      const res = await anonymous.request('post', '/auth/resend-verification', { data: { email: dto.email } });
      return `emailVerification=${JSON.stringify(res.data?.emailVerification ?? null).slice(0, 80)}`;
    }, { soft: true });
  }

  await logger.check('POST /auth/register sem role responde 400/422', () =>
    expectHttpError(
      () => anonymous.request('post', '/auth/register', { data: { name: 'X', email: randomEmail('invalid'), phone: '1', password: DEFAULT_PASSWORD } }),
      [400, 422],
      'register sem role',
    ),
  );

  await logger.check('POST /auth/login com senha errada responde 401', () =>
    expectHttpError(
      () => createHttpClient().request('post', '/auth/login', { data: { email: http.getUser()?.email ?? 'superuser@clubinhonib.com', password: 'senha-errada' } }),
      401,
      'login inválido',
    ),
  );

  return { ok: true };
}

module.exports = { run };
