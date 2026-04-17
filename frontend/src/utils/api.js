const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api';

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  signup: (data) => request('POST', '/signup', data),
  createTransaction: (data) => request('POST', '/transaction', data),
  getUser: (userId) => request('GET', `/user/${userId}`),
  getTransactions: (userId) => request('GET', `/user/${userId}/transactions`),
  getProfile: (userId) => request('GET', `/user/${userId}/profile`),
  simulate: (userId, scenario) => request('POST', '/simulate', { user_id: userId, scenario }),
  getAnalytics: (userId) => request('GET', `/user/${userId}/analytics`),
  reportPayee: (data) => request('POST', '/report-payee', data),
  checkReported: (upi) => request('GET', `/reported/${encodeURIComponent(upi)}`),
  health: () => request('GET', '/health'),
};
