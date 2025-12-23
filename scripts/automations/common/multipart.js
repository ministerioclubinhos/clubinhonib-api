const { API_BASE_URL } = require('./config');

function toBlob(content, contentType = 'application/octet-stream') {
  // content can be string | Buffer | Uint8Array
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  return new Blob([bytes], { type: contentType });
}

async function multipartRequest({ http, method, path, fields = {}, files = {} }) {
  // Uses global fetch/FormData (Node 18+)
  const url = `${API_BASE_URL}${path}`;
  const token = http.getToken?.() || '';

  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    form.append(k, String(v));
  }

  for (const [fieldname, file] of Object.entries(files)) {
    if (!file) continue;
    const { filename, contentType, content } = file;
    form.append(fieldname, toBlob(content, contentType), filename);
  }

  const res = await fetch(url, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (res.status === 204) return { status: 204, data: null };

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }

  if (!res.ok) {
    const pretty =
      (data && (data.message || data.error)) ||
      (typeof data === 'string' ? data : JSON.stringify(data));
    const err = new Error(`HTTP ${res.status} ${res.statusText}${pretty ? ` - ${pretty}` : ''}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return { status: res.status, data };
}

module.exports = { multipartRequest };
