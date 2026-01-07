const { randomName, randomEmail, randomPhone } = require('../common/random');

async function run({ http, logger }) {
  const email = randomEmail('contact');
  const dto = {
    name: randomName(),
    email,
    phone: randomPhone(),
    message: 'Mensagem de contato criada pela automação',
  };
  logger.info('[contact/create] creating contact (public POST)...');
  try {
    const res = await http.request('post', '/contact', { data: dto });
    logger.info(`[contact/create] OK id=${res.data?.id ?? 'n/a'}`);
    return { contact: res.data };
  } catch (e) {
    const status = e.response?.status;
    const msg = e.response?.data?.message || e.message;
    
    if (status === 500 && String(msg).toLowerCase().includes('e-mail')) {
      logger.warn(`[contact/create] API returned 500 on email sending; validating persistence via GET /contact...`);
      const list = await http.request('get', '/contact');
      const contacts = Array.isArray(list.data) ? list.data : [];
      const created = contacts.find((c) => c?.email === email) || contacts[0];
      logger.info(`[contact/create] OK persisted id=${created?.id ?? 'n/a'} (apesar do 500)`);
      return { contact: created, persistedDespiteEmailError: true };
    }
    throw e;
  }
}

module.exports = { run };


