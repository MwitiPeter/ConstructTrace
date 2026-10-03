/**
 * Tiny fetch wrapper: JSON in/out, cookie-based auth, friendly errors.
 */
export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'include',
    body: formData || (body ? JSON.stringify(body) : undefined),
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Trigger a cookie-authenticated file download in the browser. */
export function download(path) {
  const a = document.createElement('a');
  a.href = path;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
