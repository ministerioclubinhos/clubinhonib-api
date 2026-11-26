const { sleep } = require('./sleep');

/**
 * Lê uma página em qualquer um dos formatos que a API devolve:
 * - `Paginated<T>`: `{ data, total, page, limit, pageCount }`
 * - crianças: `{ data, meta: { totalItems, totalPages } }`
 * - usuários: `{ items, meta: { total, totalPages } }`
 * - perfis de professor/coordenador: `{ items, total, page, limit }`
 * - estatísticas: `{ clubs|children|teachers, pagination: { total, totalPages } }`
 * - seções de galeria: `{ sections, total, page, limit }`
 */
function extractItemsAndPages(data, { limit, itemsKey } = {}) {
  let items = [];
  if (itemsKey && Array.isArray(data?.[itemsKey])) items = data[itemsKey];
  else if (Array.isArray(data?.data)) items = data.data;
  else if (Array.isArray(data?.items)) items = data.items;
  else if (Array.isArray(data?.sections)) items = data.sections;
  else if (Array.isArray(data)) items = data;

  const meta = data?.meta ?? data?.pagination ?? data ?? {};

  let totalPages = null;
  for (const candidate of [meta.totalPages, meta.pageCount, data?.totalPages, data?.pageCount]) {
    if (Number.isFinite(candidate)) {
      totalPages = Number(candidate);
      break;
    }
  }

  let total = null;
  for (const candidate of [meta.total, meta.totalItems, data?.total]) {
    if (Number.isFinite(candidate)) {
      total = Number(candidate);
      break;
    }
  }

  if (totalPages == null && total != null && Number.isFinite(limit) && limit > 0) {
    totalPages = Math.ceil(total / limit);
  }

  return { items, totalPages, total };
}

/**
 * Percorre todas as páginas de uma listagem (regra do checklist: toda listagem
 * paginada é lida da página 1 à N).
 */
async function fetchAllPages(requestFn, method, url, params = {}, options = {}) {
  const startPage = options.startPage ?? 1;
  const limit = options.limit ?? params.limit ?? 100;
  const pageParam = options.pageParam ?? 'page';
  const limitParam = options.limitParam ?? 'limit';
  const delayMs = options.delayMs ?? 0;
  const maxPages = options.maxPages ?? 9999;
  const itemsKey = options.itemsKey;

  let page = startPage;
  const all = [];
  let totalPages = null;
  let total = null;
  let lastSig = null;
  let repeatCount = 0;

  while (page <= maxPages) {
    const res = await requestFn(method, url, {
      params: { ...params, [pageParam]: page, [limitParam]: limit },
    });

    const extracted = extractItemsAndPages(res.data, { limit, itemsKey });
    all.push(...extracted.items);
    if (totalPages == null && Number.isFinite(extracted.totalPages)) totalPages = extracted.totalPages;
    if (total == null && Number.isFinite(extracted.total)) total = extracted.total;

    // Proteção contra API que ignora `page`: a mesma página duas vezes encerra.
    const sig = JSON.stringify(extracted.items.map((it) => it?.id ?? it).slice(0, 10));
    if (lastSig && sig === lastSig && extracted.items.length > 0) repeatCount += 1;
    else repeatCount = 0;
    lastSig = sig;
    if (repeatCount >= 1) break;

    const reachedEndByMeta = totalPages != null && page >= totalPages;
    const reachedEndByEmpty = extracted.items.length === 0;
    if (reachedEndByMeta || reachedEndByEmpty) break;

    page += 1;
    if (delayMs > 0) await sleep(delayMs);
  }

  const result = all;
  result.totalReported = total;
  result.pagesRead = page - startPage + 1;
  return result;
}

module.exports = { fetchAllPages, extractItemsAndPages };
