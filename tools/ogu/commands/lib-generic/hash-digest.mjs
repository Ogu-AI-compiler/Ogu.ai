/**
 * Hash Digest — compute hash digests for data integrity.
 */
export function simpleHash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0');
}

export function hashMultiple(items) {
  return items.map(item => simpleHash(item));
}

export function verifyHash(data, expectedHash) {
  return simpleHash(data) === expectedHash;
}
