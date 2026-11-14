const { randomName, randomEmail, randomPhone } = require('../common/random');
const { expectHttpError, errorStatus, errorMessage } = require('../common/errors');

/**
 * Formulário público do site. O envio dispara o aviso por e-mail dentro da
 * requisição; se o SMTP local falhar, confere que o contato foi gravado.
 */
async function run({ http, logger, ctx }) {
  logger.section('contact/create');
  const anonymous = http.anonymous();
  const min = ctx?.minPagesItems ?? 5;
  ctx.createdContacts = [];

  const existing = await http.request('get', '/contact', { params: { page: 1, limit: 1 } });
  const toCreate = Math.max(1, min - (existing.data.total ?? 0));
  for (let i = 0; i < toCreate; i++) {
    const email = randomEmail('contato');
    const dto = { name: randomName(), email, phone: randomPhone(), message: `Olá! Gostaria de saber como levar o Clubinho para o meu bairro. (automação #${i + 1})` };
    try {
      const res = await anonymous.request('post', '/contact', { data: dto });
      if (res.data.read !== false) throw new Error('contato novo deveria nascer não lido');
      ctx.createdContacts.push(res.data);
    } catch (e) {
      if (errorStatus(e) === 500) {
        logger.warn(`[contact/create] 500 no envio do e-mail; conferindo persistência: ${errorMessage(e)}`);
        const list = await http.request('get', '/contact', { params: { searchString: email, page: 1, limit: 5 } });
        const saved = list.data.data.find((c) => c.email === email);
        if (saved) ctx.createdContacts.push(saved);
        else logger.error(`[contact/create] contato ${email} não foi persistido`);
      } else {
        logger.error(`[contact/create] ${errorMessage(e)}`);
      }
    }
  }
  logger.ok(`[contact/create] criados=${ctx.createdContacts.length}`);

  await logger.check('POST /contact com mensagem curta responde 400/422', () =>
    expectHttpError(() => anonymous.request('post', '/contact', { data: { name: 'Ana', email: 'ana@x.com', phone: '11999990000', message: 'curta' } }), [400, 422], 'contact curto'),
  );
  await logger.check('POST /contact com read no corpo responde 400/422 (whitelist)', () =>
    expectHttpError(() => anonymous.request('post', '/contact', { data: { name: 'Ana', email: 'ana@x.com', phone: '11999990000', message: 'mensagem longa o bastante', read: true } }), [400, 422], 'contact whitelist'),
  );

  return { created: ctx.createdContacts };
}

module.exports = { run };
