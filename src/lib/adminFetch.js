/**
 * Wrapper around fetch that attaches admin auth credentials.
 * Uses the admin password stored in sessionStorage after login.
 */
export default function adminFetch(url, options = {}) {
  let password = null;
  try { password = sessionStorage.getItem('admin_password'); }
  catch { /* storage unavailable */ }
  const headers = { ...(options.headers || {}) };

  if (password) {
    headers['Authorization'] = `Bearer ${password}`;
  }

  return fetch(url, { ...options, headers });
}
