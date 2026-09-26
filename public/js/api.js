async function request(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`The server returned an invalid response (${response.status})`);
  }
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

export const api = {
  summary: () => request('/api/summary'),
  composition: (account) => {
    const source = encodeURIComponent(account.sourceId);
    const id = encodeURIComponent(account.accountId);
    return request(`/api/accounts/${id}/composition?sourceId=${source}`);
  },
  history: ({ bucket = 'hour', account = null } = {}) => {
    const params = new URLSearchParams({ bucket, limit: bucket === 'hour' ? '168' : '365' });
    if (account) {
      params.set('sourceId', account.sourceId);
      params.set('accountId', account.accountId);
    }
    return request(`/api/history?${params}`);
  },
};
