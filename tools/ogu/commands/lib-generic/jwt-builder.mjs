/**
 * JWT Builder — build and verify JWT-like tokens (simplified).
 */
function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function buildJWT(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = base64url(secret + '.' + header + '.' + body);
  return `${header}.${body}.${signature}`;
}

export function decodeJWT(token) {
  const [, body] = token.split('.');
  return JSON.parse(Buffer.from(body, 'base64').toString());
}

export function verifyJWT(token, secret) {
  const [header, body, sig] = token.split('.');
  const expected = base64url(secret + '.' + header + '.' + body);
  return sig === expected;
}
