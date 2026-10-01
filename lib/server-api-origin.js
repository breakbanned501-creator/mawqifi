/** Public native backend configuration shared by the client and build tooling. */
/** @param {string | undefined} value @returns {string} */
function requireServerApiOrigin(value) {
  if (!value?.trim()) throw new Error('NEXT_PUBLIC_SERVER_API_ORIGIN is required for a native build.');
  let url;
  try { url = new URL(value.trim()); }
  catch { throw new Error('NEXT_PUBLIC_SERVER_API_ORIGIN must be a valid HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('NEXT_PUBLIC_SERVER_API_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}

module.exports = { requireServerApiOrigin };
