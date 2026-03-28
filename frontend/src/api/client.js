/**
 * API client for SignalForge backend
 * Uses VITE_API_BASE_URL env var, falls back to local backend
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Market scan
  scan: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/scan${qs ? '?' + qs : ''}`);
  },

  // Stock detail
  getStock: (symbol, period = 60) =>
    request(`/stock/${symbol}?period=${period}`),

  // Portfolio
  getPortfolio: (userId) =>
    request(`/portfolio/?user_id=${encodeURIComponent(userId)}`),

  addPortfolioItem: (item) =>
    request('/portfolio/add', { method: 'POST', body: JSON.stringify(item) }),

  removePortfolioItem: (item) =>
    request('/portfolio/remove', { method: 'DELETE', body: JSON.stringify(item) }),

  // Assistant
  chat: (userId, message) =>
    request('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, message }),
    }),

  assistantStatus: () => request('/assistant/status'),

  // Health
  health: () => request('/health'),
};

export default api;
