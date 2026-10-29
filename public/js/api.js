async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  profiles: () => request('GET', '/profiles'),
  createProfile: (p) => request('POST', '/profiles', p),
  updateProfile: (id, p) => request('PUT', `/profiles/${id}`, p),
  deleteProfile: (id) => request('DELETE', `/profiles/${id}`),

  words: (pid) => request('GET', `/profiles/${pid}/words`),
  addWord: (pid, w) => request('POST', `/profiles/${pid}/words`, w),
  updateWord: (id, w) => request('PUT', `/words/${id}`, w),
  deleteWord: (id) => request('DELETE', `/words/${id}`),

  periods: (pid) => request('GET', `/profiles/${pid}/periods`),
  practice: (pid, params) => request('GET', `/profiles/${pid}/practice?${new URLSearchParams(params)}`),
  saveSession: (pid, s) => request('POST', `/profiles/${pid}/sessions`, s),
  stats: (pid) => request('GET', `/profiles/${pid}/stats`),
};
