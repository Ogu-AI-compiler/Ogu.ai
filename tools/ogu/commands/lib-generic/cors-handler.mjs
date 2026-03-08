/**
 * CORS Handler — handle Cross-Origin Resource Sharing headers.
 */
export function createCORSHandler(options = {}) {
  const allowedOrigins = new Set(options.origins || ['*']);
  const allowedMethods = options.methods || ['GET', 'POST', 'PUT', 'DELETE'];
  const allowedHeaders = options.headers || ['Content-Type', 'Authorization'];
  function isAllowed(origin) {
    return allowedOrigins.has('*') || allowedOrigins.has(origin);
  }
  function getHeaders(origin) {
    if (!isAllowed(origin)) return {};
    return {
      'Access-Control-Allow-Origin': allowedOrigins.has('*') ? '*' : origin,
      'Access-Control-Allow-Methods': allowedMethods.join(', '),
      'Access-Control-Allow-Headers': allowedHeaders.join(', ')
    };
  }
  function addOrigin(origin) { allowedOrigins.add(origin); }
  function removeOrigin(origin) { allowedOrigins.delete(origin); }
  return { isAllowed, getHeaders, addOrigin, removeOrigin };
}
