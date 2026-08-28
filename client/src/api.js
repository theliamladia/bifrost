const BASE = import.meta.env.VITE_API_BASE || '';

class ApiError extends Error {
  constructor(message, { status, code }) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'POST', body, token } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.message || `Request failed (${res.status})`, { status: res.status, code: data.error });
  }
  return data;
}

export const api = {
  health: () => request('/health', { method: 'GET' }),
  redeemApproval: (approvalCode) => request('/session/redeem', { body: { approvalCode } }),
  scan: (token, payload = {}) => request('/scan', { body: payload, token }),
};

export { ApiError };
