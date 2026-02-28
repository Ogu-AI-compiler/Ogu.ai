/**
 * Content Negotiator — HTTP-style content negotiation.
 */
export function createContentNegotiator() {
  const formats = [];

  function addFormat(mediaType) {
    formats.push(mediaType);
  }

  function negotiate(acceptHeader) {
    const accepted = acceptHeader.split(",").map(part => {
      const [type, ...params] = part.trim().split(";");
      let q = 1;
      for (const p of params) {
        const m = p.trim().match(/q=([0-9.]+)/);
        if (m) q = parseFloat(m[1]);
      }
      return { type: type.trim(), q };
    }).sort((a, b) => b.q - a.q);

    for (const { type } of accepted) {
      if (formats.includes(type)) return type;
    }
    return null;
  }

  return { addFormat, negotiate };
}
