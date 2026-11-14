const TOKEN_STORAGE_KEY = 'bankhack_token';

export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Декодирует payload JWT без проверки подписи.
 * Используется только для UI: показывать/скрывать админ-раздел.
 * Реальная проверка роли выполняется на бэкенде.
 */
export function decodeToken(token = getToken()) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getTokenRole(token = getToken()) {
  const payload = decodeToken(token);
  return payload?.role || null;
}

export function isAdminToken(token = getToken()) {
  return getTokenRole(token) === 'admin';
}

function extractErrorMessage(detail) {
  if (!detail) return 'Произошла ошибка при обращении к серверу';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg || JSON.stringify(item)).join('; ');
  }
  if (typeof detail === 'object') {
    const parts = [detail.message, detail.error].filter(Boolean);
    return parts.length ? parts.join(': ') : JSON.stringify(detail);
  }
  return String(detail);
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(extractErrorMessage(data.detail));
    error.status = response.status;
    error.detail = data.detail;
    throw error;
  }

  return data;
}

export function loginRequest(username, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchDashboard() {
  return apiRequest('/dashboard');
}

export function fetchUserTransactions(userId) {
  return apiRequest(`/v1/transactions/${userId}`);
}

export function createTransfer({ to_username, amount, comment }) {
  return apiRequest('/v1/transfer', {
    method: 'POST',
    body: JSON.stringify({
      to_username,
      amount: Number(amount),
      comment,
    }),
  });
}

export function adminExport({ search, template }) {
  return apiRequest('/admin/export', {
    method: 'POST',
    body: JSON.stringify({ search: search ?? '', template: template ?? '' }),
  });
}
