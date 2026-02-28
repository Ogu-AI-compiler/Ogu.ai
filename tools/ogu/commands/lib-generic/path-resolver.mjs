/**
 * Path Resolver — resolve and normalize file paths.
 */
export function resolve(...segments) {
  const parts = [];
  for (const seg of segments) {
    for (const part of seg.split('/')) {
      if (part === '..') { parts.pop(); }
      else if (part !== '.' && part !== '') { parts.push(part); }
    }
  }
  return '/' + parts.join('/');
}

export function join(...segments) {
  return segments.join('/').replace(/\/+/g, '/');
}

export function dirname(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

export function basename(path, ext = '') {
  const base = path.split('/').pop() || '';
  if (ext && base.endsWith(ext)) return base.slice(0, -ext.length);
  return base;
}

export function extname(path) {
  const base = path.split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot) : '';
}
