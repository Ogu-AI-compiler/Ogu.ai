/**
 * Geo Hash — encode/decode geographic coordinates to geohash strings.
 */
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encode(lat, lng, precision = 6) {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = "";
  let bit = 0, ch = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { ch |= (1 << (4 - bit)); minLng = mid; }
      else { maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { ch |= (1 << (4 - bit)); minLat = mid; }
      else { maxLat = mid; }
    }
    isLng = !isLng;
    bit++;
    if (bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

export function decode(hash) {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let isLng = true;

  for (const c of hash) {
    const val = BASE32.indexOf(c);
    for (let bit = 4; bit >= 0; bit--) {
      if (isLng) {
        const mid = (minLng + maxLng) / 2;
        if (val & (1 << bit)) minLng = mid;
        else maxLng = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (val & (1 << bit)) minLat = mid;
        else maxLat = mid;
      }
      isLng = !isLng;
    }
  }

  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}
