const { sleep } = require('./sleep');

function extractItemsAndPages(data, { page, limit }) {
  
  
  
  
  

  let items = null;
  if (Array.isArray(data?.data)) items = data.data;
  else if (Array.isArray(data?.items)) items = data.items;
  else if (Array.isArray(data)) items = data;
  else items = [];

  let totalPages = null;
  if (Number.isFinite(data?.meta?.totalPages)) totalPages = Number(data.meta.totalPages);
  else if (Number.isFinite(data?.totalPages)) totalPages = Number(data.totalPages);
  else if (Number.isFinite(data?.pageCount)) totalPages = Number(data.pageCount);

  const total =
    (Number.isFinite(data?.total) ? Number(data.total) : null) ??
    (Number.isFinite(data?.meta?.totalItems) ? Number(data.meta.totalItems) : null);

  if (!Number.isFinite(totalPages) && Number.isFinite(total) && Number.isFinite(limit) && limit > 0) {
    totalPages = Math.ceil(total / limit);
  }

  
  if (!Number.isFinite(totalPages)) totalPages = null;

  return { items, totalPages };
}

async function fetchAllPages(requestFn, method, url, params = {}, options = {}) {
  const startPage = options.startPage ?? 1;
  const limit = options.limit ?? (params.limit ?? 100);
  const pageParam = options.pageParam ?? 'page';
  const limitParam = options.limitParam ?? 'limit';
  const delayMs = options.delayMs ?? 0;
  const maxPages = options.maxPages ?? 9999;
  const detectRepeat = options.detectRepeat ?? true;

  let page = startPage;
  let all = [];
  let totalPages = null;
  let lastSig = null;
  let repeatCount = 0;

  while (page <= maxPages) {
    const res = await requestFn(method, url, {
      params: {
        ...params,
        [pageParam]: page,
        [limitParam]: limit,
      },
    });

    const { items, totalPages: tp } = extractItemsAndPages(res.data, { page, limit });
    all.push(...items);

    if (totalPages == null && Number.isFinite(tp)) totalPages = tp;

    
    
    if (detectRepeat) {
      const sig = JSON.stringify(items.map((it) => it?.id ?? it).slice(0, 10));
      if (lastSig && sig === lastSig) repeatCount += 1;
      else repeatCount = 0;
      lastSig = sig;
      if (repeatCount >= 2) break;
    }

    const reachedEndByMeta = totalPages != null && page >= totalPages;
    const reachedEndByEmpty = items.length === 0; 

    if (reachedEndByMeta || (totalPages == null && reachedEndByEmpty)) break;

    page += 1;
    if (delayMs > 0) await sleep(delayMs);
  }

  return all;
}

module.exports = { fetchAllPages };


