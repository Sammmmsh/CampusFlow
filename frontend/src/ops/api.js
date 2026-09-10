let csrf = '';
export async function api(path, { method = 'GET', body, key } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`/api/ops${path}`, {
      method, credentials: 'same-origin', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-CampusFlow': '1', ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.message || 'The operations service is unavailable. Please try again.'); error.status = response.status; throw error; }
    if (data.csrf) csrf = data.csrf;
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The service is taking longer than expected. Your changes may already be saved; retry safely.');
    throw error;
  } finally { clearTimeout(timeout); }
}
let sessionPromise;
export function ensureSession() {
  if (!sessionPromise) sessionPromise = api('/session').catch(error => {
    if (error.status === 401) return api('/session', { method: 'POST', body: { role: 'student' } });
    throw error;
  }).finally(() => { sessionPromise = undefined; });
  return sessionPromise;
}
