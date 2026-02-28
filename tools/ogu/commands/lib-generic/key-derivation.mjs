/**
 * Key Derivation — derive keys from passwords using simple KDF.
 */
export function deriveKey(password, salt, iterations = 1000) {
  let hash = 0;
  const input = password + salt;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash + input.charCodeAt(i) + iter) | 0;
    }
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function deriveKeyPair(password, salt, iterations = 1000) {
  const priv = deriveKey(password, salt, iterations);
  const pub = deriveKey(priv, salt + 'pub', iterations);
  return { privateKey: priv, publicKey: pub };
}
