const axios = require('axios');
const { API_BASE_URL, SUPERUSER_EMAIL, SUPERUSER_PASSWORD } = require('./config');

/**
 * Cliente HTTP com sessão.
 *
 * Cada cliente guarda o próprio token: as automações abrem um cliente por papel
 * (admin, coordenador, professor, anônimo) para cobrir as regras de acesso.
 */
function createHttpClient({ baseURL = API_BASE_URL, label = 'superuser' } = {}) {
  const client = axios.create({ baseURL, timeout: 60000 });
  let token = '';
  let refreshToken = '';
  let user = null;

  async function login(email = SUPERUSER_EMAIL, password = SUPERUSER_PASSWORD) {
    const res = await client.post('/auth/login', { email, password });
    token = res.data?.accessToken || '';
    refreshToken = res.data?.refreshToken || '';
    user = res.data?.user || null;
    if (!token) {
      const err = new Error(`Login failed for ${email}: accessToken not returned (${res.data?.message ?? ''})`);
      err.loginResponse = res.data;
      throw err;
    }
    return token;
  }

  async function request(method, url, { params, data, headers } = {}) {
    return client.request({
      method,
      url,
      params,
      data,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
    });
  }

  return {
    label,
    baseURL,
    client,
    login,
    request,
    getToken: () => token,
    setToken: (value) => {
      token = value || '';
    },
    getRefreshToken: () => refreshToken,
    getUser: () => user,
    /** Cliente sem sessão, para as rotas públicas e para os 401. */
    anonymous: () => createHttpClient({ baseURL, label: 'anonymous' }),
  };
}

/** Abre um cliente já logado com as credenciais dadas. */
async function loginAs({ email, password, baseURL = API_BASE_URL, label }) {
  const http = createHttpClient({ baseURL, label: label || email });
  await http.login(email, password);
  return http;
}

module.exports = { createHttpClient, loginAs };
