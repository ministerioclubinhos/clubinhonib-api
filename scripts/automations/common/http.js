const axios = require('axios');
const { API_BASE_URL, SUPERUSER_EMAIL, SUPERUSER_PASSWORD } = require('./config');

function createHttpClient({ baseURL = API_BASE_URL } = {}) {
  const client = axios.create({ baseURL });
  let token = '';

  async function login(email = SUPERUSER_EMAIL, password = SUPERUSER_PASSWORD) {
    const res = await client.post('/auth/login', { email, password });
    token = res.data?.accessToken || '';
    if (!token) throw new Error('Login falhou: accessToken não retornou');
    return token;
  }

  async function request(method, url, { params, data, headers } = {}) {
    const res = await client.request({
      method,
      url,
      params,
      data,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
    });
    return res;
  }

  return {
    client,
    login,
    request,
    getToken: () => token,
  };
}

module.exports = { createHttpClient };


